import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { PaypalPaymentStatus } from "@prisma/client";

/** Maximum time an order is allowed to stay in PROCESSING state. */
const PROCESSING_STALE_MINUTES = 15;

@Injectable()
export class BillingRecoveryService {
  private readonly logger = new Logger(BillingRecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detects billing inconsistencies for platform admin visibility.
   * Does NOT auto-fix anything — returns findings for human review.
   */
  async detectInconsistencies() {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - PROCESSING_STALE_MINUTES * 60 * 1000);

    const [staleProcessing, failedOrders, activeSubsCount, cancelledSubsCount] = await Promise.all([
      // Orders stuck in PROCESSING for > threshold (may indicate capture API failure)
      this.prisma.paypalPaymentOrder.findMany({
        where: {
          status: PaypalPaymentStatus.PROCESSING,
          updated_at: { lt: staleThreshold },
        },
        select: {
          id: true,
          workspace_id: true,
          order_id: true,
          amount: true,
          purchase_type: true,
          updated_at: true,
        },
        orderBy: { updated_at: "asc" },
        take: 50,
      }),

      // FAILED orders in the last 24h for ops awareness
      this.prisma.paypalPaymentOrder.findMany({
        where: {
          status: PaypalPaymentStatus.FAILED,
          updated_at: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          workspace_id: true,
          order_id: true,
          amount: true,
          purchase_type: true,
          updated_at: true,
        },
        orderBy: { updated_at: "desc" },
        take: 50,
      }),

      // Active subscriptions count
      this.prisma.workspaceSubscription.count({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
      }),

      // Cancelled subscriptions in last 7 days
      this.prisma.workspaceSubscription.count({
        where: {
          status: "CANCELLED",
          updated_at: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      stale_processing_orders: {
        count: staleProcessing.length,
        threshold_minutes: PROCESSING_STALE_MINUTES,
        items: staleProcessing.map((o) => ({
          id: o.id,
          workspace_id: o.workspace_id,
          order_id: o.order_id,
          amount: o.amount,
          purchase_type: o.purchase_type,
          stuck_since: o.updated_at,
        })),
      },
      failed_orders_24h: {
        count: failedOrders.length,
        items: failedOrders.map((o) => ({
          id: o.id,
          workspace_id: o.workspace_id,
          purchase_type: o.purchase_type,
          amount: o.amount,
          failed_at: o.updated_at,
        })),
      },
      subscriptions: {
        active: activeSubsCount,
        cancelled_last_7d: cancelledSubsCount,
      },
      checked_at: now.toISOString(),
    };
  }

  /**
   * Safe repair: revert stale PROCESSING orders to FAILED.
   * Only safe to call for orders that genuinely stalled — verify
   * with `detectInconsistencies` first.
   * Returns number of orders reverted.
   */
  async revertStaleProcessingOrders(): Promise<{ reverted: number; order_ids: string[] }> {
    const staleThreshold = new Date(Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000);

    const stale = await this.prisma.paypalPaymentOrder.findMany({
      where: {
        status: PaypalPaymentStatus.PROCESSING,
        updated_at: { lt: staleThreshold },
      },
      select: { id: true, order_id: true, workspace_id: true },
    });

    if (stale.length === 0) return { reverted: 0, order_ids: [] };

    await this.prisma.paypalPaymentOrder.updateMany({
      where: {
        status: PaypalPaymentStatus.PROCESSING,
        updated_at: { lt: staleThreshold },
      },
      data: { status: PaypalPaymentStatus.FAILED },
    });

    this.logger.warn(
      `[billing-recovery] Reverted ${stale.length} stale PROCESSING orders to FAILED: ` +
      stale.map((o) => o.order_id).join(", "),
    );

    return {
      reverted: stale.length,
      order_ids: stale.map((o) => o.order_id),
    };
  }
}
