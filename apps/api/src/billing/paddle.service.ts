import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paddle, Environment, LogLevel } from '@paddle/paddle-node-sdk';

@Injectable()
export class PaddleService {
  private paddle: Paddle | null = null;
  private readonly logger = new Logger(PaddleService.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = configService.get<string>('PADDLE_API_KEY');
    const environment = configService.get<string>('PADDLE_ENVIRONMENT', 'sandbox');

    if (apiKey) {
      this.paddle = new Paddle(apiKey, {
        environment: environment === 'production' ? Environment.production : Environment.sandbox,
        logLevel: environment === 'production' ? LogLevel.warn : LogLevel.verbose,
      });
      this.logger.log(`Paddle initialized in ${environment} mode`);
    } else {
      this.logger.warn('PADDLE_API_KEY not set — billing disabled');
    }
  }

  private requireClient(): Paddle {
    if (!this.paddle) throw new Error('Paddle is not configured');
    return this.paddle;
  }

  // ── Customer management ──────────────────────────────────────────────────

  async createOrGetCustomer(workspaceId: string, email: string, name?: string): Promise<string> {
    const paddle = this.requireClient();

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_customer_id: true },
    });

    if (existing?.provider_customer_id) {
      return existing.provider_customer_id;
    }

    const customer = await paddle.customers.create({ email, name });
    const customerId = customer.id;

    if (existing) {
      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: { provider_customer_id: customerId },
      });
    } else {
      await this.prisma.workspaceSubscription.create({
        data: {
          workspace_id: workspaceId,
          provider_customer_id: customerId,
          provider: 'PADDLE',
          status: 'MANUAL',
          plan: 'FREE',
        },
      });
    }

    return customerId;
  }

  // ── Checkout / Transaction ───────────────────────────────────────────────

  async createTransaction(
    workspaceId: string,
    customerId: string,
    priceId: string,
  ) {
    const paddle = this.requireClient();

    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customerId,
    });

    // Store the transaction for reference
    await this.prisma.stripeEvent.create({
      data: {
        workspace_id: workspaceId,
        external_id: transaction.id,
        type: 'transaction.created',
        data: {
          transaction_id: transaction.id,
          price_id: priceId,
        } as any,
        processed: false,
      },
    });

    return {
      transactionId: transaction.id,
      checkoutUrl: (transaction as any).checkout?.url ?? null,
    };
  }

  // ── Customer Portal ──────────────────────────────────────────────────────

  async getPortalLink(workspaceId: string): Promise<string> {
    const paddle = this.requireClient();

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { provider_customer_id: true, provider_subscription_id: true },
    });

    if (!sub?.provider_customer_id) {
      throw new Error('No Paddle customer found for workspace');
    }

    const subscriptionIds = sub.provider_subscription_id
      ? [sub.provider_subscription_id]
      : [];

    const session = await paddle.customerPortalSessions.create(
      sub.provider_customer_id,
      subscriptionIds,
    );

    return (session.urls as any).general as string;
  }

  // ── Subscription management ──────────────────────────────────────────────

  async cancelSubscription(workspaceId: string) {
    const paddle = this.requireClient();

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_subscription_id: true },
    });

    if (!sub?.provider_subscription_id) {
      throw new Error('No active Paddle subscription');
    }

    const result = await paddle.subscriptions.cancel(sub.provider_subscription_id, {
      effectiveFrom: 'next_billing_period',
    });

    await this.prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: {
        cancel_at_period_end: true,
        status: 'ACTIVE', // stays active until period end
      },
    });

    return result;
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────

  async verifyWebhookSignature(
    body: string,
    secret: string,
    signatureHeader: string,
  ) {
    const paddle = this.requireClient();
    return paddle.webhooks.unmarshal(body, secret, signatureHeader);
  }

  async handleWebhookEvent(event: any): Promise<void> {
    const eventId = event.eventId || event.event_id;
    const eventType = event.eventType || event.event_type;

    const existing = await this.prisma.stripeEvent.findUnique({
      where: { external_id: eventId },
    });

    if (existing?.processed) {
      this.logger.log(`Event ${eventId} (${eventType}) already processed, skipping`);
      return;
    }

    try {
      switch (eventType) {
        case 'subscription.activated':
        case 'subscription.updated':
          await this.handleSubscriptionEvent(event.data);
          break;
        case 'subscription.canceled':
          await this.handleSubscriptionCanceled(event.data);
          break;
        case 'transaction.completed':
        case 'transaction.paid':
          await this.handleTransactionCompleted(event.data);
          break;
        case 'transaction.payment_failed':
          this.logger.warn(`Payment failed for event ${eventId}`);
          break;
        default:
          this.logger.log(`Unhandled Paddle event: ${eventType}`);
      }

      await this.prisma.stripeEvent.upsert({
        where: { external_id: eventId },
        create: {
          external_id: eventId,
          type: eventType,
          data: event as any,
          processed: true,
        },
        update: { processed: true },
      });

      this.logger.log(`Event ${eventId} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing event ${eventId}:`, error);

      await this.prisma.stripeEvent.upsert({
        where: { external_id: eventId },
        create: {
          external_id: eventId,
          type: eventType,
          data: event as any,
          processed: false,
        },
        update: { processed: false },
      });

      throw error;
    }
  }

  // ── Private event handlers ───────────────────────────────────────────────

  private async handleSubscriptionEvent(data: any): Promise<void> {
    const customerId = data.customerId || data.customer_id;
    if (!customerId) return;

    const plan = this.mapPaddlePriceToPlan(
      data.items?.[0]?.price?.id || data.items?.[0]?.priceId || '',
    );

    const status = this.mapPaddleStatus(data.status);

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { provider_customer_id: customerId },
      select: { id: true },
    });

    const subData = {
      provider_subscription_id: data.id,
      provider: 'PADDLE' as const,
      status,
      plan,
      current_period_start: data.currentBillingPeriod?.startsAt
        ? new Date(data.currentBillingPeriod.startsAt)
        : undefined,
      current_period_end: data.currentBillingPeriod?.endsAt
        ? new Date(data.currentBillingPeriod.endsAt)
        : undefined,
    };

    if (existing) {
      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: subData as any,
      });
    } else {
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          subscriptions: { some: { provider_customer_id: customerId } },
        },
        select: { id: true },
      });

      if (workspace) {
        await this.prisma.workspaceSubscription.create({
          data: { workspace_id: workspace.id, ...subData } as any,
        });
      }
    }

    // Update workspace plan
    if (existing) {
      const sub = await this.prisma.workspaceSubscription.findUnique({
        where: { id: existing.id },
        select: { workspace_id: true },
      });
      if (sub) {
        await this.prisma.workspace.update({
          where: { id: sub.workspace_id },
          data: { plan },
        });
      }
    }
  }

  private async handleSubscriptionCanceled(data: any): Promise<void> {
    const customerId = data.customerId || data.customer_id;
    if (!customerId) return;

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { provider_customer_id: customerId },
      select: { id: true, workspace_id: true },
    });

    if (sub) {
      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED' },
      });

      await this.prisma.workspace.update({
        where: { id: sub.workspace_id },
        data: { plan: 'FREE' },
      });
    }
  }

  private async handleTransactionCompleted(data: any): Promise<void> {
    const subscriptionId = data.subscriptionId || data.subscription_id;
    if (!subscriptionId) return;

    this.logger.log(`Transaction completed for subscription ${subscriptionId}`);

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { provider_subscription_id: subscriptionId },
      select: { id: true, workspace_id: true, plan: true },
    });

    if (sub) {
      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private mapPaddleStatus(status: string): string {
    const map: Record<string, string> = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      unpaid: 'UNPAID',
      canceled: 'CANCELLED',
      paused: 'CANCELLED',
    };
    return map[status] ?? 'MANUAL';
  }

  private mapPaddlePriceToPlan(priceId: string): 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE' {
    const map: Record<string, 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'> = {
      [process.env.PADDLE_PRICE_STARTER_MONTHLY || '']: 'STARTER',
      [process.env.PADDLE_PRICE_STARTER_ANNUAL || '']: 'STARTER',
      [process.env.PADDLE_PRICE_GROWTH_MONTHLY || '']: 'GROWTH',
      [process.env.PADDLE_PRICE_GROWTH_ANNUAL || '']: 'GROWTH',
      [process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY || '']: 'ENTERPRISE',
      [process.env.PADDLE_PRICE_ENTERPRISE_ANNUAL || '']: 'ENTERPRISE',
    };
    return map[priceId] ?? 'STARTER';
  }
}
