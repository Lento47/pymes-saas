import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => WebhookEventsService))
    private readonly webhookEvents: WebhookEventsService,
  ) {}

  // ── Enviar mensaje outbound ────────────────────────────────────────────────

  async sendMessage(
    channel: any,
    to: string,
    bodyText: string,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: bodyText },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando mensaje por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Ingestión durable del webhook ──────────────────────────────────────────

  /**
   * Validate signature, extract metadata, write to webhook_events table,
   * and return 200 to Meta quickly. Processing happens asynchronously.
   */
  async ingestWebhook(payload: any): Promise<{ persisted: boolean; duplicate: boolean }> {
    const result = await this.webhookEvents.ingest('whatsapp', payload);
    return { persisted: true, duplicate: result.duplicate };
  }

  // ── Procesamiento asíncrono desde webhook_events ───────────────────────────

  /**
   * Resolve workspace from WhatsApp phone_number_id instead of trusting client headers
   */
  private async resolveWorkspaceFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
      const channel = await this.prisma.channel.findFirst({
        where: {
          type: 'WHATSAPP',
          config_json: {
            path: ['phone_number_id'],
            equals: phoneNumberId,
          },
        },
        select: { workspace_id: true },
      });

      return channel?.workspace_id ?? null;
    } catch (err) {
      this.logger.error(`Error resolving workspace from phone_number_id: ${err}`);
      return null;
    }
  }

  /**
   * Process a stored WhatsApp webhook event asynchronously.
   * Called by WebhookEventsProcessor after claiming the event.
   */
  async processInboundFromEvent(event: any): Promise<void> {
    const payload = event.payload_json as any;
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const eventId = event.id;

    if (!phoneNumberId) {
      this.logger.warn(`Missing phone_number_id — event=${eventId}`);
      throw new Error('Missing phone_number_id in webhook payload');
    }

    const workspaceId = await this.resolveWorkspaceFromPhoneNumberId(phoneNumberId);
    if (!workspaceId) {
      this.logger.error(
        `No workspace found for phone_number_id=${phoneNumberId} — event=${eventId}`,
      );
      throw new Error(`No workspace configured for phone_number_id: ${phoneNumberId}`);
    }

    if (!value?.messages?.length) {
      // Status update or delivery receipt — nothing to persist as message
      return;
    }

    const msg = value.messages[0];
    const from = msg.from;
    const bodyText = msg.text?.body ?? '';
    const senderName = value.contacts?.[0]?.profile?.name ?? from;
    const providerMessageId = msg.id;

    const result = await this.messages.receiveProviderInbound({
      provider: 'whatsapp',
      workspaceId,
      channelPhoneNumberId: phoneNumberId,
      from,
      senderName,
      bodyText,
      providerMessageId,
      timestamp: msg.timestamp,
      rawPayload: payload,
    });

    if (result.status === 'duplicate') {
      this.logger.log(
        `Duplicate message skipped — event=${eventId} provider_message_id=${providerMessageId}`,
      );
      return;
    }

    const { messageId, conversationId, contactId } = result;

    // ── Secondary tasks (fire-and-forget — must not block) ──

    if (conversationId && messageId) {
      this.messages
        .emitAndNotify({
          workspaceId,
          conversationId,
          contactId,
          messageId,
          senderName,
          bodyText,
        })
        .catch((err) =>
          this.logger.error(
            `Error in emit/notify — event=${eventId} conversation_id=${conversationId}: ${err?.message}`,
          ),
        );
    }
  }

  // ── Verificar webhook de Meta ──────────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return challenge;
    }
    this.logger.warn(`Webhook verification failed — token mismatch`);
    return null;
  }
}
