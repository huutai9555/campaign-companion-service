// 3. EMAIL TEMPLATES TABLE - Nội dung email có nhiều phiên bản
// src/email-templates/entities/email-template.entity.ts
import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Campaign } from './campaigns.entity';

@Entity('email_templates')
export class EmailTemplate extends BaseEntity {
  @Column({ name: 'clerk_user_id' })
  clerkUserId: string;

  @Column()
  name: string; // Tên template để dễ nhận diện

  @Column()
  subject: string; // Tiêu đề email

  @Column({ type: 'text' })
  content: string; // Nội dung email (HTML/Plain text)

  // === CAMPAIGNS - ManyToMany (1 template có thể dùng cho nhiều campaigns) ===
  @ManyToMany(() => Campaign, (campaign) => campaign.templates)
  campaigns: Campaign[];
}
