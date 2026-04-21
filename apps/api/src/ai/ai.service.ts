import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Key resolution: settings_json first, env fallback ─────────────────────

  private async getOpenAiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json && typeof ws.settings_json === 'object')
      ? (ws.settings_json as Record<string, any>)
      : {};
    return settings.openai_api_key || process.env.OPENAI_API_KEY || null;
  }

  private async getAnthropicKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json && typeof ws.settings_json === 'object')
      ? (ws.settings_json as Record<string, any>)
      : {};
    return settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY || null;
  }

  private async getGeminiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json && typeof ws.settings_json === 'object')
      ? (ws.settings_json as Record<string, any>)
      : {};
    return settings.gemini_api_key || process.env.GEMINI_API_KEY || null;
  }

  private async getGrokKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json && typeof ws.settings_json === 'object')
      ? (ws.settings_json as Record<string, any>)
      : {};
    return settings.grok_api_key || process.env.GROK_API_KEY || null;
  }

  private async getKimiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const settings = (ws?.settings_json && typeof ws.settings_json === 'object')
      ? (ws.settings_json as Record<string, any>)
      : {};
    return settings.kimi_api_key || process.env.KIMI_API_KEY || null;
  }

  // ── analyzeConversation — priority: Anthropic → Grok → Gemini → Kimi → OpenAI

  async analyzeConversation(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
  ): Promise<AiAnalysisResult | null> {
    if (!messages || messages.length === 0) return null;

    const anthropicKey = await this.getAnthropicKey(workspaceId);
    if (anthropicKey) {
      return this.analyzeWithClaude(workspaceId, conversationId, messages, anthropicKey);
    }

    const grokKey = await this.getGrokKey(workspaceId);
    if (grokKey) {
      return this.analyzeWithOpenAiCompat(workspaceId, conversationId, messages, grokKey, 'https://api.x.ai/v1/chat/completions', 'grok-3-mini', 'Grok');
    }

    const geminiKey = await this.getGeminiKey(workspaceId);
    if (geminiKey) {
      return this.analyzeWithGemini(workspaceId, conversationId, messages, geminiKey);
    }

    const kimiKey = await this.getKimiKey(workspaceId);
    if (kimiKey) {
      return this.analyzeWithOpenAiCompat(workspaceId, conversationId, messages, kimiKey, 'https://api.moonshot.cn/v1/chat/completions', 'kimi-k2', 'Kimi');
    }

    const openaiKey = await this.getOpenAiKey(workspaceId);
    if (!openaiKey) {
      this.logger.warn('Sin API key de IA configurada — omitiendo análisis');
      return null;
    }
    return this.analyzeWithOpenAiCompat(workspaceId, conversationId, messages, openaiKey, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', 'OpenAI');
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  private buildSystemPrompt() {
    return `Eres un asistente de IA para servicio al cliente. Analiza la conversación proporcionada y devuelve un JSON con el siguiente formato exacto (sin markdown, solo JSON puro):
{
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "resumen de 2-3 oraciones en español",
  "category": "billing" | "support" | "sales" | "complaint" | "inquiry",
  "task_title": "título de la tarea si urgencia es HIGH o CRITICAL, sino null",
  "task_description": "descripción de la tarea si urgencia es HIGH o CRITICAL, sino null"
}

Criterios de urgencia:
- LOW: consulta rutinaria, sin problemas críticos
- MEDIUM: problema que necesita atención próxima
- HIGH: problema urgente que afecta al cliente significativamente
- CRITICAL: problema muy crítico, cliente muy molesto o situación grave`;
  }

  private buildConversationText(
    messages: Array<{ direction: string; sender_name: string; body_text: string | null }>,
  ) {
    return messages
      .map(m => `[${m.direction === 'INBOUND' ? 'Cliente' : 'Agente'}] ${m.sender_name}: ${m.body_text ?? ''}`)
      .join('\n');
  }

  private parseAiJson(content: string): AiAnalysisResult | null {
    const clean = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed: AiAnalysisResult = JSON.parse(clean);
    if (!parsed.urgency || !parsed.summary || !parsed.category) return null;
    return parsed;
  }

  // ── OpenAI-compatible provider (OpenAI, Grok, Kimi) ──────────────────────

  private async analyzeWithOpenAiCompat(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
    apiKey: string,
    baseUrl: string,
    model: string,
    providerName: string,
  ): Promise<AiAnalysisResult | null> {
    const conversationText = this.buildConversationText(messages);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            { role: 'user', content: `Analiza esta conversación del workspace ${workspaceId}:\n\n${conversationText}` },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        this.logger.error(`Error de ${providerName} API [${response.status}]: ${await response.text()}`);
        return null;
      }

      const data = await response.json() as any;
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      if (!content) { this.logger.warn(`Respuesta vacía de ${providerName}`); return null; }
      return this.parseAiJson(content);
    } catch (err) {
      this.logger.error(`Error al analizar conversación ${conversationId} con ${providerName}: ${(err as Error).message}`, (err as Error).stack);
      return null;
    }
  }

  // ── Kept for backwards compat (delegates to generic helper) ───────────────

  private async analyzeWithOpenAi(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
    apiKey: string,
  ): Promise<AiAnalysisResult | null> {
    return this.analyzeWithOpenAiCompat(workspaceId, conversationId, messages, apiKey, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', 'OpenAI');
  }

  // ── Gemini implementation ─────────────────────────────────────────────────

  private async analyzeWithGemini(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
    apiKey: string,
  ): Promise<AiAnalysisResult | null> {
    const conversationText = this.buildConversationText(messages);
    const userMessage = `Analiza esta conversación del workspace ${workspaceId}:\n\n${conversationText}`;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: `${this.buildSystemPrompt()}\n\n${userMessage}` }] },
            ],
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(`Error de Gemini API [${response.status}]: ${await response.text()}`);
        return null;
      }

      const data = await response.json() as any;
      const content: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!content) { this.logger.warn('Respuesta vacía de Gemini'); return null; }
      return this.parseAiJson(content);
    } catch (err) {
      this.logger.error(`Error al analizar conversación ${conversationId} con Gemini: ${(err as Error).message}`, (err as Error).stack);
      return null;
    }
  }

  // ── Anthropic/Claude implementation ───────────────────────────────────────

  private async analyzeWithClaude(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
    apiKey: string,
  ): Promise<AiAnalysisResult | null> {
    const conversationText = this.buildConversationText(messages);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: this.buildSystemPrompt(),
          messages: [
            { role: 'user', content: `Analiza esta conversación del workspace ${workspaceId}:\n\n${conversationText}` },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(`Error de Anthropic API [${response.status}]: ${await response.text()}`);
        return null;
      }

      const data = await response.json() as any;
      const content: string = data?.content?.[0]?.text ?? '';
      if (!content) { this.logger.warn('Respuesta vacía de Claude'); return null; }
      return this.parseAiJson(content);
    } catch (err) {
      this.logger.error(`Error al analizar conversación ${conversationId} con Claude: ${(err as Error).message}`, (err as Error).stack);
      return null;
    }
  }

  // ── generatePaymentReminderDraft ──────────────────────────────────────────
  // Priority: Anthropic → Grok → Gemini → Kimi → OpenAI

  async generatePaymentReminderDraft(
    input: {
      customerName: string;
      currency: string;
      amount: string;
      invoiceNumber: string;
      daysOverdue: number;
    },
    workspaceId?: string,
  ): Promise<PaymentReminderDraftResult> {
    const prompt = [
      `Cliente: ${input.customerName}`,
      `Monto adeudado: ${input.currency} ${input.amount}`,
      `Factura: ${input.invoiceNumber}`,
      `Días vencida: ${input.daysOverdue}`,
      ``,
      `Redacta un recordatorio de pago en español.`,
      `Tono: profesional, directo y amigable. Máximo 3 oraciones.`,
      `No incluyas saludos genéricos ni firmas. Solo el cuerpo del mensaje.`,
    ].join('\n');

    if (workspaceId) {
      const anthropicKey = await this.getAnthropicKey(workspaceId);
      if (anthropicKey) {
        return this.paymentReminderWithClaude(prompt, anthropicKey);
      }

      const grokKey = await this.getGrokKey(workspaceId);
      if (grokKey) {
        return this.paymentReminderWithOpenAiCompat(prompt, grokKey, 'https://api.x.ai/v1/chat/completions', 'grok-3-mini');
      }

      const geminiKey = await this.getGeminiKey(workspaceId);
      if (geminiKey) {
        return this.paymentReminderWithGemini(prompt, geminiKey);
      }

      const kimiKey = await this.getKimiKey(workspaceId);
      if (kimiKey) {
        return this.paymentReminderWithOpenAiCompat(prompt, kimiKey, 'https://api.moonshot.cn/v1/chat/completions', 'kimi-k2');
      }
    }

    const openaiKey = workspaceId
      ? await this.getOpenAiKey(workspaceId)
      : process.env.OPENAI_API_KEY || null;

    if (!openaiKey) throw new Error('Sin API key de IA configurada.');

    return this.paymentReminderWithOpenAiCompat(prompt, openaiKey, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini');
  }

  // ── Payment reminder helpers ──────────────────────────────────────────────

  private async paymentReminderWithOpenAiCompat(
    prompt: string,
    apiKey: string,
    baseUrl: string,
    model: string,
  ): Promise<PaymentReminderDraftResult> {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Error de API [${response.status}] (${baseUrl}): ${await response.text()}`);
      throw new Error('No se pudo generar el recordatorio de pago.');
    }

    const data = (await response.json()) as any;
    const draft_text = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!draft_text) throw new Error('El proveedor devolvió un borrador vacío.');
    return { draft_text, tokens_used: data?.usage?.total_tokens ?? 0 };
  }

  private async paymentReminderWithGemini(
    prompt: string,
    apiKey: string,
  ): Promise<PaymentReminderDraftResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      this.logger.error(`Error de Gemini API [${response.status}]: ${await response.text()}`);
      throw new Error('No se pudo generar el recordatorio de pago.');
    }

    const data = (await response.json()) as any;
    const draft_text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!draft_text) throw new Error('Gemini devolvió un borrador vacío.');
    const inputTokens = data?.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data?.usageMetadata?.candidatesTokenCount ?? 0;
    return { draft_text, tokens_used: inputTokens + outputTokens };
  }

  private async paymentReminderWithClaude(
    prompt: string,
    apiKey: string,
  ): Promise<PaymentReminderDraftResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      this.logger.error(`Error de Anthropic API [${response.status}]: ${await response.text()}`);
      throw new Error('No se pudo generar el recordatorio de pago.');
    }

    const data = (await response.json()) as any;
    const draft_text = data?.content?.[0]?.text?.trim() ?? '';
    if (!draft_text) throw new Error('Claude devolvió un borrador vacío.');
    return { draft_text, tokens_used: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0) };
  }
}
