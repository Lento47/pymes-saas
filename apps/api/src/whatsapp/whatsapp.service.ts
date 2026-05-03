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
    this.logger.log(`[DIAG] sendMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(',')}`);
    if (!cfg?.access_token_encrypted) {
      this.logger.error(`WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`);
      throw new BadGatewayException('WhatsApp access token no configurado. Verificá la configuración del canal.');
    }
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

  async sendTemplateMessage(
    channel: any,
    to: string,
    templateName: string,
    language: string,
    variables: Record<string, string>,
  ): Promise<{ message_id: string }> {
    const cfg = channel.config_json as any;
    this.logger.log(`[DIAG] sendTemplateMessage: channelId=${channel.id}, cfgHasToken=${!!cfg?.access_token_encrypted}, cfgKeys=${Object.keys(cfg || {}).join(',')}`);
    if (!cfg?.access_token_encrypted) {
      this.logger.error(`WhatsApp channel ${channel.id}: access_token_encrypted not set in config_json`);
      throw new BadGatewayException('WhatsApp access token no configurado. Verificá la configuración del canal.');
    }
    const accessToken = this.crypto.decrypt(cfg.access_token_encrypted);
    const phoneNumberId = cfg.phone_number_id;

    const components: any[] = [];
    if (Object.keys(variables).length > 0) {
      components.push({
        type: 'body',
        parameters: Object.values(variables).map((v) => ({
          type: 'text',
          text: v,
        })),
      });
    }

    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language || 'es' },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      this.logger.error('Meta template API error:', JSON.stringify(data));
      throw new BadGatewayException(
        data?.error?.message ?? 'Error enviando plantilla por WhatsApp',
      );
    }

    return { message_id: data.messages?.[0]?.id ?? 'unknown' };
  }

  // ── Procesar webhook entrante ──────────────────────────────────────────────

  /**
   * Resolve workspace from WhatsApp phone_number_id instead of trusting client headers
   */
  private async resolveWorkspaceFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
      // Query channels table to find workspace with this phone_number_id
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

  async processInbound(payload: any): Promise<void> {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        this.logger.warn('Missing phone_number_id in WhatsApp webhook');
        return;
      }

      // SECURITY: Resolve workspace from phone_number_id, not from client header
      const workspaceId = await this.resolveWorkspaceFromPhoneNumberId(phoneNumberId);
      if (!workspaceId) {
        this.logger.warn(`No workspace found for phone_number_id: ${phoneNumberId}`);
        return;
      }

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
