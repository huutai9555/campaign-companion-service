import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailImportSessionsService } from './email-import-sessions.service';
import { EmailImportSessionsController } from './email-import-sessions.controller';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { BullModule } from '@nestjs/bullmq';
import { EXCEL_IMPORT_PROCESSING } from 'src/constant/import-excel-sessions';
import { ExcelImportConsumer } from './email-import-sessions.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailImportSession, EmailRecipient]),
    BullModule.registerQueue({
      name: EXCEL_IMPORT_PROCESSING,
    }),
  ],
  controllers: [EmailImportSessionsController],
  providers: [EmailImportSessionsService, ExcelImportConsumer],
  exports: [EmailImportSessionsService],
})
export class EmailImportSessionsModule {}
