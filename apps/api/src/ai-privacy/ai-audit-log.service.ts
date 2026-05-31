import { Injectable, Logger } from "@nestjs/common";
import { AiPurpose } from "./types";

@Injectable()
export class AiAuditLogService {
  private readonly logger = new Logger(AiAuditLogService.name);

  async record(args: {
    workspaceId: string;
    actorId?: string;
    customerId?: string;
    conversationId?: string;
    purpose: AiPurpose;
    piiDetected: string[];
  }): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: "ai_privacy.audit",
        workspaceId: args.workspaceId,
        actorId: args.actorId ?? null,
        customerId: args.customerId ?? null,
        conversationId: args.conversationId ?? null,
        purpose: args.purpose,
        piiDetected: args.piiDetected ?? [],
        createdAt: new Date().toISOString(),
      }),
    );
  }
}
