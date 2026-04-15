import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConfigureEmailDto {
  /** Resend API key — starts with re_... */
  @IsString()
  @MinLength(10)
  api_key: string;

  /** Verified sender email address registered in Resend */
  @IsEmail()
  from_email: string;

  /** Display name shown as the sender */
  @IsString()
  from_name: string;
}
