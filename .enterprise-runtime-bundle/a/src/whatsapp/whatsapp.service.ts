import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { MessagesService } from '../conversations/messages.service';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly messages: MessagesService,
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

  // ── Procesar webhook entrante ──────────────────────────────────────────────

  async processInbound(workspaceId: string, payload: any): Promise<void> {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value?.messages?.length) {
        // Status update o delivery receipt — ignorar silenciosamente
        return;
      }

      const msg = value.messages[0];
      const from = msg.from; // número con código de país, sin +
      const bodyText = msg.text?.body ?? '';
      const senderName = value.contacts?.[0]?.profile?.name ?? from;

      const normalizedPayload = {
        from,
        name: senderName,
        text: bodyText,
        raw: payload,
      };

      await this.messages.receiveInbound('whatsapp', workspaceId, normalizedPayload);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp inbound: ${err?.message}`);
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
