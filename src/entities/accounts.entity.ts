// src/email-accounts/entities/email-account.entity.ts
import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Campaign } from './campaigns.entity';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export enum EmailServiceProvider {
  BREVO = 'brevo',
  SENDGRID = 'sendgrid',
  MAILGUN = 'mailgun',
  AWS_SES = 'aws_ses',
}

export enum AccountStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  LIMIT_REACHED = 'limit_reached',
}

// Type definitions cho credentials của từng provider
export interface BrevoCredentials {
  api_key: string;
}

export interface SendGridCredentials {
  api_key: string;
}

export interface MailgunCredentials {
  api_key: string;
  domain: string;
  region?: 'us' | 'eu';
}

export interface AwsSesCredentials {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  from_email?: string;
}

export type EmailCredentials =
  | BrevoCredentials
  | SendGridCredentials
  | MailgunCredentials
  | AwsSesCredentials;

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

  @Column({ name: 'daily_limit', type: 'int', default: 300 })
  dailyLimit: number;

  @Column({ name: 'sent_today', type: 'int', default: 0 })
  sentToday: number;

  @Column({ name: 'last_reset_date', type: 'date', nullable: true })
  lastResetDate: Date;

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
      case EmailServiceProvider.BREVO:
        return credentials as BrevoCredentials;
      case EmailServiceProvider.SENDGRID:
        return credentials as SendGridCredentials;
      case EmailServiceProvider.MAILGUN:
        return credentials as MailgunCredentials;
      case EmailServiceProvider.AWS_SES:
        return credentials as AwsSesCredentials;
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }
}
