import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paddle, Environment, LogLevel, type EventEntity } from '@paddle/paddle-node-sdk';
import { BillingInvoiceService } from './billing-invoice.service';

@Injectable()
export class PaddleService {
  private paddle: Paddle | null = null;
  private readonly logger = new Logger(PaddleService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingInvoice: BillingInvoiceService,
  ) {
    const apiKey = this.configService.get<string>('PADDLE_API_KEY');
    const environment = this.configService.get<string>('PADDLE_ENVIRONMENT', 'sandbox');

    if (apiKey) {
      this.paddle = new Paddle(apiKey, {
        environment: environment === 'production' ? Environment.production : Environment.sandbox,
        logLevel: environment === 'production' ? LogLevel.warn : LogLevel.verbose,
      });
      this.logger.log(`Paddle initialized in ${environment} mode`);
    } else {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        this.logger.error('PADDLE_API_KEY is required in production — billing disabled, startup may be impacted');
      } else {
        this.logger.warn('PADDLE_API_KEY not set — billing disabled (non-production environment)');
      }
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
      checkoutUrl: transaction.checkout?.url ?? null,
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

    return session.urls.general.overview;
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

  async syncSubscription(workspaceId: string) {
    const paddle = this.requireClient();

    let sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_customer_id: true, provider_subscription_id: true },
    });

    if (!sub?.provider_customer_id) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true },
      });

      const ownerMember = await this.prisma.workspaceUser.findFirst({
        where: { workspace_id: workspaceId, role: 'OWNER' },
        select: { user: { select: { email: true } } },
      });

      const ownerEmail = ownerMember?.user?.email;
      if (ownerEmail) {
        try {
          const customers = await (paddle as any).customers.list({ email: [ownerEmail] });
          const customer = (Array.isArray(customers) ? customers : customers?.data)?.[0];
          if (customer) {
            const allSubs = await (paddle as any).subscriptions.list({ customerId: [customer.id] });
            const subsList = Array.isArray(allSubs) ? allSubs : allSubs?.data || [];
            const activeSub = subsList.find((s: any) =>
              ['active', 'trialing'].includes(s.status),
            );
          if (activeSub) {
            const plan = this.mapPaddlePriceToPlan(
              activeSub.items?.[0]?.price?.id || '',
            );
            const status = this.mapPaddleStatus(activeSub.status);

            const existing = await this.prisma.workspaceSubscription.findFirst({
              where: { workspace_id: workspaceId },
            });

            if (existing) {
              await this.prisma.workspaceSubscription.update({
                where: { id: existing.id },
                data: {
                  provider_customer_id: customer.id,
                  provider_subscription_id: activeSub.id,
                  provider: 'PADDLE',
                  plan,
                  status,
                  current_period_start: activeSub.currentBillingPeriod?.startsAt
                    ? new Date(activeSub.currentBillingPeriod.startsAt)
                    : undefined,
                  current_period_end: activeSub.currentBillingPeriod?.endsAt
                    ? new Date(activeSub.currentBillingPeriod.endsAt)
                    : undefined,
                } as any,
              });
            } else {
              await this.prisma.workspaceSubscription.create({
                data: {
                  workspace_id: workspaceId,
                  provider_customer_id: customer.id,
                  provider_subscription_id: activeSub.id,
                  provider: 'PADDLE',
                  plan,
                  status,
                  current_period_start: activeSub.currentBillingPeriod?.startsAt
                    ? new Date(activeSub.currentBillingPeriod.startsAt)
                    : undefined,
                  current_period_end: activeSub.currentBillingPeriod?.endsAt
                    ? new Date(activeSub.currentBillingPeriod.endsAt)
                    : undefined,
                } as any,
              });
            }

            await this.prisma.workspace.update({
              where: { id: workspaceId },
              data: { plan },
            });

            this.logger.log(`Synced (via customer lookup) workspace ${workspaceId}: plan=${plan} status=${status}`);
            return { synced: true, plan, status };
          }
          }
        } catch (err) {
          this.logger.warn(`Customer lookup failed for workspace ${workspaceId}: ${(err as Error).message}`);
        }
      }

      return { synced: false, reason: 'No Paddle customer or subscription found' };
    }

    const paddleSub = await paddle.subscriptions.get(sub.provider_subscription_id);
    const plan = this.mapPaddlePriceToPlan(
      paddleSub.items?.[0]?.price?.id || '',
    );
    const status = this.mapPaddleStatus(paddleSub.status);

    await this.prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: {
        plan,
        status,
        current_period_start: paddleSub.currentBillingPeriod?.startsAt
          ? new Date(paddleSub.currentBillingPeriod.startsAt)
          : undefined,
        current_period_end: paddleSub.currentBillingPeriod?.endsAt
          ? new Date(paddleSub.currentBillingPeriod.endsAt)
          : undefined,
      } as any,
    });

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    });

    this.logger.log(`Synced subscription for workspace ${workspaceId}: plan=${plan} status=${status}`);
    return { synced: true, plan, status };
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

  async handleWebhookEvent(event: EventEntity): Promise<void> {
    const eventId = event.eventId;
    const eventType = event.eventType;

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
          data: event as unknown as Record<string, unknown> as any,
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
          data: event as unknown as Record<string, unknown> as any,
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
    const customData = data.customData || data.custom_data || {};
    const workspaceSlug: string | undefined = customData?.workspaceSlug || customData?.workspace_slug;

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { provider_customer_id: customerId },
      select: { id: true, workspace_id: true },
    });

    const subData = {
      provider_subscription_id: data.id,
      provider_customer_id: customerId,
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

    let workspaceId: string | undefined;

    if (existing) {
      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: subData as any,
      });
      workspaceId = existing.workspace_id;
    } else if (workspaceSlug) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { slug: workspaceSlug },
        select: { id: true },
      });
      if (workspace) {
        await this.prisma.workspaceSubscription.create({
          data: { workspace_id: workspace.id, ...subData } as any,
        });
        workspaceId = workspace.id;
      }
    }

    if (workspaceId) {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan },
      });
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
      select: {
        id: true,
        workspace_id: true,
        plan: true,
        status: true,
        workspace: { select: { name: true, slug: true } },
      },
    });

    if (!sub) return;

    await this.prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE' },
    });

    // Auto-generate billing invoice PDF
    const amount = data.details?.totals?.total || data.totals?.total || data.amount || 0;
    const currency = data.currencyCode || data.currency_code || 'USD';
    const interval = data.billingPeriod?.interval || 'MONTHLY';

    try {
      await this.billingInvoice.generateForSubscription(
        sub.workspace_id,
        sub.id,
        {
          clientName: sub.workspace?.name || 'Cliente',
          clientEmail: '',
          planName: sub.plan,
          planInterval: interval === 'month' ? 'MONTHLY' : interval === 'year' ? 'ANNUAL' : 'MONTHLY',
          seats: 1,
          amount: parseFloat(String(amount)),
          currency,
          notes: `Pago procesado — ${new Date().toISOString()}`,
        },
      );
    } catch (err) {
      this.logger.error(`Failed to generate billing invoice for workspace ${sub.workspace_id}: ${(err as Error).message}`);
    }
  }

  // ── Plan prices ──────────────────────────────────────────────────────────

  getAvailablePrices(): Record<string, string | null> {
    return {
      starter_monthly: this.configService.get<string>('PADDLE_PRICE_STARTER_MONTHLY') ?? null,
      starter_annual: this.configService.get<string>('PADDLE_PRICE_STARTER_ANNUAL') ?? null,
      growth_monthly: this.configService.get<string>('PADDLE_PRICE_GROWTH_MONTHLY') ?? null,
      growth_annual: this.configService.get<string>('PADDLE_PRICE_GROWTH_ANNUAL') ?? null,
      enterprise_monthly: this.configService.get<string>('PADDLE_PRICE_ENTERPRISE_MONTHLY') ?? null,
      enterprise_annual: this.configService.get<string>('PADDLE_PRICE_ENTERPRISE_ANNUAL') ?? null,
    };
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
    if (!priceId) return 'FREE';

    const priceVars: Record<string, 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'> = {};
    const starterMonthly = process.env.PADDLE_PRICE_STARTER_MONTHLY;
    const starterAnnual = process.env.PADDLE_PRICE_STARTER_ANNUAL;
    const growthMonthly = process.env.PADDLE_PRICE_GROWTH_MONTHLY;
    const growthAnnual = process.env.PADDLE_PRICE_GROWTH_ANNUAL;
    const enterpriseMonthly = process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY;
    const enterpriseAnnual = process.env.PADDLE_PRICE_ENTERPRISE_ANNUAL;

    if (starterMonthly) priceVars[starterMonthly] = 'STARTER';
    if (starterAnnual) priceVars[starterAnnual] = 'STARTER';
    if (growthMonthly) priceVars[growthMonthly] = 'GROWTH';
    if (growthAnnual) priceVars[growthAnnual] = 'GROWTH';
    if (enterpriseMonthly) priceVars[enterpriseMonthly] = 'ENTERPRISE';
    if (enterpriseAnnual) priceVars[enterpriseAnnual] = 'ENTERPRISE';

    return priceVars[priceId] ?? 'FREE';
  }
}
