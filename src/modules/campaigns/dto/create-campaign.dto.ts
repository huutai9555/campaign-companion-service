import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  ArrayMinSize,
} from 'class-validator';

export enum SendType {
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  accountIds: string[]; // Array of account IDs to use for sending

  @IsString()
  emailImportSessionId: string;

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  templateIds: string[]; // Array of existing template IDs to link

  @IsEnum(SendType)
  @IsNotEmpty()
  sendType: SendType;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
