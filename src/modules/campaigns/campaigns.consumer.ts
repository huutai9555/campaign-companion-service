import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CAMPAIGN_EMAIL_SENDING } from 'src/constant/campaigns';
import { Campaign } from 'src/entities/campaigns.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { Account, AccountStatus } from 'src/entities/accounts.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';
import { getProviderConfig } from 'src/helpers/email-provider-config';

@Processor(CAMPAIGN_EMAIL_SENDING)
export class CampaignEmailConsumer extends WorkerHost {
  private readonly logger = new Logger(CampaignEmailConsumer.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipientRepository: Repository<EmailRecipient>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly emailProvidersService: EmailProvidersService,
    @InjectQueue(CAMPAIGN_EMAIL_SENDING)
    private readonly campaignEmailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string }, any, string>): Promise<any> {
    const { campaignId } = job.data;
    this.logger.log(`Processing campaign ${campaignId}`);

    // Load campaign with relations
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['accounts', 'templates', 'emailImportSession'],
    });

    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return { error: 'Campaign not found' };
    }

    if (campaign.templates.length <= 0) {
      this.logger.error(`Campaign ${campaignId} has no templates`);
      return { error: 'No templates configured for campaign' };
    }

    // Check if campaign should run
    if (campaign.status === 'completed' || campaign.status === 'failed') {
      this.logger.log(`Campaign ${campaignId} is ${campaign.status}, skipping`);
      return { status: campaign.status };
    }

    // Update campaign status to running if it's not already
    if (campaign.status !== 'running') {
      campaign.status = 'running';
      campaign.startedAt = campaign.startedAt || new Date();
      await this.campaignRepository.save(campaign);
    }

    // Get pending recipients
    const pendingRecipients = await this.emailRecipientRepository.find({
      where: {
        importSessionId: campaign.emailImportSessionId,
        sendStatus: 'pending',
      },
      order: { createdAt: 'ASC' },
    });

    if (pendingRecipients.length === 0) {
      this.logger.log(`No pending recipients for campaign ${campaignId}`);
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      await this.campaignRepository.save(campaign);

      // Update all accounts status to active
      await this.updateAccountsStatusToActive(campaign.accounts);

      return { status: 'completed', sent: 0 };
    }

    this.logger.log(
      `Found ${pendingRecipients.length} pending recipients to send`,
    );

    // Process each account
    let totalSentCount = 0;
    let totalFailedCount = 0;
    let recipientIndex = 0;
    let needsReschedule = false;
    let rescheduleDelayMs = 0;
    let rescheduleReason = '';

    // Distribute recipients across accounts
    const recipientsPerAccount = Math.ceil(
      pendingRecipients.length / campaign.accounts.length,
    );

    // Chạy qua từng account để gửi email
    for (const account of campaign.accounts) {
      // Lấy thông tin cấu hình nhà cung cấp
      const providerConfig = getProviderConfig(account.email);
      const now = new Date();

      // Reset daily counter if needed (24h passed since lastResetDate)
      if (this.shouldResetDaily(account)) {
        account.sentToday = 0;
        account.lastResetDate = now;
        this.logger.log(`Reset daily counter for account ${account.email}`);
      }

      // Reset hourly counter if needed (1h passed since hourStartedAt)
      if (this.shouldResetHourly(account)) {
        account.sentThisHour = 0;
        account.hourStartedAt = now;
        this.logger.log(`Reset hourly counter for account ${account.email}`);
      }

      // Nếu 2 case this.shouldResetHourly(account) và this.shouldResetDaily(account)
      // không xảy ra thì nó vẫn trong cùng 1 khoảng thời gian < 1h hoặc < 24h
      // nên không cần reset lại lastResetDate và hourStartedAt

      // Initialize timestamps if not set
      if (!account.lastResetDate) {
        account.lastResetDate = now;
      }
      if (!account.hourStartedAt) {
        account.hourStartedAt = now;
      }

      // Check daily limit
      if (account.sentToday >= providerConfig.dailyLimit) {
        const msUntilNextDay = this.getMsUntilNextDay(account.lastResetDate);
        this.logger.log(
          `Account ${account.email} reached daily limit (${account.sentToday}/${providerConfig.dailyLimit}). ` +
            `Will resume in ${Math.ceil(msUntilNextDay / 1000 / 60)} minutes`,
        );
        needsReschedule = true;
        rescheduleDelayMs = Math.max(rescheduleDelayMs, msUntilNextDay);
        rescheduleReason = 'daily_limit';
        await this.accountRepository.save(account);
        continue;
      }

      // Check hourly limit
      if (account.sentThisHour >= providerConfig.maxPerHour) {
        const msUntilNextHour = this.getMsUntilNextHour(account.hourStartedAt);
        this.logger.log(
          `Account ${account.email} reached hourly limit (${account.sentThisHour}/${providerConfig.maxPerHour}). ` +
            `Will resume in ${Math.ceil(msUntilNextHour / 1000 / 60)} minutes`,
        );
        needsReschedule = true;
        rescheduleDelayMs = Math.max(rescheduleDelayMs, msUntilNextHour);
        rescheduleReason = rescheduleReason || 'hourly_limit';
        await this.accountRepository.save(account);
        continue;
      }

      // Calculate how many emails this account can send this batch
      const remainingDaily = providerConfig.dailyLimit - account.sentToday;
      const remainingHourly = providerConfig.maxPerHour - account.sentThisHour;
      const maxCanSend = Math.min(remainingDaily, remainingHourly);

      this.logger.log(
        `Account ${account.email}: can send ${maxCanSend} emails ` +
          `(daily: ${account.sentToday}/${providerConfig.dailyLimit}, ` +
          `hourly: ${account.sentThisHour}/${providerConfig.maxPerHour})`,
      );

      // Send emails for this account
      let accountSentCount = 0;
      let accountFailedCount = 0;

      // Get recipients for this account
      const startIdx = recipientIndex;
      const endIdx = Math.min(
        recipientIndex + recipientsPerAccount,
        pendingRecipients.length,
      );

      for (let i = startIdx; i < endIdx && accountSentCount < maxCanSend; i++) {
        const recipient = pendingRecipients[i];
        // Double check recipient is still pending
        if (!recipient || recipient.sendStatus !== 'pending') continue;

        try {
          await this.emailProvidersService.sendViaSmtp(account, {
            to: recipient.email,
            subject: campaign.templates[0].subject,
            htmlContent: this.replaceVariables(
              `<!DOCTYPE html>
          <html>
          <head>
              <title>Thông tin Liên hệ</title>
              <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                  h2 { color: #0056b3; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                  .data-item { margin-bottom: 15px; }
                  .label { font-weight: bold; color: #555; display: inline-block; width: 120px; }
                  .value { color: #000; }
              </style>
          </head>
          <body>
              <div class="container">
                  <h2>Chi tiết Thông tin Khách hàng</h2>

                  <div class="data-item">
                      <span class="label">Tên:</span>
                      <span class="value">
                         ${recipient.name || 'Khách hàng tiềm năng'}
                      </span>
                  </div>

                  <div class="data-item">
                      <span class="label">Loại hình:</span>
                      <span class="value">
                         ${recipient.category || 'Chưa xác định'}
                      </span>
                  </div>

                  <div class="data-item">
                      <span class="label">Địa chỉ:</span>
                      <span class="value">
                         ${recipient.address || 'Không có địa chỉ'}
                      </span>
                  </div>
                    <div class="data-item">
                      <span class="label">Ghi chú:</span>
                      <span class="value">
                         ${campaign.templates[0].content || 'Cảm ơn vì đã quan tâm đến dịch vụ của chúng tôi.'}
                      </span>
                  </div>
              </div>
          </body>
          </html>`,
              recipient,
            ),
          });

          // Update recipient status
          recipient.sendStatus = 'sent';
          recipient.sentAt = new Date();
          await this.emailRecipientRepository.save(recipient);

          // Update account counters
          account.sentToday++;
          account.sentThisHour++;
          accountSentCount++;

          this.logger.log(
            `Sent email to ${recipient.email} via ${account.email}`,
          );

          // Delay between emails
          if (providerConfig.delayBetweenEmails > 0) {
            await this.delay(providerConfig.delayBetweenEmails);
          }
        } catch (error) {
          this.logger.error(
            `Failed to send email to ${recipient.email}: ${error.message}`,
          );
          recipient.sendStatus = 'failed';
          recipient.errorMessage = error.message;
          recipient.retryCount += 1;
          await this.emailRecipientRepository.save(recipient);
          accountFailedCount++;
        }

        // Check if we hit hourly limit during sending
        if (account.sentThisHour >= providerConfig.maxPerHour) {
          const msUntilNextHour = this.getMsUntilNextHour(
            account.hourStartedAt,
          );
          this.logger.log(
            `Account ${account.email} hit hourly limit during batch. Will resume in ${Math.ceil(msUntilNextHour / 1000 / 60)} minutes`,
          );
          needsReschedule = true;
          rescheduleDelayMs = Math.max(rescheduleDelayMs, msUntilNextHour);
          rescheduleReason = rescheduleReason || 'hourly_limit';
          break;
        }
      }
      // Save account counters
      await this.accountRepository.save(account);

      totalSentCount += accountSentCount;
      totalFailedCount += accountFailedCount;
      recipientIndex = endIdx;

      this.logger.log(
        `Account ${account.email}: sent ${accountSentCount}, failed ${accountFailedCount}`,
      );
    }

    // Update campaign statistics every batch via all accounts
    campaign.totalSent += totalSentCount;
    campaign.totalFailed += totalFailedCount;

    // Check remaining recipients
    const remainingPending = await this.emailRecipientRepository.count({
      where: {
        importSessionId: campaign.emailImportSessionId,
        sendStatus: 'pending',
      },
    });

    if (remainingPending === 0) {
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      this.logger.log(`Campaign ${campaignId} completed!`);

      // Update all accounts status to active
      await this.updateAccountsStatusToActive(campaign.accounts);
    } else if (needsReschedule) {
      // Schedule next job
      const delayMs = Math.max(rescheduleDelayMs, 60000); // At least 1 minute
      this.logger.log(
        `Scheduling next job for campaign ${campaignId} in ${Math.ceil(delayMs / 1000 / 60)} minutes (reason: ${rescheduleReason})`,
      );

      await this.campaignEmailQueue.add(
        `${CAMPAIGN_EMAIL_SENDING}-scheduled`,
        { campaignId },
        {
          delay: delayMs,
          jobId: `campaign-${campaignId}-scheduled-${Date.now()}`,
        },
      );
    } else if (remainingPending > 0) {
      // Still have recipients but no limits hit, continue immediately
      this.logger.log(
        `Continuing campaign ${campaignId} immediately. Remaining: ${remainingPending}`,
      );

      await this.campaignEmailQueue.add(
        `${CAMPAIGN_EMAIL_SENDING}-continue`,
        { campaignId },
        {
          delay: 1000, // 1 second delay
          jobId: `campaign-${campaignId}-continue-${Date.now()}`,
        },
      );
    }

    await this.campaignRepository.save(campaign);

    this.logger.log(
      `Campaign ${campaignId}: sent ${totalSentCount}, failed ${totalFailedCount}, remaining ${remainingPending}`,
    );

    return {
      sent: totalSentCount,
      failed: totalFailedCount,
      remaining: remainingPending,
      rescheduled: needsReschedule,
      rescheduleReason,
    };
  }

  // Nên reset counters hàng ngày (24h) và hàng giờ (1h)
  private shouldResetDaily(account: Account): boolean {
    // Nếu chưa từng reset thì cần reset
    if (!account.lastResetDate) return true;
    const now = new Date();
    const lastReset = new Date(account.lastResetDate);
    const hoursSinceReset =
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    // Nếu đã hơn hoặc bằng 24h thì nên reset
    return hoursSinceReset >= 24;
  }

  private shouldResetHourly(account: Account): boolean {
    // Nếu chưa từng reset thì cần reset
    if (!account.hourStartedAt) return true;
    const now = new Date();
    const hourStarted = new Date(account.hourStartedAt);
    const minutesSinceStart =
      (now.getTime() - hourStarted.getTime()) / (1000 * 60);
    // Nếu đã hơn hoặc bằng 60 phút thì nên reset
    return minutesSinceStart >= 60;
  }

  private getMsUntilNextDay(lastResetDate: Date): number {
    const lastReset = new Date(lastResetDate);
    const nextReset = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.max(0, nextReset.getTime() - now.getTime());
  }

  private getMsUntilNextHour(hourStartedAt: Date): number {
    const hourStarted = new Date(hourStartedAt);
    const nextHour = new Date(hourStarted.getTime() + 60 * 60 * 1000);
    const now = new Date();
    return Math.max(0, nextHour.getTime() - now.getTime());
  }

  private replaceVariables(content: string, recipient: EmailRecipient): string {
    return content
      .replace(/\{\{name\}\}/g, recipient.name || '')
      .replace(/\{\{email\}\}/g, recipient.email || '')
      .replace(/\{\{category\}\}/g, recipient.category || '')
      .replace(/\{\{address\}\}/g, recipient.address || '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async updateAccountsStatusToActive(
    accounts: Account[],
  ): Promise<void> {
    for (const account of accounts) {
      account.status = AccountStatus.ACTIVE;
      await this.accountRepository.save(account);
      this.logger.log(`Account ${account.email} status updated to active`);
    }
  }
}
