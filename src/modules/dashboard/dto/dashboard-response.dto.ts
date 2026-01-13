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

// Thống kê email theo ngày (7 ngày gần nhất)
export class DailyEmailStatsDto {
  date: string; // YYYY-MM-DD
  sent: number;
  failed: number;
  totalSent: number;
}

// Thống kê hàng đợi gửi - danh sách accounts đang trong running campaigns
export class AccountInQueueDto {
  accountEmail: string;
  campaignId: string;
  campaignName: string;
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
  dailyEmailStats: DailyEmailStatsDto[]; // Thống kê 7 ngày gần nhất
  accountsInQueue: AccountInQueueDto[]; // Danh sách accounts đang trong running campaigns
}
