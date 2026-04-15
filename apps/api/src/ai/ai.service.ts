import { Injectable, Logger } from '@nestjs/common';

export interface AiAnalysisResult {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  category: string;
  task_title: string | null;
  task_description: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async analyzeConversation(
    workspaceId: string,
    conversationId: string,
    messages: Array<{ direction: string; sender_name: string; body_text: string | null; sent_at: Date }>,
  ): Promise<AiAnalysisResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY no está configurado — omitiendo análisis de IA');
      return null;
    }

    if (!messages || messages.length === 0) {
      return null;
    }

    const conversationText = messages
      .map(
        (m) =>
          `[${m.direction === 'INBOUND' ? 'Cliente' : 'Agente'}] ${m.sender_name}: ${m.body_text ?? ''}`,
      )
      .join('\n');

    const systemPrompt = `Eres un asistente de IA para servicio al cliente. Analiza la conversación proporcionada y devuelve un JSON con el siguiente formato exacto (sin markdown, solo JSON puro):
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

    const userPrompt = `Analiza esta conversación del workspace ${workspaceId}:\n\n${conversationText}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error de OpenAI API [${response.status}]: ${errorText}`,
        );
        return null;
      }

      const data = await response.json() as any;
      const content: string = data?.choices?.[0]?.message?.content ?? '';

      if (!content) {
        this.logger.warn('Respuesta vacía de OpenAI');
        return null;
      }

      // Strip potential markdown code fences
      const cleanContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: AiAnalysisResult = JSON.parse(cleanContent);

      // Validate required fields
      if (!parsed.urgency || !parsed.summary || !parsed.category) {
        this.logger.warn('Respuesta de OpenAI con campos faltantes', parsed);
        return null;
      }

      return parsed;
    } catch (err) {
      this.logger.error(
        `Error al analizar conversación ${conversationId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return null;
    }
  }
}
