import { RoutingMatchType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateRoutingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  channel_id?: string | null;

  @IsOptional()
  @IsEnum(RoutingMatchType)
  match_type?: RoutingMatchType;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
