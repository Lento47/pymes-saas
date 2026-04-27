import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { parseJsonValue } from '../common/prisma/json';
import { AiProvider, AiProviderConfig } from './ai.service';

const OPENAI_BASE = 'https://api.openai.com/v1';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getAgentApiKey(workspaceId: string): Promise<string | null> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });

    const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});

    if (s.ai_provider === 'openai' && s.ai_api_key_enc) {
      try {
        return this.crypto.decrypt(s.ai_api_key_enc);
      } catch {
        this.logger.warn(`No se pudo desencriptar API key del workspace ${workspaceId}`);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }

    return null;
  }

  async streamWorkflow(
    workspaceId: string,
    input: string,
    conversationId?: string,
  ): Promise<{ stream: ReadableStream; apiKey: string; model: string } | { error: string }> {
    const apiKey = await this.getAgentApiKey(workspaceId);
    if (!apiKey) {
      return { error: 'API Key de OpenAI no configurada. Ve a Ajustes → IA.' };
    }

    // Check consent settings
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings_json: true },
    });
    const s = parseJsonValue<Record<string, any>>(ws?.settings_json, {});
    const agentEnabled = s.ai_agent_enabled === true;

    // Build context with user data if consent is given
    let inputWithContext = input;
    if (agentEnabled) {
      try {
        const [tasks, invoices, contacts, stats] = await Promise.all([
          this.prisma.task.findMany({
            where: { workspace_id: workspaceId, status: { in: ['TODO', 'IN_PROGRESS'] } },
            select: { title: true, priority: true, status: true, due_at: true },
            take: 10,
            orderBy: { created_at: 'desc' },
          }),
          this.prisma.invoice.findMany({
            where: { workspace_id: workspaceId },
            select: { number: true, amount: true, status: true, due_date: true },
            take: 10,
            orderBy: { due_date: 'desc' },
          }),
          this.prisma.contact.findMany({
            where: { workspace_id: workspaceId },
            select: { full_name: true, email: true, type: true },
            take: 10,
          }),
          this.prisma.workspaceSubscription.findFirst({
            where: { workspace_id: workspaceId },
            select: { plan: true, status: true },
          }),
        ]);

        const contextParts: string[] = [];
        if (tasks.length > 0) {
          contextParts.push(`Tareas pendientes: ${tasks.map(t => `${t.title} (${t.priority}, ${t.status}${t.due_at ? ', vence '+new Date(t.due_at).toLocaleDateString() : ''})`).join('; ')}`);
        }
        if (invoices.length > 0) {
          contextParts.push(`Facturas: ${invoices.map(i => `${i.number}: ₡${i.amount} (${i.status}, vence ${new Date(i.due_date).toLocaleDateString()})`).join('; ')}`);
        }
        if (contacts.length > 0) {
          contextParts.push(`Contactos: ${contacts.map(c => `${c.full_name} (${c.type})`).join('; ')}`);
        }
        if (stats) {
          contextParts.push(`Plan: ${stats.plan}, Estado suscripción: ${stats.status}`);
        }
        if (contextParts.length > 0) {
          inputWithContext = `Contexto del usuario:\n${contextParts.join('\n')}\n\nPregunta del usuario: ${input}`;
        }
      } catch (err) {
        this.logger.warn(`Error fetching agent context: ${(err as Error).message}`);
      }
    }

    const model = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1';

    const previousResponseId = conversationId || undefined;

    const body: Record<string, any> = {
      model,
      input: inputWithContext,
      stream: true,
    };

    if (previousResponseId) {
      body.previous_response_id = previousResponseId;
    }

    try {
      const res = await fetch(`${OPENAI_BASE}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      }
    }
}
