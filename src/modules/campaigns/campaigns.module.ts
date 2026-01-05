import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign } from 'src/entities/campaigns.entity';
import { Account } from 'src/entities/accounts.entity';
import { EmailProvidersService } from 'src/providers/email-providers.service';
import { EmailImportSession } from 'src/entities/email-import-sessions.entity';
import { EmailRecipient } from 'src/entities/email-recipients.entity';
import { EmailTemplate } from 'src/entities/email-templates.entity';
import { CAMPAIGN_EMAIL_SENDING } from 'src/constant/campaigns';
import { CampaignEmailConsumer } from './campaigns.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      Account,
      EmailImportSession,
      EmailRecipient,
      EmailTemplate,
    ]),
    BullModule.registerQueue({
      name: CAMPAIGN_EMAIL_SENDING,
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, EmailProvidersService, CampaignEmailConsumer],
  exports: [CampaignsService],
})
export class CampaignsModule {}
