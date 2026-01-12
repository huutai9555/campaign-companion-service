import { IsNumberString, IsOptional } from 'class-validator';

export class PaginateDto {
  @IsOptional()
  @IsNumberString()
  page: number;

  @IsOptional()
  @IsNumberString()
  size: number;

  @IsOptional()
  filter: string;

  @IsOptional()
  select: string;

  @IsOptional()
  sort: string;

  @IsOptional()
  search?: string;
}
