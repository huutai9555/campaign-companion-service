import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDto, CampaignStatus } from './create-campaign.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;
}
