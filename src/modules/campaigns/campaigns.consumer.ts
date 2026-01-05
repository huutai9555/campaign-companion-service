import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CAMPAIGN_EMAIL_SENDING } from 'src/constant/campaigns';
import { Campaign } from 'src/entities/campaigns.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { EmailTemplate } from 'src/entities/email-templates.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';

@Processor(CAMPAIGN_EMAIL_SENDING)
export class CampaignEmailConsumer extends WorkerHost {
  private readonly logger = new Logger(CampaignEmailConsumer.name);
  private readonly EMAILS_PER_ACCOUNT_PER_DAY = 300;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipientRepository: Repository<EmailRecipient>,
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
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

    // Check if campaign should run
    if (campaign.status === 'completed' || campaign.status === 'failed') {
      this.logger.log(`Campaign ${campaignId} is ${campaign.status}, skipping`);
      return { status: campaign.status };
    }

    // Get active template
    // const activeTemplate = campaign.templates.find((t) => t.isActive);
    // if (!activeTemplate) {
    //   this.logger.error(`No active template for campaign ${campaignId}`);
    //   campaign.status = 'failed';
    //   await this.campaignRepository.save(campaign);
    //   return { error: 'No active template' };
    // }

    // Calculate daily limit: 300 emails per account
    const dailyLimit =
      campaign.accounts.length * this.EMAILS_PER_ACCOUNT_PER_DAY;
    this.logger.log(
      `Daily limit: ${dailyLimit} emails (${campaign.accounts.length} accounts × ${this.EMAILS_PER_ACCOUNT_PER_DAY})`,
    );

    // Get pending recipients
    const pendingRecipients = await this.emailRecipientRepository.find({
      where: {
        importSessionId: campaign.emailImportSessionId,
        sendStatus: 'pending',
      },
      take: dailyLimit,
      order: { createdAt: 'ASC' },
    });

    // Fix sau
    if (pendingRecipients.length === 0) {
      this.logger.log(`No pending recipients for campaign ${campaignId}`);
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      await this.campaignRepository.save(campaign);
      return { status: 'completed', sent: 0 };
    }

    this.logger.log(
      `Found ${pendingRecipients.length} pending recipients to send`,
    );

    // Send emails
    let sentCount = 0;
    let failedCount = 0;
    const emailsPerAccount = Math.ceil(
      pendingRecipients.length / campaign.accounts.length,
    );

    for (let i = 0; i < pendingRecipients.length; i++) {
      const recipient = pendingRecipients[i];
      const accountIndex = Math.floor(i / emailsPerAccount);
      const account =
        campaign.accounts[accountIndex % campaign.accounts.length];

      try {
        // Send email
        // await this.emailProvidersService.sendViaBrevo(account, {
        //   to: recipient.email,
        //   subject: activeTemplate.subject,
        //   htmlContent: this.replaceVariables(activeTemplate.content, recipient),
        // });
        await this.emailProvidersService.sendViaBrevo(
          account,
          recipient,
          'Kiểm thử tính năng',
        );

        // Update recipient status
        recipient.sendStatus = 'sent';
        recipient.sentAt = new Date();
        await this.emailRecipientRepository.save(recipient);
        sentCount++;

        // Delay between emails
        if (
          campaign.delayBetweenEmails > 0 &&
          i < pendingRecipients.length - 1
        ) {
          await this.delay(campaign.delayBetweenEmails * 1000);
        }
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${recipient.email}: ${error.message}`,
        );
        recipient.sendStatus = 'failed';
        recipient.errorMessage = error.message;
        recipient.retryCount += 1;
        await this.emailRecipientRepository.save(recipient);
        failedCount++;
      }
    }

    // Update campaign statistics
    campaign.totalSent += sentCount;
    campaign.totalFailed += failedCount;

    // Check if all recipients are sent
    const remainingPending = await this.emailRecipientRepository.count({
      where: {
        importSessionId: campaign.emailImportSessionId,
        sendStatus: 'pending',
      },
    });

    if (remainingPending === 0) {
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      this.logger.log(`Campaign ${campaignId} completed`);

      // Remove repeatable job when campaign is completed
      try {
        await this.campaignEmailQueue.removeRepeatableByKey(
          `${CAMPAIGN_EMAIL_SENDING}:campaign-${campaignId}:::0 1 * * *`,
        );
        this.logger.log(`Removed repeatable job for campaign ${campaignId}`);
      } catch (error) {
        this.logger.error(
          `Failed to remove repeatable job for campaign ${campaignId}: ${error.message}`,
        );
      }
    }

    await this.campaignRepository.save(campaign);

    this.logger.log(
      `Campaign ${campaignId}: sent ${sentCount}, failed ${failedCount}, remaining ${remainingPending}`,
    );

    return {
      sent: sentCount,
      failed: failedCount,
      remaining: remainingPending,
    };
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
}
