import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class RecipientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
