import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

// Ley 8968 CR — Protección de la Persona frente al tratamiento de sus datos personales.
// Personal data must not be kept beyond the purpose for which it was collected.
// These retention windows are the maximum defaults. Workspaces may opt for shorter periods.
const RETENTION_MONTHS = {
  audit_logs: 36,      // compliance audit trail — 3 years
  message_content: 24, // conversation content — 2 years
} as const;

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 2 * * *") // 02:00 UTC daily
  async runRetentionPurge(): Promise<void> {
    this.logger.log("[retention] Starting daily data-retention purge (Ley 8968 CR)");

    const [auditPurged, messagesPurged] = await Promise.allSettled([
      this.purgeOldAuditLogs(),
      this.anonymizeOldMessageContent(),
    ]);

    const auditCount = auditPurged.status === "fulfilled" ? auditPurged.value : 0;
    const msgCount = messagesPurged.status === "fulfilled" ? messagesPurged.value : 0;

    if (auditPurged.status === "rejected") {
      this.logger.error("[retention] audit_logs purge failed", auditPurged.reason);
    }
    if (messagesPurged.status === "rejected") {
      this.logger.error("[retention] message anonymization failed", messagesPurged.reason);
    }

    this.logger.log(
      `[retention] Done — audit_logs deleted: ${auditCount}, messages anonymized: ${msgCount}`,
    );
  }

  // Delete audit log rows older than 36 months. Metadata-only rows contain no PII.
  private async purgeOldAuditLogs(): Promise<number> {
    const cutoff = this.monthsAgo(RETENTION_MONTHS.audit_logs);
    const result = await this.prisma.auditLog.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    this.logger.log(`[retention] audit_logs older than ${RETENTION_MONTHS.audit_logs}mo: ${result.count} deleted`);
    return result.count;
  }

  // Anonymize the body of messages older than 24 months: replace content with a
  // sentinel so conversation thread structure is preserved but PII is gone.
  private async anonymizeOldMessageContent(): Promise<number> {
    const cutoff = this.monthsAgo(RETENTION_MONTHS.message_content);
    const sentinel = "[Contenido eliminado por política de retención]";

    // Raw query for an atomic conditional UPDATE — only touches non-anonymized rows.
    const result = await this.prisma.$executeRaw`
      UPDATE "messages"
      SET "body_text" = ${sentinel},
          "body_html" = NULL,
          "raw_payload_json" = NULL
      WHERE "created_at" < ${cutoff}
        AND ("body_text" IS NULL OR "body_text" != ${sentinel})
    `;

    this.logger.log(
      `[retention] messages older than ${RETENTION_MONTHS.message_content}mo: ${result} anonymized`,
    );
    return result;
  }

  private monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }
}
