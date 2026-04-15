import { IsOptional, IsEnum, IsNumberString } from 'class-validator';
import { TriggerType } from '@prisma/client';

export class FilterAutomationsDto {
  @IsOptional()
  @IsEnum(['true', 'false'])
  enabled?: string;

  @IsOptional()
  @IsEnum(TriggerType)
  trigger_type?: TriggerType;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}
