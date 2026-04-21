import { IsDateString, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateErrorReportDto {
  @IsString()
  @MaxLength(50)
  source!: string;

  @IsString()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  method?: string;

  @IsOptional()
  @IsInt()
  status_code?: number;

  @IsOptional()
  @IsString()
  user_agent?: string;

  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @IsOptional()
  @IsObject()
  context_json?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  workspace_slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  client_user_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  client_user_email?: string;
}
