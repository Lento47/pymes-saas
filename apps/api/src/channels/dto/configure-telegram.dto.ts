import { IsString } from 'class-validator';

export class ConfigureTelegramDto {
  @IsString()
  bot_token: string;
}
