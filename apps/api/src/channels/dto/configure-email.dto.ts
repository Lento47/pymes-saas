import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class ConfigureEmailDto {
  /** Resend API key — starts with re_... — optional on edit (omit to keep existing) */
  @IsOptional()
  @IsString()
  @MinLength(10)
  api_key?: string;

  /** Verified sender email address registered in Resend */
  @IsEmail()
  from_email: string;

  /** Display name shown as the sender */
  @IsString()
  from_name: string;
}
