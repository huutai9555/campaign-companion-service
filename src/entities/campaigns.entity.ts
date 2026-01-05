// 3. CAMPAIGNS - Mỗi campaign thuộc về 1 import session
// src/campaigns/entities/campaign.entity.ts
import {
  Entity,
  Column,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './accounts.entity';
import { EmailImportSession } from './email-import-sessions.entity';
import { EmailTemplate } from './email-templates.entity';

@Entity('campaigns')
export class Campaign extends BaseEntity {
  @Column({ name: 'clerk_user_id' })
  clerkUserId: string;

  @Column()
  name: string;

  // === TÀI KHOẢN GỬI ===
  @ManyToMany(() => Account, (account) => account.campaigns)
  @JoinTable({
    name: 'campaign_email_accounts',
    joinColumn: { name: 'campaign_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'email_account_id', referencedColumnName: 'id' },
  })
  accounts: Account[];

  // === PHIÊN IMPORT (1 campaign có thể có hoặc không có import session) ===
  @Column({ name: 'email_import_session_id', nullable: true })
  emailImportSessionId: string;

  @ManyToOne(() => EmailImportSession, (session) => session.campaigns, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'email_import_session_id' })
  emailImportSession: EmailImportSession;

  // === NỘI DUNG EMAIL ===
  @OneToMany(() => EmailTemplate, (template) => template.campaign)
  templates: EmailTemplate[];

  // === LỊCH GỬI ===
  @Column({
    type: 'enum',
    enum: ['immediate', 'scheduled'],
    name: 'send_type',
  })
  sendType: string;

  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date;

  // === CÀI ĐẶT GỬI ===
  @Column({ name: 'delay_between_emails', type: 'int', default: 10 })
  delayBetweenEmails: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'retry_delay', type: 'int', default: 0 })
  retryDelay: number;

  // === TRẠNG THÁI ===
  @Column({
    type: 'enum',
    enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed'],
    default: 'draft',
  })
  status: string;

  @Column({ type: 'int', default: 0, name: 'total_recipients' })
  totalRecipients: number;

  @Column({ type: 'int', default: 0, name: 'total_sent' })
  totalSent: number;

  @Column({ type: 'int', default: 0, name: 'total_failed' })
  totalFailed: number;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date;
}
