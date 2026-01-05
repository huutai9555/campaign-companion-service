import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @IsInt()
  @Min(0)
  @IsOptional()
  sentToday?: number;

  @IsOptional()
  lastResetDate?: Date;
}
