import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { CreateCampaignDto, CampaignStatus } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign } from 'src/entities/campaigns.entity';
import { Account } from 'src/entities/accounts.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { CAMPAIGN_EMAIL_SENDING } from 'src/constant/campaigns';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(EmailImportSession)
    private readonly emailImportSession: Repository<EmailImportSession>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipient: Repository<EmailRecipient>,
    private readonly emailProvidersService: EmailProvidersService,
    @InjectQueue(CAMPAIGN_EMAIL_SENDING)
    private readonly campaignEmailQueue: Queue,
  ) {}

  async create(
    createCampaignDto: CreateCampaignDto,
    user: any,
  ): Promise<Campaign> {
    // Verify accounts exist and belong to user
    const accounts = await this.accountRepository.find({
      where: {
        id: In(createCampaignDto.accountIds),
        clerkUserId: user.id,
      },
    });

    // Verify email exist and belong to user
    const emailImportSession = await this.emailImportSession.findOne({
      where: {
        id: createCampaignDto.emailImportSessionId,
        clerkUserId: user.id,
      },
    });

    if (!emailImportSession) {
      throw new BadRequestException('Not found import session');
    }

    if (accounts.length !== createCampaignDto.accountIds.length) {
      throw new BadRequestException(
        'One or more account IDs are invalid or do not belong to you',
      );
    }

    const recipientCount = await this.emailRecipient
      .createQueryBuilder('recipient')
      .where('recipient.import_session_id = :import_session_id', {
        import_session_id: emailImportSession.id,
      })
      .getCount();

    const campaign = this.campaignRepository.create({
      clerkUserId: user.id,
      name: createCampaignDto.name,
      sendType: createCampaignDto.sendType,
      scheduledAt: createCampaignDto.scheduledAt
        ? new Date(createCampaignDto.scheduledAt)
        : null,
      emailImportSession,
      emailImportSessionId: emailImportSession.id,
      delayBetweenEmails: createCampaignDto.delayBetweenEmails ?? 10,
      maxRetries: createCampaignDto.maxRetries ?? 3,
      retryDelay: createCampaignDto.retryDelay ?? 0,
      status: CampaignStatus.DRAFT,
      accounts,
      totalRecipients: recipientCount,
    });

    return this.campaignRepository.save(campaign);
  }

  async findAll(clerkUserId?: string): Promise<Campaign[]> {
    const query = this.campaignRepository
      .createQueryBuilder('campaign')
      .loadRelationCountAndMap('campaign.accountsCount', 'campaign.accounts')
      .leftJoinAndSelect('campaign.templates', 'templates')
      .leftJoinAndSelect('campaign.emailImportSession', 'emailImportSession')
      .leftJoin('emailImportSession.recipients', 'recipients');

    if (clerkUserId) {
      query.where('campaign.clerkUserId = :clerkUserId', { clerkUserId });
    }

    return query.orderBy('campaign.createdAt', 'DESC').getMany();
  }

  async getQueueReport(clerkUserId?: string): Promise<{
    statistics: {
      draftCount: number;
      scheduledCount: number;
      runningCount: number;
      estimatedCompletionDays: number | null;
    };
    campaigns: Campaign[];
  }> {
    const query = this.campaignRepository
      .createQueryBuilder('campaign')
      .loadRelationCountAndMap('campaign.accountsCount', 'campaign.accounts')
      .leftJoinAndSelect('campaign.accounts', 'accounts');

    if (clerkUserId) {
      query.where('campaign.clerkUserId = :clerkUserId', { clerkUserId });
    }

    const campaigns = await query
      .orderBy('campaign.createdAt', 'DESC')
      .getMany();

    // Count campaigns by status
    const draftCount = campaigns.filter(
      (c) => c.status === CampaignStatus.DRAFT,
    ).length;
    const scheduledCount = campaigns.filter(
      (c) => c.status === CampaignStatus.SCHEDULED,
    ).length;
    const runningCount = campaigns.filter(
      (c) => c.status === CampaignStatus.RUNNING,
    ).length;

    // Calculate estimated completion time for running campaigns
    let estimatedCompletionDays: number | null = null;
    const runningCampaigns = campaigns.filter(
      (c) => c.status === CampaignStatus.RUNNING,
    );

    if (runningCampaigns.length > 0) {
      let totalDaysRemaining = 0;

      for (const campaign of runningCampaigns) {
        const emailsRemaining = campaign.totalRecipients - campaign.totalSent;
        const accountCount = campaign.accounts?.length || 0;

        if (accountCount > 0 && emailsRemaining > 0) {
          const emailsPerDay = accountCount * 300; // Each account sends 300 emails per day
          const daysToComplete = Math.ceil(emailsRemaining / emailsPerDay);
          totalDaysRemaining += daysToComplete;
        }
      }

      // Average days to complete all running campaigns
      estimatedCompletionDays =
        runningCampaigns.length > 0
          ? Math.ceil(totalDaysRemaining / runningCampaigns.length)
          : null;
    }

    return {
      statistics: {
        draftCount,
        scheduledCount,
        runningCount,
        estimatedCompletionDays,
      },
      campaigns,
    };
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['accounts', 'templates', 'emailImportSession'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return campaign;
  }

  async update(
    id: string,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const campaign = await this.findOne(id);

    // Update basic fields
    if (updateCampaignDto.name) campaign.name = updateCampaignDto.name;
    if (updateCampaignDto.sendType)
      campaign.sendType = updateCampaignDto.sendType;
    if (updateCampaignDto.scheduledAt)
      campaign.scheduledAt = new Date(updateCampaignDto.scheduledAt);
    if (updateCampaignDto.delayBetweenEmails !== undefined)
      campaign.delayBetweenEmails = updateCampaignDto.delayBetweenEmails;
    if (updateCampaignDto.maxRetries !== undefined)
      campaign.maxRetries = updateCampaignDto.maxRetries;
    if (updateCampaignDto.retryDelay !== undefined)
      campaign.retryDelay = updateCampaignDto.retryDelay;
    if (updateCampaignDto.status) campaign.status = updateCampaignDto.status;

    // Update accounts if provided
    if (updateCampaignDto.accountIds) {
      const accounts = await this.accountRepository.find({
        where: {
          id: In(updateCampaignDto.accountIds),
          clerkUserId: campaign.clerkUserId,
        },
      });

      if (accounts.length !== updateCampaignDto.accountIds.length) {
        throw new BadRequestException(
          'One or more account IDs are invalid or do not belong to you',
        );
      }

      campaign.accounts = accounts;
    }

    return this.campaignRepository.save(campaign);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findOne(id);

    // Remove repeatable job if exists
    try {
      await this.campaignEmailQueue.removeRepeatableByKey(
        `${CAMPAIGN_EMAIL_SENDING}:campaign-${id}:::0 1 * * *`,
      );
    } catch (error) {
      // Job might not exist, ignore error
    }

    await this.campaignRepository.remove(campaign);
  }

  async start(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Campaign must be in draft or paused status to start. Current status: ${campaign.status}`,
      );
    }

    campaign.status = CampaignStatus.RUNNING;
    campaign.startedAt = new Date();

    // Add immediate job to run right away
    await this.campaignEmailQueue.add(
      `${CAMPAIGN_EMAIL_SENDING}-immediate`,
      { campaignId: id },
      {
        jobId: `campaign-${id}-immediate-${Date.now()}`,
      },
    );

    // Schedule repeatable job to run daily at 01:00 UTC (08:00 Vietnam time)
    await this.campaignEmailQueue.add(
      CAMPAIGN_EMAIL_SENDING,
      { campaignId: id },
      {
        repeat: {
          pattern: '0 1 * * *', // Cron: every day at 01:00 UTC
        },
        jobId: `campaign-${id}`, // Unique job ID to prevent duplicates
      },
    );

    return this.campaignRepository.save(campaign);
  }

  async pause(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Campaign must be running to pause');
    }

    campaign.status = CampaignStatus.PAUSED;

    // Remove repeatable job
    await this.campaignEmailQueue.removeRepeatableByKey(
      `${CAMPAIGN_EMAIL_SENDING}:campaign-${id}:::0 1 * * *`,
    );

    return this.campaignRepository.save(campaign);
  }

  async resume(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Campaign must be paused to resume');
    }

    campaign.status = CampaignStatus.RUNNING;

    // Add immediate job to run right away
    await this.campaignEmailQueue.add(
      `${CAMPAIGN_EMAIL_SENDING}-immediate`,
      { campaignId: id },
      {
        jobId: `campaign-${id}-immediate-${Date.now()}`,
      },
    );

    // Re-schedule repeatable job
    await this.campaignEmailQueue.add(
      CAMPAIGN_EMAIL_SENDING,
      { campaignId: id },
      {
        repeat: {
          pattern: '0 1 * * *', // Cron: every day at 01:00 UTC
        },
        jobId: `campaign-${id}`, // Unique job ID to prevent duplicates
      },
    );

    return this.campaignRepository.save(campaign);
  }

  async complete(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    campaign.status = CampaignStatus.COMPLETED;
    campaign.completedAt = new Date();

    return this.campaignRepository.save(campaign);
  }

  async sendTestEmail(campaignId: string, testEmail: string): Promise<any> {
    const campaign = await this.findOne(campaignId);

    if (!campaign.accounts || campaign.accounts.length === 0) {
      throw new BadRequestException('Campaign has no email accounts assigned');
    }

    if (!campaign.templates || campaign.templates.length === 0) {
      throw new BadRequestException('Campaign has no email templates');
    }

    // Get active template
    const activeTemplate = campaign.templates.find((t) => t.isActive);
    if (!activeTemplate) {
      throw new BadRequestException('Campaign has no active email template');
    }

    // Use first available account
    const account = campaign.accounts[0];

    // Send email using EmailProvidersService
    const result = await this.emailProvidersService.sendEmail(account, {
      to: testEmail,
      subject: activeTemplate.subject,
      htmlContent: activeTemplate.content,
    });

    return result;
  }
}
