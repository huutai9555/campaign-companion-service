// src/email-recipients/entities/email-recipient.entity.ts
import { Entity, Column, OneToMany } from 'typeorm';
import { Campaign } from './campaigns.entity';
import { EmailRecipient } from './email-recipients.entity';
import { BaseEntity } from './base.entity';

@Entity('email_import_sessions')
export class EmailImportSession extends BaseEntity {
  @Column({ name: 'clerk_user_id' })
  clerkUserId: string;

  @Column({ nullable: true })
  name: string; // Tên phiên

  @Column({ name: 'file_name' })
  fileName: string; // Tên file Excel

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean; // Đã được sử dụng trong campaign chưa

  @OneToMany(() => EmailRecipient, (recipient) => recipient.emailImportSession)
  recipients: EmailRecipient[];

  @OneToMany(() => Campaign, (campaign) => campaign.emailImportSession)
  campaigns: Campaign[];
}
