export class DashboardStatsDto {
  // Tổng số email đã gửi (từ campaigns completed)
  totalEmailsSent: number;

  // Tổng số email đang gửi (từ campaigns running)
  totalEmailsSending: number;

  // Tổng số email thất bại (từ campaigns completed)
  totalEmailsFailed: number;

  // Tỷ lệ thành công (%)
  successRate: number;

  // Tỷ lệ thất bại (%)
  failureRate: number;

  // Số campaigns đã hoàn thành
  completedCampaigns: number;

  // Số campaigns đang chạy
  runningCampaigns: number;

  // Số campaigns draft
  draftCampaigns: number;
}

export class CampaignSummaryDto {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  successRate: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class DashboardResponseDto {
  stats: DashboardStatsDto;
  recentCampaigns: CampaignSummaryDto[];
}
