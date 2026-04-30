import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue } from '../common/prisma/json';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'moonshot';

export interface AiProviderConfig {
  provider: AiProvider;
  api_key: string;
  model: string;
}

export interface AiAnalysisResult {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  category: string;
  task_title: string | null;
  task_description: string | null;
}

export interface PaymentReminderDraftResult {
  draft_text: string;
  tokens_used: number;
}

// Default models per provider
const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini:    'gemini-2.0-flash',
  moonshot:  'moonshot-v1-8k',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── Resolve workspace AI config, fallback to env ───────────────────────────

  getDefaultModel(provider: AiProvider): string {
    return DEFAULT_MODELS[provider];
  }

  async getWorkspaceConfig(workspaceId: string): Promise<AiProviderConfig | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});

    if (s.ai_provider && s.ai_api_key_enc) {
      try {
        const api_key = this.crypto.decrypt(s.ai_api_key_enc);
        const provider = s.ai_provider as AiProvider;
        const model = s.ai_model || DEFAULT_MODELS[provider];
        return { provider, api_key, model };
      } catch {
        this.logger.warn(`No se pudo desencriptar API key del workspace ${workspaceId}`);
      }
    }

    return null;
  }

  async getConfig(workspaceId: string): Promise<AiProviderConfig | null> {
    // SECURITY: Require workspace-specific configuration, never use shared env var API keys
    return await this.getWorkspaceConfig(workspaceId);
  }

  // ── Unified chat call — all providers ─────────────────────────────────────

  private async chat(
    config: AiProviderConfig,
    system: string,
    user: string,
    maxTokens = 500,
    temperature = 0.3,
  ): Promise<{ text: string; tokens: number }> {
    switch (config.provider) {
      case 'openai':
      case 'moonshot':
        return this.chatOpenAICompat(config, system, user, maxTokens, temperature);
      case 'anthropic':
        return this.chatAnthropic(config, system, user, maxTokens, temperature);
      case 'gemini':
        return this.chatGemini(config, system, user, maxTokens, temperature);
    }
  }

  // OpenAI + Moonshot (same wire format)
  private async chatOpenAICompat(
    config: AiProviderConfig,
    system: string,
    user: string,
    maxTokens: number,
    temperature: number,
  ) {
    const base = config.provider === 'moonshot'
      ? 'https://api.moonshot.cn/v1'
      : 'https://api.openai.com/v1';

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api_key}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`${config.provider} API error ${res.status}:`, errorText);
      throw new Error('Failed to process with AI. Please try again later.');
    }
    const d = await res.json() as any;
    return { text: d.choices[0].message.content?.trim() ?? '', tokens: d.usage?.total_tokens ?? 0 };
  }

  // Anthropic
  private async chatAnthropic(
    config: AiProviderConfig,
    system: string,
    user: string,
    maxTokens: number,
    temperature: number,
  ) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system,
        messages: [{ role: 'user', content: user }],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Anthropic API error ${res.status}:`, errorText);
      throw new Error('Failed to process with AI. Please try again later.');
    }
    const d = await res.json() as any;
    return {
      text: d.content?.[0]?.text?.trim() ?? '',
      tokens: (d.usage?.input_tokens ?? 0) + (d.usage?.output_tokens ?? 0),
    };
  }

  // Gemini
  private async chatGemini(
    config: AiProviderConfig,
    system: string,
    user: string,
    maxTokens: number,
    temperature: number,
  ) {
    // SECURITY: Use header for API key instead of URL query parameter to avoid logging
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api_key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Gemini API error ${res.status}:`, errorText);
      throw new Error('Failed to process with AI. Please try again later.');
    }
    const d = await res.json() as any;
    return {
      text: d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '',
      tokens: (d.usageMetadata?.totalTokenCount ?? 0),
    };
  }

  // ── Public methods ─────────────────────────────────────────────────────────

  async testConnection(config: AiProviderConfig): Promise<{
    provider: AiProvider;
    model: string;
    reply: string;
    tokens_used: number;
    latency_ms: number;
  }> {
    const startedAt = Date.now();
    const { text, tokens } = await this.chat(
      config,
      'Responde con una confirmacion breve en espanol para validar conectividad de API.',
      'Devuelve exactamente una frase corta confirmando que la conexion funciona.',
      60,
      0,
    );

    return {
      provider: config.provider,
      model: config.model,
      reply: text,
      tokens_used: tokens,
      latency_ms: Date.now() - startedAt,
    };
  }

  async analyzeConversation(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
  ): Promise<AiAnalysisResult | null> {
    const config = await this.getConfig(workspaceId);
    if (!config) {
      this.logger.warn('Sin configuración de IA — omitiendo análisis');
      return null;
    }
    if (!messages?.length) return null;

    const conversationText = messages
      .map(m => `[${m.direction === 'INBOUND' ? 'Cliente' : 'Agente'}] ${m.sender_name}: ${m.body_text ?? ''}`)
      .join('\n');

    const system = `Eres un asistente de IA para servicio al cliente. Analiza la conversación y devuelve JSON puro (sin markdown):
{
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "resumen 2-3 oraciones en español",
  "category": "billing" | "support" | "sales" | "complaint" | "inquiry",
  "task_title": "título si urgencia HIGH/CRITICAL, sino null",
  "task_description": "descripción si urgencia HIGH/CRITICAL, sino null"
}`;

    try {
      const { text } = await this.chat(config, system, conversationText, 500, 0.3);
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed: AiAnalysisResult = JSON.parse(clean);
      if (!parsed.urgency || !parsed.summary || !parsed.category) return null;
      return parsed;
    } catch (err) {
      this.logger.error(`Error analizando conversación ${conversationId}: ${(err as Error).message}`);
      return null;
    }
  }

  async generatePaymentReminderDraft(input: {
    workspaceId: string;
    customerName: string;
    currency: string;
    amount: string;
    invoiceNumber: string;
    daysOverdue: number;
  }): Promise<PaymentReminderDraftResult> {
    const config = await this.getConfig(input.workspaceId);
    if (!config) throw new Error('No hay API key de IA configurada. Configúrala en Ajustes → Inteligencia Artificial.');

    const isOverdue = input.daysOverdue > 0;
    const system = isOverdue
      ? 'Eres un asistente de cobros profesional. Redacta mensajes de recordatorio de pago en español.'
      : 'Eres un asistente de facturación y cobro profesional. Redacta mensajes breves para enviar una factura o solicitar confirmación de pago en español.';
    const user = [
      `Cliente: ${input.customerName}`,
      `Monto adeudado: ${input.currency} ${input.amount}`,
      `Factura: ${input.invoiceNumber}`,
      `Estado temporal: ${isOverdue ? `vencida por ${input.daysOverdue} día(s)` : 'no vencida'}`,
      ``,
      isOverdue
        ? `Redacta un recordatorio de pago en español. Tono: profesional, directo y amigable.`
        : `Redacta un mensaje de envío de factura o cobro inicial en español. Tono: profesional, claro y amigable.`,
      `Máximo 3 oraciones. Sin saludos genéricos ni firmas. Solo el cuerpo del mensaje.`,
    ].join('\n');

    const { text, tokens } = await this.chat(config, system, user, 200, 0.4);
    if (!text) throw new Error('La IA devolvió un borrador vacío.');
    return { draft_text: text, tokens_used: tokens };
  }

  async analyzeDocument(
    workspaceId: string,
    meta: { fileName: string; mimeType: string; fileSize: number; ocrText?: string },
  ): Promise<{ extractedText: string; summary: string; extractedData: any } | null> {
    const config = await this.getConfig(workspaceId);
    if (!config) return null;

    const hasRealOcr = meta.ocrText && meta.ocrText.length > 50 && !meta.ocrText.startsWith(meta.fileName);

    if (!hasRealOcr) {
      return null; // skip AI — no meaningful text to analyze
    }

    const system = `Eres un asistente de extracción de documentos. Extrae y estructura la información del siguiente texto obtenido por OCR.
Responde en formato JSON puro: { "extractedText": "<texto original>", "summary": "<resumen conciso en español>", "extractedData": { "docType": "<tipo de documento>", "total": <monto numérico si es factura>, "date": "<fecha si se encuentra>", "entities": ["<nombres de empresas o personas>"] } }`;

    const user = `Documento: ${meta.fileName} (${(meta.fileSize / 1024).toFixed(1)} KB)\n\nTexto extraído:\n${meta.ocrText!.slice(0, 4000)}`;

    try {
      const { text } = await this.chat(config, system, user, 500, 0.3);
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
}
