import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsInt, Min, IsOptional, IsNotEmpty } from 'class-validator';
import { EmailCredentials } from 'src/entities/accounts.entity';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @IsInt()
  @Min(0)
  @IsOptional()
  sentToday?: number;

  @IsNotEmpty()
  credentials: EmailCredentials;

  @IsInt()
  @IsOptional()
  dailyLimit: number;

  @IsInt()
  @IsOptional()
  maxPerHour: number;

  @IsInt()
  @IsOptional()
  delayBetweenEmailsFrom?: number;

  @IsInt()
  @IsOptional()
  delayBetweenEmailsTo?: number;
}
