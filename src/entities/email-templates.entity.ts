// 3. EMAIL TEMPLATES TABLE - Nội dung email có nhiều phiên bản
// src/email-templates/entities/email-template.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Campaign } from './campaigns.entity';

@Entity('email_templates')
export class EmailTemplate extends BaseEntity {
  @Column({ name: 'campaign_id' })
  campaignId: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number; // Phiên bản 1, 2, 3...

  @Column()
  subject: string; // Tiêu đề email

  @Column({ type: 'text' })
  content: string; // Nội dung email (HTML/Plain text)

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean; // Template đang được dùng

  @ManyToOne(() => Campaign, (campaign) => campaign.templates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;
}
