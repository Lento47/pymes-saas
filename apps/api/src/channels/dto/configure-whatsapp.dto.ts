import { IsOptional, IsString, MinLength } from 'class-validator';

export class ConfigureWhatsAppDto {
  /** Meta System User or Permanent Token — optional on edit (omit to keep existing) */
  @IsOptional()
  @IsString()
  @MinLength(10)
  access_token?: string;

  @IsString()
  @MinLength(5)
  phone_number_id: string;

  @IsString()
  @MinLength(5)
  waba_id: string;
}
