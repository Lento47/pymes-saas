import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';
import { EventsGateway } from '../gateways/events.gateway';
import { StorageService } from '../common/storage/storage.service';
import { Telegraf } from 'telegraf';

interface TelegramAttachment {
  type: string;
  file_id: string;
  file_name?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bots = new Map<string, Telegraf>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messagesService: MessagesService,
    private readonly config: ConfigService,
    private readonly events: EventsGateway,
    private readonly storage: StorageService,
  ) {}

  async registerWebhook(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspace_id: workspaceId, type: 'TELEGRAM' },
      select: { config_json: true, id: true },
    });

    if (!channel?.config_json) return;

    const cfg = channel.config_json as Record<string, unknown>;
    const token = (cfg.bot_token_enc as string)
      ? this.crypto.decrypt(cfg.bot_token_enc as string)
      : (cfg.bot_token as string);

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
    } catch (err: unknown) {
      this.logger.error(`Failed to set Telegram webhook: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async processUpdate(channelId: string, update: Record<string, unknown>) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM' },
      select: { id: true, workspace_id: true, config_json: true },
    });

    if (!channel) return;

    const message = (update?.message ?? update?.edited_message) as Record<string, unknown> | undefined;
    if (!message) return;

    const hasContent = !!(
      message.text || message.caption ||
      message.photo || message.document ||
      message.video || message.audio || message.voice
    );
    if (!hasContent) return;

    const from = message.from as Record<string, unknown> | undefined;
    const chat = message.chat as Record<string, unknown> | undefined;
    if (!from || !chat) return;

    const text = (message.text ?? message.caption ?? '') as string;
    const firstName = from.first_name as string | undefined;
    const lastName = from.last_name as string | undefined;
    const username = from.username as string | undefined;
    const senderName = firstName
      ? `${firstName}${lastName ? ' ' + lastName : ''}`
      : (username || `Telegram ${from.id}`);

    const senderRef = `tg:${from.id}`;
    const conversationRef = `tg:${chat.id}`;

    // Extract all supported attachment types
    const attachments: TelegramAttachment[] = [];
    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1] as Record<string, unknown>;
      attachments.push({ type: 'photo', file_id: largest.file_id as string });
    }
    if (message.document) {
      const doc = message.document as Record<string, unknown>;
      attachments.push({ type: 'document', file_id: doc.file_id as string, file_name: doc.file_name as string | undefined });
    }
    if (message.video) {
      const vid = message.video as Record<string, unknown>;
      attachments.push({ type: 'video', file_id: vid.file_id as string });
    }
    if (message.audio) {
      const aud = message.audio as Record<string, unknown>;
      attachments.push({ type: 'audio', file_id: aud.file_id as string });
    }
    if (message.voice) {
      const voice = message.voice as Record<string, unknown>;
      attachments.push({ type: 'voice', file_id: voice.file_id as string });
    }

    const messageType = message.photo
      ? 'image' : message.document
        ? 'file' : message.video
          ? 'video' : (message.audio || message.voice)
            ? 'audio' : 'text';

    try {
      const result = await this.messagesService.receiveInbound(
        'telegram',
        channel.workspace_id,
        {
          channel_id: channel.id,
          body_text: text,
          sender_name: senderName,
          sender_ref: senderRef,
          external_id: String(message.message_id),
          conversation_ref: conversationRef,
          raw_payload: update,
          message_type: messageType,
          attachments: attachments.length > 0 ? attachments : undefined,
          telegram_chat_id: String(chat.id),
          telegram_user_id: String(from.id),
          telegram_message_id: String(message.message_id),
        },
      );

      // Fire-and-forget media download after message is persisted
      if (result.ok && result.message_id && attachments.length > 0) {
        this.downloadTelegramMediaToStorage(
          channelId,
          channel.workspace_id,
          result.conversation_id!,
          result.message_id,
          attachments[0],
        ).catch((err: unknown) =>
          this.logger.error(
            `Telegram media download failed — msg=${result.message_id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    } catch (err: unknown) {
      this.logger.error(`Telegram inbound error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async downloadTelegramMediaToStorage(
    channelId: string,
    workspaceId: string,
    conversationId: string,
    messageId: string,
    attachment: TelegramAttachment,
  ): Promise<void> {
    const token = await this.getBotToken(channelId);
    if (!token) {
      this.logger.warn(`downloadTelegramMediaToStorage: no token for channel ${channelId}`);
      return;
    }

    const bot = new Telegraf(token);
    let fileInfo: { file_path?: string; file_size?: number };
    try {
      fileInfo = await bot.telegram.getFile(attachment.file_id);
    } catch (err: unknown) {
      this.logger.warn(`downloadTelegramMediaToStorage: getFile failed — ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (!fileInfo.file_path) {
      this.logger.warn(`downloadTelegramMediaToStorage: no file_path for file_id=${attachment.file_id}`);
      return;
    }

    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      this.logger.warn(`downloadTelegramMediaToStorage: download failed — status=${res.status}`);
      return;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = fileInfo.file_path.split('.').pop()?.toLowerCase() ?? '';
    const storageKey = `telegram-media/${workspaceId}/${messageId}${ext ? '.' + ext : ''}`;
    const mimeType = this.guessMimeFromExt(ext, attachment.type);

    await this.storage.upload(storageKey, buffer, mimeType);

    const attachmentEntry = {
      provider: 'telegram',
      mediaId: attachment.file_id,
      storageKey,
      mimeType,
      size: buffer.length,
      type: attachment.type,
      filename: attachment.file_name ?? null,
      caption: null,
    };

    await this.prisma.message.update({
      where: { id: messageId },
      data: { attachments_json: [attachmentEntry] },
    });

    this.logger.log(
      `Telegram media saved — msg=${messageId} key=${storageKey} type=${attachment.type} size=${buffer.length}`,
    );

    this.events.emitMediaReady({
      message_id: messageId,
      conversation_id: conversationId,
      media_type: attachment.type,
      media_status: 'available',
      media_download_url: `/api/conversations/messages/${messageId}/media`,
      media_mime_type: mimeType,
      media_filename: attachment.file_name ?? null,
      media_caption: null,
    });
  }

  private guessMimeFromExt(ext: string, type: string): string {
    const MIME: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
      mp4: 'video/mp4', mov: 'video/quicktime',
      mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg',
      wav: 'audio/wav', m4a: 'audio/mp4', amr: 'audio/amr',
      pdf: 'application/pdf',
    };
    if (MIME[ext]) return MIME[ext];
    if (type === 'photo') return 'image/jpeg';
    if (type === 'video') return 'video/mp4';
    if (type === 'audio' || type === 'voice') return 'audio/ogg';
    return 'application/octet-stream';
  }

  private async getBotToken(channelId: string): Promise<string | null> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM' },
      select: { config_json: true },
    });
    if (!channel?.config_json) return null;
    const cfg = channel.config_json as Record<string, unknown>;
    return (cfg.bot_token_enc as string)
      ? this.crypto.decrypt(cfg.bot_token_enc as string)
      : ((cfg.bot_token as string) ?? null);
  }

  /**
   * Validates the X-Telegram-Bot-Api-Secret-Token header.
   * Returns true if the channel has no secret configured (backwards-compat)
   * or if the provided token matches the stored secret.
   */
  async validateWebhookSecret(channelId: string, providedToken: string | undefined): Promise<boolean> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: 'TELEGRAM' },
      select: { config_json: true },
    });
    if (!channel?.config_json) return false;

    const cfg = channel.config_json as Record<string, unknown>;
    const webhookSecret = cfg.webhook_secret as string | undefined;

    // If no secret is configured, allow all (backwards compat for existing webhooks)
    if (!webhookSecret) return true;

    return providedToken === webhookSecret;
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
