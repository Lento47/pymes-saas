import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

export const FEEDBACK_EVENT_TYPES = {
  HumanEditedAiReply: "HumanEditedAiReply",
  LeadConverted: "LeadConverted",
  TaskCompleted: "TaskCompleted",
  InvoicePaid: "InvoicePaid",
  CustomerIgnoredFollowUp: "CustomerIgnoredFollowUp",
  AgentEscalated: "AgentEscalated",
} as const;

export type FeedbackEventType = (typeof FEEDBACK_EVENT_TYPES)[keyof typeof FEEDBACK_EVENT_TYPES];

export interface CreateAiFeedbackEventDto {
  workspace_id: string;
  conversation_id?: string;
  message_id?: string;
  contact_id?: string;
  event_type: FeedbackEventType | string;
  original_json?: Record<string, unknown>;
  corrected_json?: Record<string, unknown>;
  outcome_json?: Record<string, unknown>;
}

@Injectable()
export class OutcomeTrackerService {
  private readonly logger = new Logger(OutcomeTrackerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(dto: CreateAiFeedbackEventDto): Promise<void> {
    try {
      await this.prisma.aiFeedbackEvent.create({
        data: {
          workspace_id: dto.workspace_id,
          conversation_id: dto.conversation_id ?? null,
          message_id: dto.message_id ?? null,
          contact_id: dto.contact_id ?? null,
          event_type: dto.event_type,
          original_json: dto.original_json ?? null,
          corrected_json: dto.corrected_json ?? null,
          outcome_json: dto.outcome_json ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record feedback event: ${(err as Error).message}`);
    }
  }

  getRecentForContact(workspaceId: string, contactId: string, limit = 20) {
    return this.prisma.aiFeedbackEvent.findMany({
      where: { workspace_id: workspaceId, contact_id: contactId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }
}
