import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDto, CampaignStatus } from './create-campaign.dto';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  templateIds?: string[]; // Array of existing template IDs to link
}
