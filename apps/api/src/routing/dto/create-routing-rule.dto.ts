import { RoutingMatchType, Priority } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRoutingRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  channel_id?: string;

  @IsOptional()
  @IsEnum(RoutingMatchType)
  match_type?: RoutingMatchType;

  @IsString()
  pattern: string;

  @IsString()
  department_id: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(Priority)
  set_priority?: Priority;
}
