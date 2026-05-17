import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Phase 4 — turns resolved diagnostic cases into knowledge-base
 * entries so the same error code matches faster next time.
 *
 * Policy:
 *   - We only auto-learn from cases with a non-empty error_code AND
 *     a resolution.resolution body that's at least 50 characters.
 *     Anything below that bar is too vague to be useful and would
 *     pollute the catalog.
 *   - If a SupportKnownIssue already exists with the same
 *     error_code:
 *       * Increment seen_count, refresh last_seen_*.
 *       * Update workaround/description ONLY if the existing entry
 *         was previously auto-learned. Manually-curated entries
 *         (auto_learned=false) are never overwritten — ops owns
 *         that text.
 *   - If no entry exists: create a new one with auto_learned=true,
 *     fix_status='WORKAROUND_AVAILABLE'. Treats the description and
 *     workaround as the resolution payload from the diagnostic case.
 *
 * Fire-and-forget: caller should not await this. Failures are
 * logged and swallowed.
 */
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async learnFromCase(diagnosticCaseId: string): Promise<void> {
    const dCase = await (this.prisma as any).supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: {
        id: true,
        error_code: true,
        module: true,
        category: true,
        risk_level: true,
        title: true,
        safe_summary: true,
        resolution_json: true,
      },
    });
    if (!dCase) return;

    // Filter 1: must have an error_code to be addressable.
    if (!dCase.error_code) {
      return;
    }

    // Filter 2: extract resolution body and require a minimum length
    // so we don't promote one-line shrugs into the catalog.
    const resolution = (dCase.resolution_json as any) || {};
    const body: string =
      resolution.resolution || resolution.summary || '';
    const workaround: string = resolution.workaround || '';
    const longestField = body.length >= workaround.length ? body : workaround;
    if (longestField.length < 50) {
      return;
    }

    // Look up existing known-issue entry.
    const existing = await (this.prisma as any).supportKnownIssue.findUnique({
      where: { error_code: dCase.error_code },
    });

    if (existing) {
      const data: Record<string, any> = {
        seen_count: { increment: 1 },
        last_seen_case_id: dCase.id,
        last_seen_at: new Date(),
      };
      // Only refresh content if the existing entry was auto-learned
      // (i.e. ops hasn't curated it). Hands-off for manual rows.
      if (existing.auto_learned) {
        if (body.length > (existing.description?.length ?? 0)) {
          data.description = body;
        }
        if (workaround.length > (existing.workaround?.length ?? 0)) {
          data.workaround = workaround;
        }
      }

      await (this.prisma as any).supportKnownIssue
        .update({ where: { error_code: dCase.error_code }, data })
        .catch((err) => {
          this.logger.warn(
            `Failed to refresh known-issue ${dCase.error_code}: ${err?.message}`,
          );
        });

      this.logger.log(
        `Refreshed known-issue ${dCase.error_code} (seen_count++, auto_learned=${existing.auto_learned})`,
      );
      return;
    }

    // No existing entry — create as auto-learned.
    await (this.prisma as any).supportKnownIssue
      .create({
        data: {
          error_code: dCase.error_code,
          title: dCase.title || `Resolved: ${dCase.error_code}`,
          module: dCase.module,
          category: dCase.category,
          severity: dCase.risk_level,
          description: body || dCase.safe_summary || dCase.title,
          workaround: workaround || null,
          fix_status: 'WORKAROUND_AVAILABLE',
          is_active: true,
          auto_learned: true,
          seen_count: 1,
          last_seen_case_id: dCase.id,
          last_seen_at: new Date(),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to create auto-learned known-issue ${dCase.error_code}: ${err?.message}`,
        );
      });

    this.logger.log(
      `Auto-learned new known-issue ${dCase.error_code} from case ${dCase.id}`,
    );
  }
}
