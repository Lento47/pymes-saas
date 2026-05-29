import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Intent } from "./types";

export interface AuditLogInput {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  intent: Intent;
  agentUsed: string;
  llmUsed: boolean;
  toolsUsed: string[];
  policyDecision: string;
  sendMode: string;
  humanApprovalRequired: boolean;
}

@Injectable()
export class AiDecisionAuditService {
  private readonly logger = new Logger(AiDecisionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.aiDecisionAuditLog.create({
        data: {
          workspace_id: input.workspaceId,
          conversation_id: input.conversationId,
          message_id: input.messageId,
          intent: input.intent,
          agent_used: input.agentUsed,
          llm_used: input.llmUsed,
          tools_used: input.toolsUsed,
          policy_decision: input.policyDecision,
          send_mode: input.sendMode,
          human_approval_required: input.humanApprovalRequired,
        },
      });
    } catch (err: unknown) {
      // Audit failures must never block message processing
      this.logger.warn(
        `[audit] Failed to record: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
