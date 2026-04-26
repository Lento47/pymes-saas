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

    const workflowId = process.env.OPENAI_AGENT_WORKFLOW_ID || 'wf_69ee50a4431881908f0c86097bc88c0b0e1d93fe68eecbd2';
    if (!workflowId) {
      return { error: 'Workflow ID del agente no configurado en el servidor.' };
    }

    const model = process.env.OPENAI_AGENT_MODEL || 'gpt-5.4';

    const previousResponseId = conversationId || undefined;

    const body: Record<string, any> = {
      model,
      input,
      workflow_id: workflowId,
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

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`OpenAI Responses error ${res.status}: ${text}`);
        return { error: `Error del agente (${res.status}): ${text.slice(0, 300)}` };
      }

      if (!res.body) {
        return { error: 'El agente no devolvió respuesta.' };
      }

      return { stream: res.body, apiKey, model };
    } catch (err) {
      this.logger.error(`Error llamando al workflow: ${(err as Error).message}`);
      return { error: `Error de conexión: ${(err as Error).message}` };
    }
  }
}
