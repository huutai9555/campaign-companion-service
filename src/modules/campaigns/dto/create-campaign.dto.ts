import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  ArrayMinSize,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

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

// Template variant classes
export class TemplateVariantDto {
  @IsString()
  id: string;

  @IsString()
  content: string;
}

export class CampaignTemplatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariantDto)
  subjectVariants: TemplateVariantDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariantDto)
  bodyVariants: TemplateVariantDto[];
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

  @IsEnum(SendType)
  @IsNotEmpty()
  sendType: SendType;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  // Templates with subject and body variants
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignTemplatesDto)
  templates?: CampaignTemplatesDto;
}
