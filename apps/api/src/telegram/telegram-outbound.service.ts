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

  async sendTyping(channelId: string, chatId: string): Promise<void> {
    const token = await this.getBotToken(channelId);
    if (!token) return;
    try {
      const bot = new Telegraf(token);
      await bot.telegram.sendChatAction(chatId, "typing");
    } catch {
      // Best-effort
    }
  }

  async editMessage(channelId: string, chatId: string, messageId: string | number, newText: string): Promise<void> {
    const token = await this.getBotToken(channelId);
    if (!token) return;
    try {
      const bot = new Telegraf(token);
      await bot.telegram.editMessageText(chatId, Number(messageId), undefined, newText, { parse_mode: "HTML" });
    } catch (err) {
      this.logger.warn(`editMessage failed for msg ${messageId}: ${(err as Error).message}`);
    }
  }

  async sendReplyText(
    channelId: string,
    chatId: string,
    text: string,
    replyToMessageId: string | null,
  ): Promise<{ message_id: string }> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    const bot = new Telegraf(token);
    const result = await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "HTML",
      ...(replyToMessageId
        ? { reply_parameters: { message_id: Number(replyToMessageId) } }
        : {}),
    });
    return { message_id: String(result.message_id) };
  }

  async sendWithInlineKeyboard(
    channelId: string,
    chatId: string,
    text: string,
    buttons: Array<{ id: string; title: string }>,
    replyToMessageId?: string | null,
  ): Promise<{ message_id: string }> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    const bot = new Telegraf(token);
    const inlineKeyboard = buttons.map((b) => [
      { text: b.title, callback_data: b.title.slice(0, 64) },
    ]);
    const result = await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
      ...(replyToMessageId
        ? { reply_parameters: { message_id: Number(replyToMessageId) } }
        : {}),
    });
    return { message_id: String(result.message_id) };
  }

  async sendListAsKeyboard(
    channelId: string,
    chatId: string,
    text: string,
    rows: Array<{ id: string; title: string }>,
    replyToMessageId?: string | null,
  ): Promise<{ message_id: string }> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    const bot = new Telegraf(token);
    const inlineKeyboard = rows.slice(0, 8).map((r) => [
      { text: r.title, callback_data: r.title.slice(0, 64) },
    ]);
    const result = await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
      ...(replyToMessageId
        ? { reply_parameters: { message_id: Number(replyToMessageId) } }
        : {}),
    });
    return { message_id: String(result.message_id) };
  }
}
