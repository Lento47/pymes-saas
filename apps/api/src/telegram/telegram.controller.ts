import { Controller, Post, Param, Body, Req } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('inbound/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook/:channelId')
  async webhook(
    @Param('channelId') channelId: string,
    @Body() update: any,
  ) {
    await this.telegramService.processUpdate(channelId, update);
    return { ok: true };
  }
}
