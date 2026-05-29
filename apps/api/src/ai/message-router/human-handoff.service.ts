import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { EventsGateway } from "../../gateways/events.gateway";

@Injectable()
export class HumanHandoffService {
  private readonly logger = new Logger(HumanHandoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Marks the conversation as HUMAN_ACTIVE, notifies all OWNER/ADMIN/AGENT
   * workspace members, and emits a real-time event.
   * Never throws.
   */
  async triggerHandoff(
    workspaceId: string,
    conversationId: string,
    reason: string,
  ): Promise<void> {
    try {
      // Update ai_state to HUMAN_ACTIVE
      const conv = await this.prisma.conversation.findFirst({
        where: { id: conversationId, workspace_id: workspaceId },
        select: { metadata_json: true },
      });
      if (!conv) return;

      const meta = ((conv.metadata_json as Record<string, unknown>) ?? {});
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata_json: { ...meta, ai_state: "HUMAN_ACTIVE" } },
      });

      // Notify workspace agents
      const members = await this.prisma.workspaceUser.findMany({
        where: { workspace_id: workspaceId, role: { in: ["OWNER", "ADMIN", "AGENT"] } },
        select: { user_id: true },
      });

      for (const { user_id } of members) {
        await this.notifications
          .create(workspaceId, {
            user_id,
            type: "human_handoff_requested",
            title: "Un cliente solicita atención humana",
            body: reason.slice(0, 200),
            related_entity_type: "conversation",
            related_entity_id: conversationId,
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `[human-handoff] notification failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }

      // Real-time push so the inbox reflects the state change immediately
      this.events.emitConversationUpdated(workspaceId, {
        id: conversationId,
        ai_state: "HUMAN_ACTIVE",
      });

      this.logger.log(
        `[human-handoff] conv=${conversationId} workspace=${workspaceId} reason="${reason.slice(0, 80)}"`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[human-handoff] failed conv=${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
