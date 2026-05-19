import { Controller, Post, Param, Body, Req, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { TelegramService } from './telegram.service';

@Controller('inbound/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook/:channelId')
  @HttpCode(200)
  async webhook(
    @Param('channelId') channelId: string,
    @Body() update: Record<string, unknown>,
    @Req() req: Request,
  ) {
    // Verify Telegram secret token BEFORE processing — if invalid, return 401
    // so Telegram retries the delivery rather than silently discarding it.
    const isValid = await this.telegramService.validateWebhookSecret(
      channelId,
      req.headers['x-telegram-bot-api-secret-token'] as string | undefined,
    );

    if (!isValid) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    await this.telegramService.processUpdate(channelId, update);
    return { ok: true };
  }
}
