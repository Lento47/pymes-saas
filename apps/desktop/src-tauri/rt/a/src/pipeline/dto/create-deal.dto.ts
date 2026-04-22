import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateDealDto {
  @IsString()
  stage_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  contact_id?: string;

  @IsOptional()
  @IsString()
  assigned_user_id?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  closing_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
