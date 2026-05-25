import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { AgentChannelScope, AgentStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FlowiseClient } from "../flowise/flowise.client";
import { AgentGuardrailsService } from "./agent-guardrails.service";
import { AgentUsageService } from "./agent-usage.service";

export interface AgentRunOptions {
  agent_instance_id: string;
  workspace_id: string;
  question: string;
  channel: AgentChannelScope;
  conversation_id?: string;
  flowise_session_id?: string;
}

export interface AgentRunResult {
  text: string;
  flowise_session_id: string;
  session_id: string;
}

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);
  private readonly maxOutputChars: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowise: FlowiseClient,
    private readonly guardrails: AgentGuardrailsService,
    private readonly usage: AgentUsageService,
    private readonly config: ConfigService,
  ) {
    this.maxOutputChars =
      this.config.get<number>("FLOWISE_MAX_OUTPUT_CHARS") ?? 4000;
  }

  async run(opts: AgentRunOptions): Promise<AgentRunResult> {
    const started = Date.now();

    // 1. Load — always filter by workspace_id (multi-tenant invariant)
    const instance = await this.prisma.agentInstance.findFirst({
      where: { id: opts.agent_instance_id, workspace_id: opts.workspace_id },
    });
    if (!instance) throw new NotFoundException("Agent instance not found");

    // 2. Validate status
    if (instance.status !== AgentStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        `Agent is not active (status: ${instance.status})`,
      );
    }

    // 3. Validate channel scope
    if (
      instance.channel_scope !== AgentChannelScope.ALL &&
      instance.channel_scope !== opts.channel
    ) {
      throw new UnprocessableEntityException(
        `Agent channel scope (${instance.channel_scope}) does not allow channel ${opts.channel}`,
      );
    }

    // 4. Get or create conversation session
    const flowiseSessionId = opts.flowise_session_id ?? randomUUID();

    let session = opts.flowise_session_id
      ? await this.prisma.agentConversationSession.findFirst({
          where: {
            flowise_session_id: opts.flowise_session_id,
            workspace_id: opts.workspace_id,
          },
        })
      : null;

    if (!session) {
      session = await this.prisma.agentConversationSession.create({
        data: {
          workspace_id: opts.workspace_id,
          agent_instance_id: instance.id,
          conversation_id: opts.conversation_id ?? null,
          flowise_session_id: flowiseSessionId,
          channel: opts.channel,
        },
      });
    }

    // 5. Call Flowise
    if (!this.flowise.isEnabled) {
      throw new ServiceUnavailableException(
        "Flowise integration is disabled (FLOWISE_ENABLED=false)",
      );
    }

    const overrideConfig: Record<string, unknown> = {};
    if (instance.system_instructions) {
      overrideConfig.systemMessagePrompt = instance.system_instructions;
    }

    const flowiseResponse = await this.flowise.predict(instance.chatflow_id, {
      question: opts.question,
      sessionId: session.flowise_session_id,
      ...(Object.keys(overrideConfig).length > 0 && { overrideConfig }),
    });

    // 6. Apply guardrails
    const safeText = this.guardrails.apply(
      flowiseResponse.text,
      this.maxOutputChars,
    );

    // 7. Record usage (fire-and-forget, non-fatal)
    const latency_ms = Date.now() - started;
    void this.usage.record({
      workspace_id: opts.workspace_id,
      agent_instance_id: instance.id,
      session_id: session.id,
      channel: opts.channel,
      input_chars: opts.question.length,
      output_chars: safeText.length,
      latency_ms,
    });

    return {
      text: safeText,
      flowise_session_id: session.flowise_session_id,
      session_id: session.id,
    };
  }
}
