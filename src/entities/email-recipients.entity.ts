// 2. EMAIL RECIPIENTS - Thuộc về 1 import session
// src/email-recipients/entities/email-recipient.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { EmailImportSession } from './email-import-sessions.entity';

@Entity('email_recipients')
export class EmailRecipient extends BaseEntity {
  @Column({ name: 'clerk_user_id' })
  clerkUserId: string;

  @Column({ name: 'import_session_id', type: 'uuid' })
  importSessionId: string;

  @Column({ nullable: true })
  name: string; // Tên phiên

  @Column()
  email: string;

  @Column({ nullable: true })
  category: string; // Loại trang

  @Column({ nullable: true })
  address: string; // Địa chỉ

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
    name: 'send_status',
  })
  sendStatus: string;

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt: Date;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @ManyToOne(() => EmailImportSession, (session) => session.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'import_session_id' })
  emailImportSession: EmailImportSession;
}
