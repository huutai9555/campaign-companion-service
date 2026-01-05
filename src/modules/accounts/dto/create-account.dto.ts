import {
  IsString,
  IsEnum,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsEmail,
} from 'class-validator';
import {
  EmailServiceProvider,
  EmailCredentials,
  AccountStatus,
} from '../../../entities/accounts.entity';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(EmailServiceProvider)
  @IsNotEmpty()
  provider: EmailServiceProvider;

  @IsNotEmpty()
  credentials: EmailCredentials;

  @IsInt()
  @Min(1)
  @IsOptional()
  dailyLimit?: number;

  @IsOptional()
  isActive?: boolean;

  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;
}
