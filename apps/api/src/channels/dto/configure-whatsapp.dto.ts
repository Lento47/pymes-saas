import { IsOptional, IsString, MinLength } from "class-validator";

export class ConfigureWhatsAppDto {
  /** Meta System User or Permanent Token — optional on edit (omit to keep existing) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  access_token?: string;

  /** Meta App Secret for webhook signature verification — optional on edit */
  @IsOptional()
  @IsString()
  app_secret?: string;

  @IsString()
  @MinLength(5)
  phone_number_id: string;

  @IsString()
  @MinLength(5)
  waba_id: string;
}
