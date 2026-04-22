import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { TriggerType } from '@prisma/client';

export class CreateAutomationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TriggerType)
  trigger_type: TriggerType;

  @IsObject()
  trigger_config_json: object;

  @IsOptional()
  @IsObject()
  condition_config_json?: object;

  @IsObject()
  action_config_json: object;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}
