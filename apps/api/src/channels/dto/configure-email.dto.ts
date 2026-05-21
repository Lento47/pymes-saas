import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class ConfigureEmailDto {
  /** Resend API key — starts with re_... — optional if SMTP is configured */
  @IsOptional()
  @IsString()
  @MinLength(10)
  api_key?: string;

  /** Verified sender email address */
  @IsEmail()
  from_email: string;

  /** Optional inbound mailbox used to route received emails to this channel */
  @IsOptional()
  @IsEmail()
  inbound_email?: string;

  /** Display name shown as the sender */
  @IsString()
  from_name: string;

  /** SMTP server hostname */
  @IsOptional()
  @IsString()
  smtp_host?: string;

  /** SMTP server port (default 587) */
  @IsOptional()
  @IsNumber()
  smtp_port?: number;

  /** SMTP username */
  @IsOptional()
  @IsString()
  smtp_user?: string;

  /** SMTP password (gets encrypted before storage) */
  @IsOptional()
  @IsString()
  smtp_password?: string;

  /** Use TLS/STARTTLS (default true) */
  @IsOptional()
  @IsBoolean()
  smtp_tls?: boolean;
}
