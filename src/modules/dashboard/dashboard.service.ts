import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from 'src/entities/campaigns.entity';
import {
  DashboardResponseDto,
  DashboardStatsDto,
  CampaignSummaryDto,
  DailyEmailStatsDto,
  AccountInQueueDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async getStats(clerkUserId: string): Promise<DashboardResponseDto> {
    const [stats, recentCampaigns, dailyEmailStats, accountsInQueue] =
      await Promise.all([
        this.calculateStats(clerkUserId),
        this.getRecentCampaigns(clerkUserId),
        this.getDailyEmailStats(clerkUserId),
        this.getAccountsInQueue(clerkUserId),
      ]);

    return {
      stats,
      recentCampaigns,
      dailyEmailStats,
      accountsInQueue,
    };
  }

  private async calculateStats(
    clerkUserId?: string,
  ): Promise<DashboardStatsDto> {
    // Build base query
    const queryBuilder = this.campaignRepository.createQueryBuilder('campaign');

    if (clerkUserId) {
      queryBuilder.where('campaign.clerkUserId = :clerkUserId', {
        clerkUserId,
      });
    }

    // Get all campaigns
    const campaigns = await queryBuilder.getMany();

    // Filter by status
    const completedCampaigns = campaigns.filter(
      (c) => c.status === 'completed',
    );
    const runningCampaigns = campaigns.filter((c) => c.status === 'running');
    const draftCampaigns = campaigns.filter((c) => c.status === 'draft');

    // Calculate totals from completed campaigns
    const totalEmailsSent = completedCampaigns.reduce(
      (sum, c) => sum + c.totalSent,
      0,
    );
    const totalEmailsFailed = completedCampaigns.reduce(
      (sum, c) => sum + c.totalFailed,
      0,
    );

    // Calculate sending from running campaigns
    const totalEmailsSending = runningCampaigns.reduce(
      (sum, c) => sum + (c.totalRecipients - c.totalSent - c.totalFailed),
      0,
    );

    // Calculate rates
    const totalProcessed = totalEmailsSent + totalEmailsFailed;
    const successRate =
      totalProcessed > 0
        ? Math.round((totalEmailsSent / totalProcessed) * 100 * 100) / 100
        : 0;
    const failureRate =
      totalProcessed > 0
        ? Math.round((totalEmailsFailed / totalProcessed) * 100 * 100) / 100
        : 0;

    return {
      totalEmailsSent,
      totalEmailsSending,
      totalEmailsFailed,
      successRate,
      failureRate,
      completedCampaigns: completedCampaigns.length,
      runningCampaigns: runningCampaigns.length,
      draftCampaigns: draftCampaigns.length,
    };
  }

  private async getRecentCampaigns(
    clerkUserId?: string,
    limit = 10,
  ): Promise<CampaignSummaryDto[]> {
    const queryBuilder = this.campaignRepository
      .createQueryBuilder('campaign')
      .orderBy('campaign.createdAt', 'DESC')
      .take(limit);

    if (clerkUserId) {
      queryBuilder.where('campaign.clerkUserId = :clerkUserId', {
        clerkUserId,
      });
    }

    const campaigns = await queryBuilder.getMany();

    return campaigns.map((campaign) => {
      const totalProcessed = campaign.totalSent + campaign.totalFailed;
      const successRate =
        totalProcessed > 0
          ? Math.round((campaign.totalSent / totalProcessed) * 100 * 100) / 100
          : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        totalSent: campaign.totalSent,
        totalFailed: campaign.totalFailed,
        successRate,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      };
    });
  }

  async getStatsByDateRange(
    clerkUserId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DashboardStatsDto> {
    const queryBuilder = this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: 'completed' });

    if (clerkUserId) {
      queryBuilder.andWhere('campaign.clerkUserId = :clerkUserId', {
        clerkUserId,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('campaign.completedAt >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('campaign.completedAt <= :endDate', { endDate });
    }

    const campaigns = await queryBuilder.getMany();

    const totalEmailsSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0);
    const totalEmailsFailed = campaigns.reduce(
      (sum, c) => sum + c.totalFailed,
      0,
    );
    const totalProcessed = totalEmailsSent + totalEmailsFailed;

    const successRate =
      totalProcessed > 0
        ? Math.round((totalEmailsSent / totalProcessed) * 100 * 100) / 100
        : 0;
    const failureRate =
      totalProcessed > 0
        ? Math.round((totalEmailsFailed / totalProcessed) * 100 * 100) / 100
        : 0;

    return {
      totalEmailsSent,
      totalEmailsSending: 0,
      totalEmailsFailed,
      successRate,
      failureRate,
      completedCampaigns: campaigns.length,
      runningCampaigns: 0,
      draftCampaigns: 0,
    };
  }

  // Thống kê email gửi theo ngày trong 7 ngày gần nhất (từ completed campaigns)
  private async getDailyEmailStats(
    clerkUserId?: string,
  ): Promise<DailyEmailStatsDto[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const queryBuilder = this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: 'completed' })
      .andWhere('campaign.completedAt >= :startDate', {
        startDate: sevenDaysAgo,
      });

    if (clerkUserId) {
      queryBuilder.andWhere('campaign.clerkUserId = :clerkUserId', {
        clerkUserId,
      });
    }

    const campaigns = await queryBuilder.getMany();

    // Group by date
    const dailyStatsMap = new Map<string, { sent: number; failed: number }>();

    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStatsMap.set(dateKey, { sent: 0, failed: 0 });
    }

    // Aggregate campaigns by completedAt date
    for (const campaign of campaigns) {
      if (campaign.completedAt) {
        const dateKey = campaign.completedAt.toISOString().split('T')[0];
        const existing = dailyStatsMap.get(dateKey);
        if (existing) {
          existing.sent += campaign.totalSent;
          existing.failed += campaign.totalFailed;
        }
      }
    }

    // Convert to array and sort by date ascending
    const result: DailyEmailStatsDto[] = [];
    for (const [date, stats] of dailyStatsMap) {
      result.push({
        date,
        sent: stats.sent,
        failed: stats.failed,
        totalSent: stats.sent + stats.failed,
      });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Danh sách accounts đang trong running campaigns
  private async getAccountsInQueue(
    clerkUserId?: string,
  ): Promise<AccountInQueueDto[]> {
    const queryBuilder = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.accounts', 'account')
      .where('campaign.status = :status', { status: 'running' });

    if (clerkUserId) {
      queryBuilder.andWhere('campaign.clerkUserId = :clerkUserId', {
        clerkUserId,
      });
    }

    const runningCampaigns = await queryBuilder.getMany();

    const result: AccountInQueueDto[] = [];

    for (const campaign of runningCampaigns) {
      if (campaign.accounts) {
        for (const account of campaign.accounts) {
          result.push({
            accountEmail: account.email,
            campaignId: campaign.id,
            campaignName: campaign.name,
          });
        }
      }
    }

    return result;
  }
}
