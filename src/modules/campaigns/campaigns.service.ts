import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker } from 'bullmq';

import { CreateCampaignDto, CampaignStatus } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign } from 'src/entities/campaigns.entity';
import { Account, AccountStatus } from 'src/entities/accounts.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { EmailTemplate } from 'src/entities/email-templates.entity';
import { CAMPAIGN_EMAIL_SENDING } from 'src/constant/campaigns';
import { PaginateDto } from 'src/shared/dto/paginate.dto';
import { QueryBuilder } from 'src/helpers/query-builder';
import { Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class CampaignsService {
  private worker: Worker;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(EmailImportSession)
    private readonly emailImportSession: Repository<EmailImportSession>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipient: Repository<EmailRecipient>,
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
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

    // Verify templates exist and belong to user
    const templates = await this.emailTemplateRepository.find({
      where: {
        id: In(createCampaignDto.templateIds),
        clerkUserId: user.id,
      },
    });

    if (templates.length !== createCampaignDto.templateIds.length) {
      throw new BadRequestException(
        'One or more template IDs are invalid or do not belong to you',
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
      status: CampaignStatus.DRAFT,
      accounts,
      totalRecipients: recipientCount,
    });

    accounts.forEach((account) => {
      account.status = AccountStatus.IN_USE;
    });
    await this.accountRepository.save(accounts);

    // Mark email import session as used
    emailImportSession.isUsed = true;
    await this.emailImportSession.save(emailImportSession);

    // Link templates to campaign (ManyToMany)
    campaign.templates = templates;

    const savedCampaign = await this.campaignRepository.save(campaign);

    return savedCampaign;
  }

  async findAll(
    clerkUserId: string,
    params: PaginateDto,
  ): Promise<Campaign[] | Pagination<Campaign>> {
    const { filter, size, sort, page } = params;
    const queryBuilder = new QueryBuilder();
    const query = this.campaignRepository
      .createQueryBuilder('campaign')
      .loadRelationCountAndMap('campaign.accountsCount', 'campaign.accounts')
      .leftJoinAndSelect('campaign.templates', 'templates')
      .leftJoinAndSelect('campaign.emailImportSession', 'emailImportSession')
      .leftJoin('emailImportSession.recipients', 'recipients');

    if (clerkUserId) {
      query.where('campaign.clerkUserId = :clerkUserId', { clerkUserId });
    }

    if (filter) {
      query.andWhere(queryBuilder.whereBuilder(JSON.parse(filter), 'campaign'));
    }

    if (sort) {
      queryBuilder.buildOrderBy(query, JSON.parse(sort), 'campaign');
    }

    if (size) {
      // Use countQueries: false to prevent wrong count due to leftJoin multiplying rows
      // Then manually count distinct campaigns
      const totalItems = await this.campaignRepository
        .createQueryBuilder('campaign')
        .where('campaign.clerkUserId = :clerkUserId', { clerkUserId })
        .getCount();

      const items = await query
        .skip((page - 1) * size)
        .take(size)
        .getMany();

      return {
        items,
        meta: {
          totalItems,
          itemCount: items.length,
          itemsPerPage: size,
          totalPages: Math.ceil(totalItems / size),
          currentPage: page,
        },
      };
    }

    return await query.getMany();
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

    // Handle templates update (ManyToMany - just replace the relation)
    if (updateCampaignDto.templateIds) {
      const newTemplates = await this.emailTemplateRepository.find({
        where: {
          id: In(updateCampaignDto.templateIds),
          clerkUserId: campaign.clerkUserId,
        },
      });

      if (newTemplates.length !== updateCampaignDto.templateIds.length) {
        throw new BadRequestException(
          'One or more template IDs are invalid or do not belong to you',
        );
      }

      campaign.templates = newTemplates;
    }

    return this.campaignRepository.save(campaign);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findOne(id);

    // Remove any pending/delayed jobs for this campaign
    try {
      const delayedJobs = await this.campaignEmailQueue.getDelayed();
      const waitingJobs = await this.campaignEmailQueue.getWaiting();

      const allJobs = [...delayedJobs, ...waitingJobs];
      for (const job of allJobs) {
        if (job.data?.campaignId === id) {
          await job.remove();
        }
      }
    } catch (error) {
      // Jobs might not exist, ignore error
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
        jobId: `campaign-${id}-immediate-${campaign.startedAt}`,
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

    try {
      const delayedJobs = await this.campaignEmailQueue.getDelayed();
      const waitingJobs = await this.campaignEmailQueue.getWaiting();
      const allJobs = [...delayedJobs, ...waitingJobs];
      for (const job of allJobs) {
        if (job.data?.campaignId === id) {
          await job.remove();
        }
      }
    } catch (error) {
      // Jobs might not exist, ignore error
    }

    return this.campaignRepository.save(campaign);
  }

  async resume(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Campaign must be paused to resume');
    }

    campaign.status = CampaignStatus.RUNNING;
    campaign.startedAt = new Date();

    // Add immediate job to run right away
    await this.campaignEmailQueue.add(
      `${CAMPAIGN_EMAIL_SENDING}-immediate`,
      { campaignId: id },
      {
        jobId: `campaign-${id}-immediate-${campaign.startedAt}`,
      },
    );

    return this.campaignRepository.save(campaign);
  }

  async complete(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.accounts', 'accounts')
      .where('campaign.id = :id', { id })
      .getOne();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    campaign.accounts.forEach((account) => {
      account.status = AccountStatus.ACTIVE;
    });

    // Remove any pending/delayed jobs for this campaign
    try {
      const delayedJobs = await this.campaignEmailQueue.getDelayed();
      const waitingJobs = await this.campaignEmailQueue.getWaiting();
      const currentJob = await this.campaignEmailQueue.getJob(
        `campaign-${campaign.id}-immediate-${campaign.startedAt}`,
      );
      await currentJob.remove();

      const allJobs = [...delayedJobs, ...waitingJobs];
      for (const job of allJobs) {
        if (job.data?.campaignId === id) {
          await job.remove();
        }
      }
    } catch (error) {
      // Jobs might not exist, ignore error
    }

    campaign.status = CampaignStatus.COMPLETED;
    campaign.completedAt = new Date();
    await this.accountRepository.save(campaign.accounts);

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

    // Use first template
    const template = campaign.templates[0];

    // Use first available account
    const account = campaign.accounts[0];

    // Send email using EmailProvidersService
    const result = await this.emailProvidersService.sendEmail(account, {
      to: testEmail,
      subject: template.subject,
      htmlContent: template.content,
    });

    return result;
  }
}
