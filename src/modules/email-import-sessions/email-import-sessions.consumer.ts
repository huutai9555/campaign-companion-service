import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EXCEL_IMPORT_PROCESSING } from 'src/constant/import-excel-sessions';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { ImportExcelDto } from './dto';

@Processor(EXCEL_IMPORT_PROCESSING)
export class ExcelImportConsumer extends WorkerHost {
  constructor(
    @InjectRepository(EmailImportSession)
    private readonly emailImportSessionRepository: Repository<EmailImportSession>,
    @InjectRepository(EmailRecipient)
    private readonly emailRecipientRepository: Repository<EmailRecipient>,
  ) {
    super();
  }

  async process(
    job: Job<{ importExcelDto: ImportExcelDto; user: any }, any, string>,
  ): Promise<any> {
    const { importExcelDto, user } = job.data;

    // Tạo EmailImportSession
    const emailImportSession = this.emailImportSessionRepository.create({
      clerkUserId: user.id,
      name: importExcelDto.name,
      fileName: importExcelDto.fileName,
    });

    const savedSession =
      await this.emailImportSessionRepository.save(emailImportSession);

    // Tạo các EmailRecipient
    const recipientsData = importExcelDto.recipients;
    const BATCH_SIZE = 500; // Chia nhỏ để tránh quá tải parameters
    let totalSaved = 0;

    // Chia nhỏ và save theo batch
    for (let i = 0; i < recipientsData.length; i += BATCH_SIZE) {
      const batch = recipientsData.slice(i, i + BATCH_SIZE);
      const recipients = batch.map((recipient) =>
        this.emailRecipientRepository.create({
          clerkUserId: user.id,
          importSessionId: savedSession.id,
          name: recipient.name,
          email: recipient.email,
          category: recipient.category || null,
          address: recipient.address || null,
          sendStatus: 'pending',
          sentAt: null,
          retryCount: 0,
          errorMessage: null,
        }),
      );

      await this.emailRecipientRepository.save(recipients);
      totalSaved += recipients.length;
      console.log(
        `Saved batch ${Math.floor(i / BATCH_SIZE) + 1}: ${recipients.length} recipients`,
      );
    }

    console.log(
      `Created EmailImportSession ${savedSession.id} with ${totalSaved} recipients`,
    );

    return {
      sessionId: savedSession.id,
      recipientCount: totalSaved,
    };
  }
}
