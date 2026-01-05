import { Exclude } from 'class-transformer';
import { EmailServiceProvider, AccountStatus } from '../../../entities/accounts.entity';

export class AccountResponseDto {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  provider: EmailServiceProvider;
  dailyLimit: number;
  sentToday: number;
  lastResetDate: Date | null;
  isActive: boolean;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  credentialsEncrypted: any;

  constructor(partial: Partial<AccountResponseDto>) {
    Object.assign(this, partial);
  }
}
