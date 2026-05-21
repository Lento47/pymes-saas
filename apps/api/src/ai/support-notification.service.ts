import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Closes the loop after a support case is resolved by sending an
 * in-app notification to the user who reported it. The notification
 * surfaces in the bell icon of the SPA and links back to the
 * diagnostic case.
 *
 * Email delivery was deliberately NOT wired here: importing EmailModule
 * into AiModule would close a circular import (AiModule → EmailModule →
 * ConversationsModule → AiModule, where the last link is eager because
 * ConversationsModule.imports lists AiModule without forwardRef and
 * MessagesService injects AiService directly). Refactoring those two
 * is out of scope for the support pipeline; email follow-ups should
 * live in a separate transactional-email path that doesn't sit inside
 * AiModule's DI graph.
 *
 * Errors are swallowed and logged so a failed notification never rolls
 * back the case status update that triggered it.
 */
@Injectable()
export class SupportNotificationService {
  private readonly logger = new Logger(SupportNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyResolution(diagnosticCaseId: string): Promise<void> {
    const dCase = await (this.prisma as any).supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: {
        id: true,
        workspace_id: true,
        user_id: true,
        title: true,
        module: true,
        resolution_json: true,
      },
    });
    if (!dCase) {
      this.logger.warn(`notifyResolution: diagnostic case ${diagnosticCaseId} not found`);
      return;
    }
    if (!dCase.user_id) {
      // Anonymous report — nothing to notify.
      return;
    }

    const resolution = (dCase.resolution_json as any) || {};
    const summary: string =
      resolution.resolution ||
      resolution.summary ||
      "Tu reporte fue resuelto por el equipo de soporte.";

    await this.notifications
      .create(dCase.workspace_id, {
        user_id: dCase.user_id,
        type: "support_case_resolved",
        title: `Tu reporte fue resuelto: ${dCase.title}`,
        body: summary.slice(0, 500),
        related_entity_type: "support_diagnostic_case",
        related_entity_id: dCase.id,
      })
      .catch((err) => {
        this.logger.warn(`In-app notification failed for case ${dCase.id}: ${err?.message}`);
      });
  }
}
