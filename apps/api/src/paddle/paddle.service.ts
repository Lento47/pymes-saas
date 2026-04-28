import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BillingProvider, WorkspacePlan, WorkspaceSubscriptionStatus, BillingInterval } from '@prisma/client';

// Maps Paddle price IDs (set as env vars) to workspace plans
function buildPriceMap(): Record<string, WorkspacePlan> {
  const map: Record<string, WorkspacePlan> = {};
  const entries: [string | undefined, WorkspacePlan][] = [
    [process.env.PADDLE_PRICE_STARTER_MONTHLY, WorkspacePlan.STARTER],
    [process.env.PADDLE_PRICE_GROWTH_MONTHLY, WorkspacePlan.GROWTH],
    [process.env.PADDLE_PRICE_BUSINESS_MONTHLY, WorkspacePlan.BUSINESS],
    [process.env.PADDLE_PRICE_BUSINESS_PLUS_MONTHLY, WorkspacePlan.BUSINESS_PLUS],
    // Legacy mappings for backward compatibility
    [process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY, WorkspacePlan.BUSINESS],
  ];
  for (const [priceId, plan] of entries) {
    if (priceId) map[priceId] = plan;
  }
  return map;
}

function mapSubscriptionStatus(paddleStatus: string): WorkspaceSubscriptionStatus {
  switch (paddleStatus) {
    case 'active': return WorkspaceSubscriptionStatus.ACTIVE;
    case 'trialing': return WorkspaceSubscriptionStatus.TRIALING;
    case 'past_due': return WorkspaceSubscriptionStatus.PAST_DUE;
    case 'paused': return WorkspaceSubscriptionStatus.PAST_DUE;
    case 'cancelled': return WorkspaceSubscriptionStatus.CANCELLED;
    default: return WorkspaceSubscriptionStatus.ACTIVE;
  }
}

@Injectable()
export class PaddleService {
  private readonly logger = new Logger(PaddleService.name);
  private readonly priceMap = buildPriceMap();

  constructor(private readonly prisma: PrismaService) {}

  async findProcessedEvent(notificationId: string) {
    return this.prisma.billingEvent.findFirst({
      where: { provider_event_id: notificationId, provider: BillingProvider.PADDLE },
      select: { id: true },
    });
  }

  async handleEvent(eventType: string, data: any, notificationId?: string): Promise<void> {
    this.logger.log(`Paddle event: ${eventType}`);

    switch (eventType) {
      case 'transaction.completed':
        await this.handleTransactionCompleted(data);
        break;
      case 'subscription.created':
      case 'subscription.updated':
        await this.handleSubscriptionUpsert(data);
        break;
      case 'subscription.cancelled':
        await this.handleSubscriptionCancelled(data);
        break;
      default:
        this.logger.debug(`Unhandled Paddle event: ${eventType}`);
    }
  }

  // ─── transaction.completed ───────────────────────────────────────────────────

  private async handleTransactionCompleted(data: any): Promise<void> {
    const customData = data?.custom_data ?? {};
    const workspaceSlug: string | undefined = customData?.workspaceSlug;
    const customerId: string | undefined = data?.customer_id;
    const subscriptionId: string | undefined = data?.subscription_id;
    const priceId: string | undefined = data?.items?.[0]?.price?.id;
    const plan = priceId ? this.priceMap[priceId] : undefined;

    if (!plan) {
      this.logger.warn(`transaction.completed: unknown price ID ${priceId}`);
      return;
    }

    const workspace = await this.resolveWorkspace(workspaceSlug, customerId);
    if (!workspace) {
      this.logger.warn(`transaction.completed: workspace not found (slug=${workspaceSlug}, customer=${customerId})`);
      return;
    }

    await this.upsertSubscription(workspace.id, {
      plan,
      status: WorkspaceSubscriptionStatus.ACTIVE,
      provider_customer_id: customerId,
      provider_subscription_id: subscriptionId,
      period_start: data?.billing_period?.starts_at,
      period_end: data?.billing_period?.ends_at,
      event_type: 'transaction.completed',
      paddle_event_id: data?.id,
      payload: data,
    });
  }

  // ─── subscription.created / subscription.updated ─────────────────────────────

  private async handleSubscriptionUpsert(data: any): Promise<void> {
    const customData = data?.custom_data ?? {};
    const workspaceSlug: string | undefined = customData?.workspaceSlug;
    const customerId: string | undefined = data?.customer_id;
    const subscriptionId: string | undefined = data?.id;
    const priceId: string | undefined = data?.items?.[0]?.price?.id;
    const plan = priceId ? this.priceMap[priceId] : undefined;
    const status = mapSubscriptionStatus(data?.status ?? '');

    if (!plan) {
      this.logger.warn(`subscription event: unknown price ID ${priceId}`);
      return;
    }

    const workspace = await this.resolveWorkspace(workspaceSlug, customerId);
    if (!workspace) {
      this.logger.warn(`subscription event: workspace not found (slug=${workspaceSlug}, customer=${customerId})`);
      return;
    }

    await this.upsertSubscription(workspace.id, {
      plan,
      status,
      provider_customer_id: customerId,
      provider_subscription_id: subscriptionId,
      period_start: data?.current_billing_period?.starts_at,
      period_end: data?.current_billing_period?.ends_at,
      cancel_at_period_end: !!data?.scheduled_change?.action === 'cancel',
      event_type: 'subscription.upsert',
      paddle_event_id: subscriptionId,
      payload: data,
    });
  }

  // ─── subscription.cancelled ───────────────────────────────────────────────────

  private async handleSubscriptionCancelled(data: any): Promise<void> {
    const subscriptionId: string | undefined = data?.id;
    const customerId: string | undefined = data?.customer_id;

    const subscription = await this.prisma.workspaceSubscription.findFirst({
      where: {
        OR: [
          { provider_subscription_id: subscriptionId },
          { provider_customer_id: customerId },
        ],
        provider: BillingProvider.PADDLE,
      },
      select: { id: true, workspace_id: true },
    });

    if (!subscription) {
      this.logger.warn(`subscription.cancelled: no subscription found for ${subscriptionId}`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.workspaceSubscription.update({
        where: { id: subscription.id },
        data: {
          status: WorkspaceSubscriptionStatus.CANCELLED,
          cancel_at_period_end: false,
        },
      }),
      this.prisma.billingEvent.create({
        data: {
          workspace_id: subscription.workspace_id,
          subscription_id: subscription.id,
          provider: BillingProvider.PADDLE,
          source: 'WEBHOOK',
          event_type: 'subscription.cancelled',
          provider_event_id: data?.id ?? null,
          applied_plan: null,
          payload_json: JSON.stringify(data),
          processed_at: new Date(),
        },
      }),
    ]);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveWorkspace(slug?: string, customerId?: string) {
    if (slug) {
      const ws = await this.prisma.workspace.findUnique({
        where: { slug },
        select: { id: true, plan: true },
      });
      if (ws) return ws;
    }

    if (customerId) {
      const sub = await this.prisma.workspaceSubscription.findFirst({
        where: { provider_customer_id: customerId, provider: BillingProvider.PADDLE },
        select: { workspace_id: true },
      });
      if (sub) {
        return this.prisma.workspace.findUnique({
          where: { id: sub.workspace_id },
          select: { id: true, plan: true },
        });
      }
    }

    return null;
  }

  private async upsertSubscription(
    workspaceId: string,
    opts: {
      plan: WorkspacePlan;
      status: WorkspaceSubscriptionStatus;
      provider_customer_id?: string;
      provider_subscription_id?: string;
      period_start?: string;
      period_end?: string;
      cancel_at_period_end?: boolean;
      event_type: string;
      paddle_event_id?: string;
      notification_id?: string;
      payload: any;
    },
  ) {
    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId, provider: BillingProvider.PADDLE },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const subscription = existing
        ? await tx.workspaceSubscription.update({
            where: { id: existing.id },
            data: {
              plan: opts.plan,
              status: opts.status,
              provider_customer_id: opts.provider_customer_id ?? undefined,
              provider_subscription_id: opts.provider_subscription_id ?? undefined,
              billing_interval: BillingInterval.MONTHLY,
              current_period_start: opts.period_start ? new Date(opts.period_start) : undefined,
              current_period_end: opts.period_end ? new Date(opts.period_end) : undefined,
              cancel_at_period_end: opts.cancel_at_period_end ?? false,
            },
          })
        : await tx.workspaceSubscription.create({
            data: {
              workspace: { connect: { id: workspaceId } },
              provider: BillingProvider.PADDLE,
              plan: opts.plan,
              status: opts.status,
              billing_interval: BillingInterval.MONTHLY,
              provider_customer_id: opts.provider_customer_id ?? null,
              provider_subscription_id: opts.provider_subscription_id ?? null,
              current_period_start: opts.period_start ? new Date(opts.period_start) : null,
              current_period_end: opts.period_end ? new Date(opts.period_end) : null,
              cancel_at_period_end: opts.cancel_at_period_end ?? false,
            },
          });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { plan: opts.plan },
      });

      await tx.billingEvent.create({
        data: {
          workspace_id: workspaceId,
          subscription_id: subscription.id,
          provider: BillingProvider.PADDLE,
          source: 'WEBHOOK',
          event_type: opts.event_type,
          provider_event_id: opts.paddle_event_id ?? null,
          applied_plan: opts.plan,
          payload_json: JSON.stringify(opts.payload),
          processed_at: new Date(),
        },
      });
    });

    this.logger.log(`Workspace ${workspaceId} → plan ${opts.plan} (${opts.status})`);
  }
}
