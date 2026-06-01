import { Injectable, Inject, Logger, BadRequestException, NotFoundException, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, timingSafeEqual } from "crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { MessagesService } from "../conversations/messages.service";
import { StorageService } from "../common/storage/storage.service";
import { EventsGateway } from "../gateways/events.gateway";
import { Telegraf } from "telegraf";
import type { Prisma } from "@prisma/client";

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
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * On module init, re-register webhooks for all active Telegram channels.
   * This makes webhooks self-healing on every deploy — no manual intervention needed.
   */
  async onModuleInit() {
    this.logger.log("[telegram] onModuleInit — scanning for active Telegram channels...");
    try {
      const channels = await this.prisma.channel.findMany({
        where: { type: "TELEGRAM", status: "ACTIVE" },
        select: { id: true, workspace_id: true },
      });
      this.logger.log(`[telegram] found ${channels.length} active channel(s)`);
      for (const ch of channels) {
        try {
          await this.registerWebhook(ch.workspace_id, ch.id);
          this.logger.log(`[telegram] startup re-registered webhook for channel=${ch.id}`);
        } catch (err) {
          this.logger.warn(
            `[telegram] startup re-register failed for channel=${ch.id}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`[telegram] onModuleInit scan failed: ${(err as Error).message}`);
    }
  }

  /**
   * Get bot token from encrypted config
   */
  private async getBotToken(channelId: string): Promise<string | null> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: "TELEGRAM", status: "ACTIVE" },
      select: { config_json: true },
    });

    if (!channel?.config_json) return null;

    const cfg = channel.config_json as any;
    return cfg.bot_token_encrypted ? this.crypto.decrypt(cfg.bot_token_encrypted) : cfg.bot_token;
  }

  /**
   * Validate token with Telegram API
   */
  async validateToken(token: string): Promise<boolean> {
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
      where: { id: channelId, workspace_id: workspaceId, type: "TELEGRAM" },
      select: { config_json: true, id: true, workspace_id: true },
    });

    if (!channel) {
      throw new NotFoundException(`Telegram channel ${channelId} not found`);
    }

    const token = await this.getBotToken(channelId);
    if (!token) {
      throw new BadRequestException("No bot token configured for this channel");
    }

    // Validate token before registering webhook
    const isValid = await this.validateToken(token);
    if (!isValid) {
      throw new BadRequestException("Invalid or expired Telegram bot token");
    }

    const bot = new Telegraf(token);
    const rawBaseUrl =
      this.config.get<string>("TELEGRAM_WEBHOOK_BASE_URL") ??
      this.config.get<string>("APP_URL") ??
      process.env.PUBLIC_URL ??
      "https://api.pymeshub.lat";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");
    const webhookUrl = `${baseUrl}/api/inbound/telegram/webhook/${channelId}`;

    this.logger.log(`Registering webhook for channel ${channelId}: ${webhookUrl}`);

    // Generate a per-channel webhook secret so we can verify inbound updates
    const webhookSecret = randomBytes(32).toString("hex");

    try {
      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ["message", "edited_message", "callback_query"],
        max_connections: 40,
        secret_token: webhookSecret,
      });

      // Remove old webhook after new one is confirmed registered.
      // Doing it before would leave the channel without a webhook if setWebhook fails.
      await this.removeWebhook(channelId).catch((err) =>
        this.logger.warn(`Failed to clean up old webhook for channel=${channelId}`, err),
      );

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
      this.logger.error(
        `Failed to register webhook for channel ${channelId}: url=${webhookUrl} error=${(err as Error).message}`,
      );
      throw new BadRequestException(
        `Token válido pero no se pudo registrar el webhook en ${baseUrl}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Validate the X-Telegram-Bot-Api-Secret-Token header for an inbound webhook.
   * Returns true if the header matches the per-channel stored secret.
   */
  async verifyWebhookSecret(
    channelId: string,
    suppliedSecret: string | undefined,
  ): Promise<boolean> {
    this.logger.debug(`[telegram] verifyWebhookSecret called for channel=${channelId}, secret=${suppliedSecret ? 'present' : 'MISSING'}`);
    if (!suppliedSecret) return false;
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, type: "TELEGRAM" },
      select: { config_json: true, workspace_id: true },
    });
    if (!channel) return false;

    let expected = (channel.config_json as any)?.webhook_secret as string | undefined;
    const a = Buffer.from(suppliedSecret, "utf8");

    // Try existing secret first
    if (expected) {
      const b = Buffer.from(expected, "utf8");
      if (a.length === b.length) {
        try {
          if (timingSafeEqual(a, b)) return true;
        } catch { /* fall through to recovery */ }
      }
      this.logger.warn(`[telegram] secret mismatch for channel=${channelId} — re-registering`);
    }

    // Recover: re-register webhook (generates new secret, tells Telegram)
    try {
      await this.registerWebhook(channel.workspace_id, channelId);
      const refreshed = await this.prisma.channel.findFirst({
        where: { id: channelId, type: "TELEGRAM" },
        select: { config_json: true },
      });
      expected = (refreshed?.config_json as any)?.webhook_secret;
      if (expected) {
        const b = Buffer.from(expected, "utf8");
        if (a.length !== b.length) return false;
        try {
          if (timingSafeEqual(a, b)) {
            this.logger.log(`[telegram] recovered + verified channel=${channelId}`);
            return true;
          }
        } catch { /* fall through */ }
      }
      this.logger.warn(`[telegram] recovery completed but first request still mismatched channel=${channelId}`);
    } catch (err) {
      // Recovery failed — accept the webhook temporarily anyway.
    // This happens when ENCRYPTION_KEY changed and bot tokens can't be decrypted.
    // The channel works for now but needs the bot token re-entered via configureTelegram.
    const existing = (channel.config_json as any) || {};
    await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        config_json: {
          ...existing,
          webhook_secret: suppliedSecret,
          webhook_recovered_at: new Date().toISOString(),
        } as any,
      },
      select: { id: true },
    });
    this.logger.warn(
      `[telegram] recovery impossible (no bot token) — accepted supplied secret for channel=${channelId}. ` +
      `Re-enter bot token via configureTelegram to restore full security.`,
    );
    return true;
    }

    return false;
  }

  /**
   * Process incoming Telegram update with deduplication and metadata storage
   */
  async processUpdate(
    channelId: string,
    update: Record<string, any>,
  ): Promise<{ processed: boolean; duplicate?: boolean }> {
    // Validate payload structure
    if (!update || typeof update !== "object") {
      return { processed: false };
    }

    try {
      const channel = await this.prisma.channel.findFirst({
        where: { id: channelId, type: "TELEGRAM", status: "ACTIVE" },
        select: { id: true, workspace_id: true, config_json: true },
      });

      if (!channel) {
        this.logger.warn(`Inactive or missing Telegram channel ${channelId} — rejecting webhook`);
        return { processed: false };
      }

      // Handle inline keyboard button presses
      if (update.callback_query) {
        return this.handleCallbackQuery(channel, update.callback_query);
      }

      const message = update?.message || update?.edited_message;
      if (!message) return { processed: false };

      const hasContent = !!(
        message.text ||
        message.caption ||
        message.photo ||
        message.document ||
        message.video ||
        message.audio ||
        message.voice
      );
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

      const text = message.text || message.caption || "";
      const senderName = from.first_name
        ? `${from.first_name}${from.last_name ? " " + from.last_name : ""}`
        : from.username || `Telegram User ${from.id}`;

      const senderRef = `tg:${from.id}`;
      const conversationRef = `tg:${chat.id}`;

      // Extract attachments
      const attachments: Record<string, any>[] = [];
      if (message.photo?.length) {
        attachments.push({
          type: "photo",
          file_id: message.photo[message.photo.length - 1].file_id,
        });
      }
      if (message.document) {
        attachments.push({
          type: "document",
          file_id: message.document.file_id,
          file_name: message.document.file_name,
        });
      }
      if (message.video) {
        attachments.push({ type: "video", file_id: message.video.file_id });
      }
      if (message.audio) {
        attachments.push({ type: "audio", file_id: message.audio.file_id });
      }
      if (message.voice) {
        attachments.push({ type: "voice", file_id: message.voice.file_id });
      }

      const result = await this.messagesService.receiveInbound("telegram", channel.workspace_id, {
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
        message_type: message.photo
          ? "image"
          : message.document
            ? "file"
            : message.video
              ? "video"
              : message.audio
                ? "audio"
                : "text",
        attachments: attachments.length > 0 ? attachments : undefined,
        metadata: {
          telegram_user_id: from.id,
          telegram_chat_id: chat.id,
          telegram_chat_type: chat.type,
          is_edited: !!update.edited_message,
        },
      });

      // Launch media download fire-and-forget after message is persisted
      if (result.ok && result.message_id && result.conversation_id && attachments.length > 0) {
        this.downloadTelegramMediaToStorage(
          channel.id,
          channel.workspace_id,
          result.conversation_id,
          result.message_id,
          attachments[0] as { type: string; file_id: string; file_name?: string },
        ).catch((err: unknown) =>
          this.logger.error(
            `Telegram media download failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }

      this.logger.debug(
        `Telegram message ${tgMessageId} from ${senderRef} → workspace ${channel.workspace_id}`,
      );
      return { processed: true };
    } catch (err) {
      this.logger.error(`Telegram inbound error: ${(err as Error).message}`);
      return { processed: false };
    }
  }

  private async handleCallbackQuery(
    channel: { id: string; workspace_id: string; config_json: unknown },
    cq: Record<string, any>,
  ): Promise<{ processed: boolean }> {
    try {
      const from = cq.from;
      const chat = cq.message?.chat;
      const data: string = cq.data ?? "";
      if (!from || !chat || !data) return { processed: false };

      // Acknowledge callback query immediately so Telegram removes the loading spinner
      const token = await this.getBotToken(channel.id);
      if (token) {
        const bot = new Telegraf(token);
        await bot.telegram.answerCbQuery(cq.id).catch(() => {});
      }

      const senderName = from.first_name
        ? `${from.first_name}${from.last_name ? " " + from.last_name : ""}`
        : from.username || `Telegram User ${from.id}`;

      await this.messagesService.receiveInbound("telegram", channel.workspace_id, {
        channel_id: channel.id,
        sender_ref: `tg:${from.id}`,
        sender_name: senderName,
        body_text: data,
        telegram_chat_id: String(chat.id),
        telegram_user_id: from.id ? String(from.id) : undefined,
        telegram_message_id: `cq_${cq.id}`,
        is_interactive: true,
      });

      return { processed: true };
    } catch (err) {
      this.logger.error(`Callback query error: ${(err as Error).message}`);
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
      throw new BadRequestException("Missing text or chatId");
    }

    const token = await this.getBotToken(channelId);
    if (!token) {
      throw new NotFoundException("No bot token configured");
    }

    try {
      // Reuse cached bot instance instead of creating a new Telegraf per message
      const bot = this.bots.get(channelId) || new Telegraf(token);
      if (!this.bots.has(channelId)) this.bots.set(channelId, bot);
      const result = await bot.telegram.sendMessage(chatId, text, {
        parse_mode: "HTML",
      });
      this.logger.log(`Message sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send message: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send message: ${(err as Error).message}`);
    }
  }

  // ── Media sending ───────────────────────────────────────────────────────────

  /**
   * Download a file from storage and return a source object (Buffer or stream)
   * that Telegraf can send. Handles both full URLs and storage keys.
   */
  private async resolveFileInput(mediaUrl: string): Promise<{ source: Buffer; filename: string }> {
    const trimmed = mediaUrl.trim();
    const storageProxyMarker = "/api/storage/file/";
    const storageProxyIndex = trimmed.indexOf(storageProxyMarker);

    if (storageProxyIndex >= 0) {
      const key = decodeURIComponent(trimmed.slice(storageProxyIndex + storageProxyMarker.length));
      const buffer = await this.storage.download(key);
      return { source: buffer, filename: key.split("/").pop() || "file" };
    }

    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      const buffer = await this.storage.download(trimmed);
      return { source: buffer, filename: trimmed.split("/").pop() || "file" };
    }

    const res = await fetch(trimmed, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Failed to fetch media URL: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const urlPath = new URL(trimmed).pathname;
    return { source: buffer, filename: urlPath.split("/").pop() || "file" };
  }

  /**
   * Send a photo (image) to a Telegram chat.
   * Supports all image formats Telegram accepts (JPEG, PNG, GIF, WebP).
   */
  async sendPhoto(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<any> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    try {
      const bot = new Telegraf(token);
      const { source } = await this.resolveFileInput(mediaUrl);
      const result = await bot.telegram.sendPhoto(chatId, { source } as any, {
        caption,
        parse_mode: "HTML",
      });
      this.logger.log(`Photo sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send photo: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send photo: ${(err as Error).message}`);
    }
  }

  /**
   * Send a video to a Telegram chat.
   * Supports MP4, MOV, AVI, MKV, WebM.
   */
  async sendVideo(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<any> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    try {
      const bot = new Telegraf(token);
      const { source } = await this.resolveFileInput(mediaUrl);
      const result = await bot.telegram.sendVideo(chatId, { source } as any, {
        caption,
        parse_mode: "HTML",
      });
      this.logger.log(`Video sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send video: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send video: ${(err as Error).message}`);
    }
  }

  /**
   * Send an audio file to a Telegram chat.
   * Supports MP3, M4A, OGG, WAV, FLAC.
   */
  async sendAudio(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<any> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    try {
      const bot = new Telegraf(token);
      const { source } = await this.resolveFileInput(mediaUrl);
      const result = await bot.telegram.sendAudio(chatId, { source } as any, {
        caption,
        parse_mode: "HTML",
      });
      this.logger.log(`Audio sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send audio: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send audio: ${(err as Error).message}`);
    }
  }

  /**
   * Send a voice note to a Telegram chat (appears as voice message bubble).
   * Accepts MP3, OGG/Opus.
   */
  async sendVoice(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<any> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    try {
      const bot = new Telegraf(token);
      const { source } = await this.resolveFileInput(mediaUrl);
      const result = await bot.telegram.sendVoice(chatId, { source } as any, {
        caption,
      });
      this.logger.log(`Voice sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send voice: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send voice: ${(err as Error).message}`);
    }
  }

  /**
   * Send a document (any file type) to a Telegram chat.
   */
  async sendDocument(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<any> {
    const token = await this.getBotToken(channelId);
    if (!token) throw new NotFoundException("No bot token configured");

    try {
      const bot = new Telegraf(token);
      const { source } = await this.resolveFileInput(mediaUrl);
      const result = await bot.telegram.sendDocument(chatId, { source } as any, {
        caption,
        parse_mode: "HTML",
      });
      this.logger.log(`Document sent to chat ${chatId} in channel ${channelId}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to send document: ${(err as Error).message}`);
      throw new BadRequestException(`Failed to send document: ${(err as Error).message}`);
    }
  }

  /**
   * Unified media sender — routes by media_type string.
   * Supported types: image, video, audio, document (default).
   */
  async sendMedia(
    channelId: string,
    chatId: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string,
  ): Promise<any> {
    switch (mediaType) {
      case "image":
        return this.sendPhoto(channelId, chatId, mediaUrl, caption);
      case "video":
        return this.sendVideo(channelId, chatId, mediaUrl, caption);
      case "audio":
        return this.sendAudio(channelId, chatId, mediaUrl, caption);
      case "voice":
        return this.sendVoice(channelId, chatId, mediaUrl, caption);
      default:
        return this.sendDocument(channelId, chatId, mediaUrl, caption);
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

  // ── Private: Telegram media download to MinIO ──────────────────────────────

  private async downloadTelegramMediaToStorage(
    channelId: string,
    workspaceId: string,
    conversationId: string,
    messageId: string,
    attachment: { type: string; file_id: string; file_name?: string },
  ): Promise<void> {
    const token = await this.getBotToken(channelId);
    if (!token) return;

    const bot = new Telegraf(token);
    const fileInfo = await bot.telegram.getFile(attachment.file_id);
    if (!fileInfo.file_path) return;

    // WARNING: bot token is embedded in the download URL (Telegram API requirement).
    // Ensure this URL is NOT logged — token leak would compromise the bot.
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Telegram file fetch failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = fileInfo.file_path.split(".").pop() ?? "";
    const storageKey = `telegram-media/${workspaceId}/${messageId}.${ext}`;
    const mimeType = this.guessMimeFromExt(ext, attachment.type);

    await this.storage.upload(storageKey, buffer, mimeType);

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        attachments_json: [
          {
            provider: "telegram",
            mediaId: attachment.file_id,
            storageKey,
            mimeType,
            size: buffer.length,
            type: attachment.type,
            filename: attachment.file_name ?? null,
            caption: null,
          },
        ] as unknown as Prisma.InputJsonValue,
      },
    });

    this.events.emitMediaReady({
      message_id: messageId,
      conversation_id: conversationId,
      media_type: attachment.type,
      media_status: "available",
      media_download_url: `/api/conversations/messages/${messageId}/media`,
      media_mime_type: mimeType,
      media_filename: attachment.file_name ?? null,
      media_caption: null,
    });

    this.logger.log(`Telegram media stored: message=${messageId}, key=${storageKey}`);
  }

  private guessMimeFromExt(ext: string, mediaType: string): string {
    const map: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    if (map[ext]) return map[ext];
    if (mediaType === "photo") return "image/jpeg";
    if (mediaType === "audio" || mediaType === "voice") return "audio/ogg";
    if (mediaType === "video") return "video/mp4";
    return "application/octet-stream";
  }
}
