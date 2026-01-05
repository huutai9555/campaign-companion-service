import { SendType, CampaignStatus } from './create-campaign.dto';

export class CampaignResponseDto {
  id: string;
  clerkUserId: string;
  name: string;
  sendType: SendType;
  scheduledAt: Date | null;
  delayBetweenEmails: number;
  maxRetries: number;
  retryDelay: number;
  status: CampaignStatus;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CampaignResponseDto>) {
    Object.assign(this, partial);
  }
}
