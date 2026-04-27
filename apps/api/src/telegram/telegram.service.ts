import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bots = new Map<string, Telegraf>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messagesService: MessagesService,
    private readonly config: ConfigService,
  ) {}

  async registerWebhook(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId, type: 'TELEGRAM' },
      select: { config_json: true, id: true },
    });

    if (!channel?.config_json) return;

    const cfg = channel.config_json as any;
    const token = cfg.bot_token_enc
      ? this.crypto.decrypt(cfg.bot_token_enc)
      : cfg.bot_token;

    if (!token) {
      this.logger.warn(`No bot token for Telegram channel ${channelId}`);
      return;
    }

    const existing = this.bots.get(channelId);
    if (existing) {
      await existing.telegram.deleteWebhook();
    }

    const bot = new Telegraf(token);
    const baseUrl = this.config.get<string>('APP_URL') || 'https://api.pymeshub.lat';
    const webhookUrl = `${baseUrl}/api/inbound/telegram/webhook/${channelId}`;

    try {
      await bot.telegram.setWebhook(webhookUrl);
      this.bots.set(channelId, bot);
      this.logger.log(`Telegram webhook set for channel ${channelId} → ${webhookUrl}`);
    } catch (err) {
      this.logger.error(`Failed to set Telegram webhook: ${(err as Error).message}`);
    }
  }

  async processUpdate(channelId: string, update: any) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM' },
      select: { id: true, workspace_id: true, config_json: true },
    });

    if (!channel) return;

    const message = update?.message || update?.edited_message;
    if (!message?.text && !message?.caption && !message?.photo && !message?.document) return;

    const from = message.from;
    const chat = message.chat;
    const text = message.text || message.caption || '';
    const senderName = from?.first_name
      ? `${from.first_name}${from.last_name ? ' ' + from.last_name : ''}`
      : (from?.username || `Telegram ${from?.id}`);

    const senderRef = `tg:${from?.id}`;
    const conversationRef = `tg:${chat?.id}`;

    try {
      await this.messagesService.receiveInbound(
        channel.workspace_id,
        channel.id,
        {
          body_text: text,
          sender_name: senderName,
          sender_ref: senderRef,
          external_id: String(message.message_id),
          conversation_ref: conversationRef,
          raw_payload: update,
          attachments: message.photo
            ? [{ type: 'photo', file_id: message.photo[message.photo.length - 1]?.file_id }]
            : message.document
              ? [{ type: 'document', file_id: message.document.file_id, file_name: message.document.file_name }]
              : undefined,
        },
      );
    } catch (err) {
      this.logger.error(`Telegram inbound error: ${(err as Error).message}`);
    }
  }

  async removeWebhook(channelId: string) {
    const bot = this.bots.get(channelId);
    if (bot) {
      await bot.telegram.deleteWebhook().catch(() => {});
      this.bots.delete(channelId);
    }
  }

  async sendMessage(channelId: string, chatId: string, text: string) {
    const bot = this.bots.get(channelId);
    if (!bot) {
      this.logger.warn(`No bot instance for channel ${channelId}`);
      return;
    }
    await bot.telegram.sendMessage(chatId, text);
  }
}
