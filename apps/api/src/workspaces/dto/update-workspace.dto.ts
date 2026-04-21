import {
  IsBooleanString,
  IsBoolean,
  IsEnum,
  IsLocale,
  IsOptional,
  IsString,
  ValidateNested,
  IsTimeZone,
  Length,
} from 'class-validator';
import { WorkspaceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { WorkspaceTaxProfileDto } from './workspace-tax-profile.dto';

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
  openai_api_key?: string;

  @IsOptional()
  @IsString()
  resend_api_key?: string;

  @IsOptional()
  @IsString()
  anthropic_api_key?: string;

  @IsOptional()
  @IsString()
  gemini_api_key?: string;

  @IsOptional()
  @IsString()
  grok_api_key?: string;

  @IsOptional()
  @IsString()
  kimi_api_key?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  hacienda_environment?: string;

  @IsOptional()
  @IsString()
  hacienda_username?: string;

  @IsOptional()
  @IsString()
  hacienda_password?: string;

  @IsOptional()
  @IsString()
  hacienda_client_id?: string;

  @IsOptional()
  @IsString()
  hacienda_token_url?: string;

  @IsOptional()
  @IsString()
  hacienda_access_token?: string;

  @IsOptional()
  @IsString()
  hacienda_callback_url?: string;

  @IsOptional()
  @IsString()
  hacienda_certificate_path?: string;

  @IsOptional()
  @IsString()
  hacienda_certificate_pin?: string;

  @IsOptional()
  @IsBooleanString()
  hacienda_signing_enabled?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceTaxProfileDto)
  tax_profile?: WorkspaceTaxProfileDto;
}
