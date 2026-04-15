import { IsString, MinLength } from 'class-validator';

/**
 * ConfigureWhatsAppDto
 *
 * Payload required to link a Channel to a WhatsApp Business account.
 * The access_token will be encrypted before being persisted.
 */
export class ConfigureWhatsAppDto {
  /**
   * Meta System User or Permanent Token (starts with "EAA…").
   * Must be at least 10 characters.
   */
  @IsString()
  @MinLength(10)
  access_token: string;

  /**
   * WhatsApp Phone Number ID obtained from the Meta Developer dashboard.
   * Typically a 15-digit numeric string.
   */
  @IsString()
  @MinLength(5)
  phone_number_id: string;

  /**
   * WhatsApp Business Account (WABA) ID.
   * Found in Meta Business Manager → WhatsApp Accounts.
   */
  @IsString()
  @MinLength(5)
  waba_id: string;
}
