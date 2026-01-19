// src/email-accounts/entities/email-account.entity.ts
import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Campaign } from './campaigns.entity';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export enum EmailServiceProvider {
  SMTP = 'smtp',
}

export enum AccountStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  LIMIT_REACHED = 'limit_reached',
  IN_USE = 'in_use',
}

// Type definitions cho credentials của từng provider
export interface SmtpCredentials {
  user: string;
  password: string;
}

export type EmailCredentials = SmtpCredentials;

@Entity('accounts')
export class Account extends BaseEntity {
  @Column({ name: 'clerk_user_id' })
  clerkUserId: string;

  @Column()
  name: string; // Tên tài khoản để nhận diện (VD: "Brevo Primary", "SendGrid Backup")

  @Column({ unique: true })
  email: string; // Email của tài khoản gửi

  @Column({
    type: 'varchar',
    enum: EmailServiceProvider,
  })
  provider: EmailServiceProvider;

  // Lưu encrypted credentials dạng JSONB
  @Column({ name: 'credentials_encrypted', type: 'jsonb' })
  private credentialsEncrypted: {
    iv: string;
    data: string;
  };

  @Column({ name: 'daily_limit', type: 'int', default: 500 })
  dailyLimit: number;

  @Column({ name: 'max_per_hour', type: 'int', default: 100 })
  maxPerHour: number;

  @Column({ name: 'delay_between_emails_from', type: 'int', default: 3000 }) // milliseconds
  delayBetweenEmailsFrom: number;

  @Column({ name: 'delay_between_emails_to', type: 'int', default: 5000 }) // milliseconds
  delayBetweenEmailsTo: number;

  @Column({ name: 'sent_today', type: 'int', default: 0 })
  sentToday: number;

  @Column({ name: 'sent_this_hour', type: 'int', default: 0 })
  sentThisHour: number;

  @Column({ name: 'last_reset_date', type: 'timestamp', nullable: true })
  lastResetDate: Date;

  @Column({ name: 'hour_started_at', type: 'timestamp', nullable: true })
  hourStartedAt: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    type: 'varchar',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @ManyToMany(() => Campaign, (campaign) => campaign.accounts)
  campaigns: Campaign[];

  // ============ ENCRYPTION METHODS ============

  /**
   * Set credentials (sẽ tự động encrypt)
   * @param credentials - Credentials object theo provider
   * @param encryptionKey - 32-byte hex key
   */
  setCredentials(credentials: EmailCredentials, encryptionKey: string): void {
    const algorithm = 'aes-256-cbc';

    const key = Buffer.from(encryptionKey, 'hex');
    const iv = randomBytes(16);

    const cipher = createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    this.credentialsEncrypted = {
      iv: iv.toString('hex'),
      data: encrypted,
    };
  }

  /**
   * Get decrypted credentials
   * @param encryptionKey - 32-byte hex key
   * @returns Decrypted credentials object
   */
  getCredentials<T extends EmailCredentials = EmailCredentials>(
    encryptionKey: string,
  ): T {
    const algorithm = 'aes-256-cbc';

    const key = Buffer.from(encryptionKey, 'hex');
    const iv = Buffer.from(this.credentialsEncrypted.iv, 'hex');

    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(
      this.credentialsEncrypted.data,
      'hex',
      'utf8',
    );
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as T;
  }

  /**
   * Check if account has credentials
   */
  hasCredentials(): boolean {
    return !!(
      this.credentialsEncrypted &&
      this.credentialsEncrypted.iv &&
      this.credentialsEncrypted.data
    );
  }

  /**
   * Get typed credentials based on provider
   */
  getTypedCredentials(encryptionKey: string): EmailCredentials {
    const credentials = this.getCredentials(encryptionKey);

    // Runtime validation based on provider
    switch (this.provider) {
      case EmailServiceProvider.SMTP:
        return credentials as SmtpCredentials;
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }
}
