import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface MetricEvent {
  event: string; // e.g. "page_view", "conversation_created", "invoice_sent"
  category?: string; // e.g. "inbox", "billing", "dashboard"
  workspace_plan?: string; // anonymized plan tier
  value?: number; // optional numeric value
  metadata?: Record<string, string>; // extra context (never PII)
}

@Injectable()
export class ProductMetricsService {
  private readonly logger = new Logger(ProductMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Track an anonymous product metric event.
   * NEVER includes PII — only behavior/usage patterns.
   */
  async track(event: MetricEvent): Promise<void> {
    try {
      // Store in error_reports with category 'metric' for lightweight persistence
      // We use the existing table to avoid a migration just for metrics
      await this.prisma.errorReport.create({
        data: {
          source: "product_metric",
          category: event.category ?? event.event,
          severity: "INFO",
          title: event.event,
          message: event.metadata ? JSON.stringify(event.metadata) : null,
          status_code: event.value ?? null,
          context_json: {
            plan: event.workspace_plan,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {
      // Silently fail — metrics are non-critical
    }
  }

  /** Get aggregated metrics for admin dashboard */
  async getAggregatedMetrics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, byEvent, byDay] = await Promise.all([
      this.prisma.errorReport.count({
        where: { source: "product_metric", occurred_at: { gte: since } },
      }),
      this.prisma.errorReport.groupBy({
        by: ["title"],
        where: { source: "product_metric", occurred_at: { gte: since } },
        _count: { title: true },
        orderBy: { _count: { title: "desc" } },
        take: 20,
      }),
      this.prisma.errorReport.findMany({
        where: { source: "product_metric", occurred_at: { gte: since } },
        select: { occurred_at: true, title: true },
        orderBy: { occurred_at: "desc" },
        take: 100,
      }),
    ]);

    return {
      totalEvents: total,
      periodDays: days,
      byEvent: byEvent.map((e) => ({ event: e.title, count: e._count.title })),
      recentActivity: byDay.map((e) => ({ at: e.occurred_at, event: e.title })),
    };
  }

  /** Get workspace-level anonymous usage summary */
  async getWorkspaceUsageSummary(): Promise<{
    totalWorkspaces: number;
    active30d: number;
    byPlan: Record<string, number>;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalWorkspaces, active30d, byPlan] = await Promise.all([
      this.prisma.workspace.count({ where: { status: "ACTIVE" } }),
      this.prisma.workspace.count({
        where: {
          status: "ACTIVE",
          updated_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.workspace.groupBy({
        by: ["plan"],
        where: { status: "ACTIVE" },
        _count: { plan: true },
      }),
    ]);

    const planMap: Record<string, number> = {};
    for (const p of byPlan) planMap[p.plan] = p._count.plan;

    return { totalWorkspaces, active30d, byPlan: planMap };
  }
}
