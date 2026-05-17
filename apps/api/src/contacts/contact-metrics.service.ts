import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue } from '../common/prisma/json';
import OpenAI from 'openai';

export interface ExtractedData {
  location?: string;
  business_needs?: string[];
  product_interests?: string[];
  order_history?: string[];
  budget_range?: string;
  decision_timeline?: string;
  key_contacts?: string[];
  notes?: string;
  last_extraction_at?: string;
}

export interface ContactMetrics {
  conversation_count: number;
  total_messages: number;
  first_contact_at: string | null;
  last_contact_at: string | null;
  invoice_count: number;
  total_invoice_amount: number;
  deal_count: number;
  total_deal_value: number;
  extracted_data: ExtractedData | null;
}

@Injectable()
export class ContactMetricsService {
  private readonly logger = new Logger(ContactMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getMetrics(workspaceId: string, contactId: string): Promise<ContactMetrics> {
    const [
      conversationCount,
      messageCount,
      firstMsg,
      lastMsg,
      invoiceAgg,
      dealAgg,
      contact,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { workspace_id: workspaceId, contact_id: contactId },
      }),
      this.prisma.message.count({
        where: {
          workspace_id: workspaceId,
          conversation: { contact_id: contactId },
        },
      }),
      this.prisma.message.findFirst({
        where: {
          workspace_id: workspaceId,
          conversation: { contact_id: contactId },
        },
        orderBy: { sent_at: 'asc' },
        select: { sent_at: true },
      }),
      this.prisma.message.findFirst({
        where: {
          workspace_id: workspaceId,
          conversation: { contact_id: contactId },
        },
        orderBy: { sent_at: 'desc' },
        select: { sent_at: true },
      }),
      this.prisma.invoice.aggregate({
        where: { workspace_id: workspaceId, contact_id: contactId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.deal.aggregate({
        where: { workspace_id: workspaceId, contact_id: contactId },
        _count: { id: true },
        _sum: { value: true },
      }),
      this.prisma.contact.findFirst({
        where: { id: contactId, workspace_id: workspaceId },
        select: { extracted_data_json: true },
      }),
    ]);

    return {
      conversation_count: conversationCount,
      total_messages: messageCount,
      first_contact_at: firstMsg?.sent_at?.toISOString() ?? null,
      last_contact_at: lastMsg?.sent_at?.toISOString() ?? null,
      invoice_count: invoiceAgg._count.id,
      total_invoice_amount: Number(invoiceAgg._sum.amount ?? 0),
      deal_count: dealAgg._count.id,
      total_deal_value: Number(dealAgg._sum.value ?? 0),
      extracted_data: parseJsonValue<ExtractedData>(contact?.extracted_data_json, null),
    };
  }

  async extractData(workspaceId: string, contactId: string): Promise<ExtractedData> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspace_id: workspaceId },
      select: { full_name: true, phone: true, email: true, company_name: true },
    });
    if (!contact) throw new Error('Contact not found');

    const messages = await this.prisma.message.findMany({
      where: {
        workspace_id: workspaceId,
        conversation: { contact_id: contactId },
        body_text: { not: null },
      },
      select: { body_text: true, direction: true, sender_name: true, sent_at: true },
      orderBy: { sent_at: 'asc' },
      take: 100,
    });

    if (messages.length === 0) {
      return { notes: 'No hay mensajes para analizar.' };
    }

    const transcript = messages
      .map((m) => `[${m.direction === 'INBOUND' ? 'Cliente' : 'Equipo'}] ${m.sent_at?.toISOString()}: ${m.body_text}`)
      .join('\n');

    const apiKey = await this.getApiKey(workspaceId);
    if (!apiKey) {
      this.logger.warn(`No OpenAI API key for workspace ${workspaceId}`);
      return { notes: 'API Key de OpenAI no configurada.' };
    }

    const client = new OpenAI({ apiKey });

    const prompt = `Analiza la siguiente conversación con un cliente y extrae SOLO datos relevantes para el negocio. NO extraigas datos personales sensibles (no cédulas, no direcciones exactas, no datos bancarios).

Datos a extraer (solo si aparecen en la conversación):
- location: ciudad o zona general mencionada (ej: "San José", "Heredia centro")
- business_needs: qué necesita el cliente (array de frases cortas)
- product_interests: qué productos o servicios le interesan (array)
- order_history: qué ha pedido o quiere pedir (array)
- budget_range: rango de presupuesto mencionado (ej: "$500-$1000")
- decision_timeline: cuándo planea decidir/comprar (ej: "esta semana", "próximo mes")
- key_contacts: otras personas mencionadas relevantes para la venta (array)
- notes: cualquier otra información relevante para el negocio

Responde ÚNICAMENTE con un objeto JSON válido. No incluyas explicaciones ni markdown.

Conversación:
${transcript}`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content || '{}';
      let extracted: ExtractedData;
      try {
        extracted = JSON.parse(raw);
      } catch {
        extracted = { notes: raw.slice(0, 500) };
      }

      extracted.last_extraction_at = new Date().toISOString();

      await this.prisma.contact.update({
        where: { id: contactId },
        data: { extracted_data_json: extracted as any },
      });

      this.logger.log(`Extracted data for contact ${contactId}: ${Object.keys(extracted).join(', ')}`);
      return extracted;
    } catch (err) {
      this.logger.error(`Extraction failed for contact ${contactId}: ${err.message}`);
      throw err;
    }
  }

  private async getApiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
    if (s.ai_provider === 'openai' && s.ai_api_key_enc) {
      try {
        return this.crypto.decrypt(s.ai_api_key_enc);
      } catch {
        this.logger.warn(`Could not decrypt AI key for workspace ${workspaceId}`);
      }
    }
    return process.env.OPENAI_API_KEY || null;
  }
}
