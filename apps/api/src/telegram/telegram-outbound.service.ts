import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Telegraf } from "telegraf";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";

@Injectable()
export class TelegramOutboundService {
  private readonly logger = new Logger(TelegramOutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async getBotToken(channelId: string): Promise<string | null> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: "TELEGRAM", status: "ACTIVE" },
      select: { config_json: true },
    });

    if (!channel?.config_json) return null;

    const cfg = channel.config_json as Record<string, any>;
    return cfg.bot_token_encrypted
      ? this.crypto.decrypt(cfg.bot_token_encrypted)
      : cfg.bot_token ?? null;
  }

  async sendMessage(channelId: string, chatId: string, text: string): Promise<any> {
    if (!text || !chatId) {
      throw new BadRequestException("Missing text or chatId");
    }

    const token = await this.getBotToken(channelId);
    if (!token) {
      throw new NotFoundException("No bot token configured");
    }

    try {
      const bot = new Telegraf(token);
      const result = await bot.telegram.sendMessage(chatId, text, {
        parse_mode: "HTML",
      });
      this.logger.log(`Message sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send Telegram message: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send Telegram message: ${(err as Error).message}`);
    }
  }
}
