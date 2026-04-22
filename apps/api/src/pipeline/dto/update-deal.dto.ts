import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Priority, DealStatus } from '../../../src/common/types/enums';

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  stage_id?: string;

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
  @IsEnum(DealStatus)
  status?: DealStatus;

  @IsOptional()
  @IsString()
  closing_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
