import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from 'src/entities/campaigns.entity';
import {
  DashboardResponseDto,
  DashboardStatsDto,
  CampaignSummaryDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async getStats(clerkUserId?: string): Promise<DashboardResponseDto> {
    const stats = await this.calculateStats(clerkUserId);
    const recentCampaigns = await this.getRecentCampaigns(clerkUserId);

    return {
      stats,
      recentCampaigns,
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
}
