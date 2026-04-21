import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsLocale,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
} from 'class-validator';
import { WorkspaceStatus } from '@prisma/client';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country_code?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsLocale()
  locale?: string;

  @IsOptional()
  @IsEnum(WorkspaceStatus)
  status?: WorkspaceStatus;

  @IsOptional()
  @IsBoolean()
  ai_message_finance_opt_in?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['openai', 'anthropic', 'gemini', 'moonshot'])
  ai_provider?: string;

  @IsOptional()
  @IsString()
  ai_api_key?: string;

  @IsOptional()
  @IsString()
  ai_model?: string;
}
