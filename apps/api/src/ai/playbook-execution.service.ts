import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmprendePlaybookOutput } from "./emprende-playbooks.service";
import { Prisma } from "@prisma/client";

interface PersistPlaybookExecutionInput {
  workspaceId: string;
  userId?: string;
  message: string;
  conversationId?: string;
  contactId?: string;
  output: EmprendePlaybookOutput;
}

@Injectable()
export class PlaybookExecutionService {
  constructor(private readonly prisma: PrismaService) {}

  async persistExecution(input: PersistPlaybookExecutionInput): Promise<{ runbookExecutionId: string }> {
    const execution = await this.prisma.runbookExecution.create({
      data: {
        workspace_id: input.workspaceId,
        executed_by_user_id: input.userId,
        runbook_name: "emprende.playbook.run",
        status: "SUCCESS",
        parameters_json: {
          message: input.message,
          conversation_id: input.conversationId ?? null,
          contact_id: input.contactId ?? null,
        },
        result_json: input.output as unknown as Prisma.InputJsonValue,
        completed_at: new Date(),
      },
      select: { id: true },
    });

    return { runbookExecutionId: execution.id };
  }

  async createEscalationTask(input: PersistPlaybookExecutionInput): Promise<{ taskId: string } | null> {
    if (!input.output.escalationRequired) return null;

    const dedupeKey = this.buildDedupeKey(input.output.intent, input.conversationId, input.contactId);
    const existing = await this.prisma.task.findFirst({
      where: {
        workspace_id: input.workspaceId,
        source: "MESSAGE",
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
        metadata_json: {
          path: ["playbook_dedupe_key"],
          equals: dedupeKey,
        },
      },
      select: { id: true },
      orderBy: { created_at: "desc" },
    });

    if (existing) {
      await this.prisma.task.update({
        where: { id: existing.id },
        data: {
          description: input.output.reply,
          priority: "HIGH",
          metadata_json: {
            playbook_dedupe_key: dedupeKey,
            escalation_state: "PENDING_HUMAN",
            intent: input.output.intent,
            capability_tier: input.output.capabilityTier,
            required_fields: input.output.requiredFields,
            allowed_actions: input.output.allowedActions,
            forbidden_actions: input.output.forbiddenActions,
          },
        },
      });
      return { taskId: existing.id };
    }

    const task = await this.prisma.task.create({
      data: {
        workspace_id: input.workspaceId,
        conversation_id: input.conversationId ?? null,
        contact_id: input.contactId ?? null,
        source: "MESSAGE",
        title: `Escalación IA: ${input.output.intent}`,
        description: input.output.reply,
        priority: "HIGH",
        due_at: this.calculateSlaDueAt(input.output.intent),
        metadata_json: {
          playbook_dedupe_key: dedupeKey,
          escalation_state: "PENDING_HUMAN",
          intent: input.output.intent,
          capability_tier: input.output.capabilityTier,
          required_fields: input.output.requiredFields,
          allowed_actions: input.output.allowedActions,
          forbidden_actions: input.output.forbiddenActions,
        },
      },
      select: { id: true },
    });

    return { taskId: task.id };
  }

  private calculateSlaDueAt(intent: EmprendePlaybookOutput["intent"]): Date {
    const now = Date.now();
    const minutesByIntent: Record<EmprendePlaybookOutput["intent"], number> = {
      payment_reported: 10,
      human_handoff: 15,
      order_status: 20,
      booking: 30,
      sales_quote: 45,
      support_faq: 45,
      off_topic: 60,
    };
    return new Date(now + minutesByIntent[intent] * 60 * 1000);
  }

  private buildDedupeKey(
    intent: EmprendePlaybookOutput["intent"],
    conversationId?: string,
    contactId?: string,
  ): string {
    return [intent, conversationId ?? "none", contactId ?? "none"].join(":");
  }
}
