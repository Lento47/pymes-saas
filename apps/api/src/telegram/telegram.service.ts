import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';
import { Telegraf } from 'telegraf';

interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  max_connections: number;
  allowed_updates?: string[];
}

export type { TelegramWebhookInfo };

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bots = new Map<string, Telegraf>();
  private webhookCache = new Map<string, { url: string; timestamp: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messagesService: MessagesService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get bot token from encrypted config
   */
  private async getBotToken(channelId: string): Promise<string | null> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM', status: 'ACTIVE' },
      select: { config_json: true },
    });

    if (!channel?.config_json) return null;

    const cfg = channel.config_json as any;
    return cfg.bot_token_encrypted
      ? this.crypto.decrypt(cfg.bot_token_encrypted)
      : cfg.bot_token;
  }

  /**
   * Validate token with Telegram API
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const bot = new Telegraf(token);
      const me = await bot.telegram.getMe();
      this.logger.log(`Token validated for bot: @${me.username}`);
      return true;
    } catch (err) {
      this.logger.warn(`Invalid token: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Register webhook for Telegram bot
   * Called when channel is configured or manually triggered
   */
  async registerWebhook(workspaceId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId, type: 'TELEGRAM' },
      select: { config_json: true, id: true, workspace_id: true },
    });

    if (!channel) {
      throw new NotFoundException(`Telegram channel ${channelId} not found`);
    }

    const token = await this.getBotToken(channelId);
    if (!token) {
      throw new BadRequestException('No bot token configured for this channel');
    }

    // Validate token before registering webhook
    const isValid = await this.validateToken(token);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired Telegram bot token');
    }

    // Remove existing webhook if any
    await this.removeWebhook(channelId).catch(() => {});

    const bot = new Telegraf(token);
    const baseUrl = this.config.get<string>('APP_URL')
      ?? process.env.PUBLIC_URL
      ?? 'https://api.pymeshub.lat';

    const webhookUrl = `${baseUrl}/api/inbound/telegram/webhook/${channelId}`;

    // Generate a per-channel webhook secret so we can verify inbound updates
    // via the X-Telegram-Bot-Api-Secret-Token header. Telegram requires the
    // secret to be 1-256 chars, ASCII A-Z/a-z/0-9/_/-.
    const webhookSecret = randomBytes(32).toString('hex');

    try {
      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        max_connections: 40,
        secret_token: webhookSecret,
      });

      // Persist the secret on the channel config so the webhook handler can validate it.
      const existing = (channel.config_json as any) || {};
      await this.prisma.channel.update({
        where: { id: channelId },
        data: { config_json: { ...existing, webhook_secret: webhookSecret } as any },
      });

      this.bots.set(channelId, bot);
      this.webhookCache.set(channelId, { url: webhookUrl, timestamp: Date.now() });

      this.logger.log(`Telegram webhook registered: channel=${channelId}, url=${webhookUrl}`);
    } catch (err) {
      this.logger.error(`Failed to register webhook: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to register webhook: ${(err as Error).message}`);
    }
  }

  /**
   * Validate the X-Telegram-Bot-Api-Secret-Token header for an inbound webhook.
   * Returns true if the header matches the per-channel stored secret.
   */
  async verifyWebhookSecret(channelId: string, suppliedSecret: string | undefined): Promise<boolean> {
    if (!suppliedSecret) return false;
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM' },
      select: { config_json: true },
    });
    const expected = (channel?.config_json as any)?.webhook_secret as string | undefined;
    if (!expected) return false;
    const a = Buffer.from(suppliedSecret, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Process incoming Telegram update with deduplication and metadata storage
   */
  async processUpdate(channelId: string, update: any): Promise<{ processed: boolean; duplicate?: boolean }> {
    // Validate payload structure
    if (!update || typeof update !== 'object') {
      return { processed: false };
    }

    try {
      const channel = await this.prisma.channel.findFirst({
        where: { id: channelId, type: 'TELEGRAM', status: 'ACTIVE' },
        select: { id: true, workspace_id: true, config_json: true },
      });

      if (!channel) {
        this.logger.warn(`Inactive or missing Telegram channel ${channelId} — rejecting webhook`);
        return { processed: false };
      }

      const message = update?.message || update?.edited_message;
      if (!message) return { processed: false };

      const hasContent = !!(message.text || message.caption || message.photo || message.document || message.video || message.audio || message.voice);
      if (!hasContent) return { processed: false };

      const from = message.from;
      const chat = message.chat;
      if (!from || !chat) return { processed: false };

      // Deduplication: check if this telegram_message_id was already processed
      const tgMessageId = String(message.message_id);
      const existing = await this.prisma.message.findFirst({
        where: {
          workspace_id: channel.workspace_id,
          telegram_message_id: tgMessageId,
        },
        select: { id: true },
      });

      if (existing) {
        this.logger.debug(`Duplicate Telegram message ${tgMessageId} — skipping`);
        return { processed: true, duplicate: true };
      }

      const text = message.text || message.caption || '';
      const senderName = from.first_name
        ? `${from.first_name}${from.last_name ? ' ' + from.last_name : ''}`
        : (from.username || `Telegram User ${from.id}`);

      const senderRef = `tg:${from.id}`;
      const conversationRef = `tg:${chat.id}`;

      // Extract attachments
      const attachments: any[] = [];
      if (message.photo?.length) {
        attachments.push({ type: 'photo', file_id: message.photo[message.photo.length - 1].file_id });
      }
      if (message.document) {
        attachments.push({ type: 'document', file_id: message.document.file_id, file_name: message.document.file_name });
      }
      if (message.video) {
        attachments.push({ type: 'video', file_id: message.video.file_id });
      }
      if (message.audio) {
        attachments.push({ type: 'audio', file_id: message.audio.file_id });
      }
      if (message.voice) {
        attachments.push({ type: 'voice', file_id: message.voice.file_id });
      }

      await this.messagesService.receiveInbound(
        'telegram',
        channel.workspace_id,
        {
          channel_id: channel.id,
          body_text: text,
          sender_name: senderName,
          sender_ref: senderRef,
          external_id: tgMessageId,
          conversation_ref: conversationRef,
          raw_payload: update,
          // Telegram metadata for storage
          telegram_chat_id: String(chat.id),
          telegram_user_id: from.id ? String(from.id) : undefined,
          telegram_message_id: tgMessageId,
          message_type: message.photo ? 'image' : message.document ? 'file' : message.video ? 'video' : message.audio ? 'audio' : 'text',
          attachments: attachments.length > 0 ? attachments : undefined,
          metadata: {
            telegram_user_id: from.id,
            telegram_chat_id: chat.id,
            telegram_chat_type: chat.type,
            is_edited: !!update.edited_message,
          },
        },
      );

      this.logger.debug(`Telegram message ${tgMessageId} from ${senderRef} → workspace ${channel.workspace_id}`);
      return { processed: true };
    } catch (err) {
      this.logger.error(`Telegram inbound error: ${(err as Error).message}`);
      return { processed: false };
    }
  }

  /**
   * Remove webhook for channel
   */
  async removeWebhook(channelId: string): Promise<void> {
    const token = await this.getBotToken(channelId);
    if (!token) return;

    try {
      const bot = new Telegraf(token);
      await bot.telegram.deleteWebhook();
      this.bots.delete(channelId);
      this.webhookCache.delete(channelId);
      this.logger.log(`Telegram webhook removed for channel ${channelId}`);
    } catch (err) {
      this.logger.error(`Failed to remove webhook: ${(err as Error).message}`);
    }
  }

  /**
   * Send message to Telegram chat
   */
  async sendMessage(channelId: string, chatId: string, text: string): Promise<any> {
    if (!text || !chatId) {
      throw new BadRequestException('Missing text or chatId');
    }

    const token = await this.getBotToken(channelId);
    if (!token) {
      throw new NotFoundException('No bot token configured');
    }

    try {
      const bot = new Telegraf(token);
      const result = await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
      });
      this.logger.log(`Message sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send message: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send message: ${(err as Error).message}`);
    }
  }

  /**
   * Get webhook status for debugging
   */
  async getWebhookStatus(channelId: string): Promise<TelegramWebhookInfo | null> {
    const token = await this.getBotToken(channelId);
    if (!token) {
      this.logger.warn(`No token for channel ${channelId}`);
      return null;
    }

    try {
      const bot = new Telegraf(token);
      const info = await bot.telegram.getWebhookInfo();
      return info as TelegramWebhookInfo;
    } catch (err) {
      this.logger.error(`Failed to get webhook info: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Get bot info (name, username, etc.)
   */
  async getBotInfo(channelId: string): Promise<any | null> {
    const token = await this.getBotToken(channelId);
    if (!token) return null;

    try {
      const bot = new Telegraf(token);
      const me = await bot.telegram.getMe();
      return {
        id: me.id,
        is_bot: me.is_bot,
        first_name: me.first_name,
        username: me.username,
        can_join_groups: me.can_join_groups,
        can_read_all_group_messages: me.can_read_all_group_messages,
        supports_inline_queries: me.supports_inline_queries,
      };
    } catch (err) {
      this.logger.error(`Failed to get bot info: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Clear bot instance cache
   */
  async clearBotCache(channelId: string): Promise<void> {
    this.bots.delete(channelId);
    this.webhookCache.delete(channelId);
  }
}
