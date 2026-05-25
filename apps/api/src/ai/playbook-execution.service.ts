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

    const task = await this.prisma.task.create({
      data: {
        workspace_id: input.workspaceId,
        conversation_id: input.conversationId ?? null,
        contact_id: input.contactId ?? null,
        source: "MESSAGE",
        title: `Escalación IA: ${input.output.intent}`,
        description: input.output.reply,
        priority: "HIGH",
        metadata_json: {
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
}
