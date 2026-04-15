import {
  IsEnum,
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
}
