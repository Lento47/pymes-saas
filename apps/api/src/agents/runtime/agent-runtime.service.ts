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
import { StorageService } from "../../common/storage/storage.service";
import { FlowiseClient } from "../flowise/flowise.client";
import { AgentGuardrailsService } from "./agent-guardrails.service";
import { AgentUsageService } from "./agent-usage.service";
import { TtsService } from "../../tts/tts.service";
import { CustomerMemoryService } from "../../learning/customer-memory.service";
import { BusinessMemoryService } from "../../learning/business-memory.service";
import { ConversationInsightService } from "../../learning/conversation-insight.service";

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
  audio_key?: string;
  audio_url?: string;
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
    private readonly tts: TtsService,
    private readonly storage: StorageService,
    private readonly customerMemory: CustomerMemoryService,
    private readonly businessMemory: BusinessMemoryService,
    private readonly conversationInsight: ConversationInsightService,
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

    // Build memory context block (non-fatal)
    let memoryBlock = "";
    try {
      const parts: string[] = [];

      // Fetch contact from conversation if available
      let contactId: string | undefined;
      if (opts.conversation_id) {
        const conv = await this.prisma.conversation.findFirst({
          where: { id: opts.conversation_id, workspace_id: opts.workspace_id },
          select: { contact_id: true },
        });
        contactId = conv?.contact_id ?? undefined;
      }

      const [customerCtx, businessCtx, insightCtx] = await Promise.all([
        contactId
          ? this.customerMemory.buildContextString(opts.workspace_id, contactId)
          : Promise.resolve(""),
        this.businessMemory.buildContextString(opts.workspace_id),
        opts.conversation_id
          ? this.conversationInsight.buildContextString(opts.workspace_id, opts.conversation_id)
          : Promise.resolve(""),
      ]);

      if (customerCtx) parts.push(customerCtx);
      if (businessCtx) parts.push(businessCtx);
      if (insightCtx) parts.push(insightCtx);

      if (parts.length) {
        memoryBlock = `\n\n--- CONTEXTO OPERACIONAL ---\n${parts.join("\n\n")}\n---`;
      }
    } catch (err) {
      this.logger.warn(`Memory context build failed: ${(err as Error).message}`);
    }

    const overrideConfig: Record<string, unknown> = {};
    const systemPrompt = `${instance.system_instructions ?? ""}${memoryBlock}`;
    if (systemPrompt.trim()) {
      overrideConfig.systemMessage = systemPrompt;
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

    // 8. TTS — synthesize voice note if enabled (non-fatal)
    let audio_key: string | undefined;
    let audio_url: string | undefined;

    if (instance.voice_enabled && this.tts.isEnabled) {
      try {
        const audioBuffer = await this.tts.synthesize(
          safeText,
          instance.elevenlabs_voice_id ?? undefined,
        );
        const key = `voice-notes/${opts.workspace_id}/${session.id}-${Date.now()}.mp3`;
        await this.storage.upload(key, audioBuffer, "audio/mpeg");
        audio_key = key;
        audio_url = await this.storage.getPresignedUrl(key, 3600);
      } catch (err) {
        this.logger.error(
          `TTS synthesis failed for agent ${instance.id}: ${(err as Error).message}`,
        );
      }
    }

    return {
      text: safeText,
      flowise_session_id: session.flowise_session_id,
      session_id: session.id,
      ...(audio_key && { audio_key, audio_url }),
    };
  }
}
