import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { EXCEL_IMPORT_PROCESSING } from 'src/constant/import-excel-sessions';
import { Queue } from 'bullmq';
import { ImportExcelDto } from './dto/import-excel.dto';
import { EmailRecipient } from 'src/entities/email-recipients.entity';

@Injectable()
export class EmailImportSessionsService {
  constructor(
    @InjectRepository(EmailImportSession)
    private readonly emailImportSessionRepository: Repository<EmailImportSession>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipient: Repository<EmailRecipient>,
    @InjectQueue(EXCEL_IMPORT_PROCESSING) private importExcelQueue: Queue,
  ) {}

  async findAllByUserId(userId: string): Promise<EmailImportSession[]> {
    return this.emailImportSessionRepository
      .createQueryBuilder('session')
      .loadRelationCountAndMap('session.recipientCount', 'session.recipients')
      .where('session.clerkUserId = :userId', { userId })
      .orderBy('session.createdAt', 'DESC')
      .getMany();
    // .loadRelationCountAndMap(
    //   'session.pendingCount',
    //   'session.recipients',
    //   'recipient',
    //   (qb) =>
    //     qb.where('recipient.sendStatus = :status', { status: 'pending' }),
    // )
    // .loadRelationCountAndMap(
    //   'session.sentCount',
    //   'session.recipients',
    //   'recipient',
    //   (qb) => qb.where('recipient.sendStatus = :status', { status: 'sent' }),
    // )
    // .loadRelationCountAndMap(
    //   'session.failedCount',
    //   'session.recipients',
    //   'recipient',
    //   (qb) =>
    //     qb.where('recipient.sendStatus = :status', { status: 'failed' }),
    // )
  }

  async importExcelProcess(importExcelDto: ImportExcelDto, user: any) {
    try {
      await this.importExcelQueue.add(
        EXCEL_IMPORT_PROCESSING,
        { importExcelDto, user },
        {
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (error) {
      console.error('Error adding job to the queue:', error);
    }
  }
}
