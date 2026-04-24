import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly stripeApiKey: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripeApiKey = configService.get<string>('STRIPE_SECRET_KEY') || '';
    if (this.stripeApiKey) {
      this.stripe = new Stripe(this.stripeApiKey);
    }
  }

  async createOrGetCustomer(workspaceId: string, email: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const subscription = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_customer_id: true },
    });

    if (subscription?.provider_customer_id) {
      return subscription.provider_customer_id;
    }

    const customer = await this.stripe.customers.create({
      email,
      metadata: { workspace_id: workspaceId },
      name: workspace?.name,
    });

    if (subscription) {
      await this.prisma.workspaceSubscription.update({
        where: { id: subscription.id },
        data: { provider_customer_id: customer.id },
      });
    } else {
      await this.prisma.workspaceSubscription.create({
        data: {
          workspace_id: workspaceId,
          provider_customer_id: customer.id,
          status: 'MANUAL',
          plan: 'STARTER',
        },
      });
    }

    return customer.id;
  }

  async createCheckoutSession(
    workspaceId: string,
    customerId: string,
    priceId: string,
    idempotencyKey: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ sessionId: string; url: string }> {
    const existingSession = await this.prisma.stripeEvent.findFirst({
      where: {
        workspace_id: workspaceId,
        type: 'checkout.session.created',
      },
    });

    const existingData = existingSession?.data as any;
    if (existingData?.idempotency_key === idempotencyKey && existingData?.session_id) {
      return {
        sessionId: existingData.session_id,
        url: existingData.url,
      };
    }

    const session = await this.stripe.checkout.sessions.create(
      {
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        billing_address_collection: 'required',
      },
      { idempotencyKey },
    );

    await this.prisma.stripeEvent.create({
      data: {
        workspace_id: workspaceId,
        type: 'checkout.session.created',
        external_id: session.id,
        data: {
          session_id: session.id,
          url: session.url,
          idempotency_key: idempotencyKey,
        } as any,
        processed: true,
      },
    });

    return {
      sessionId: session.id,
      url: session.url || '',
    };
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const existingEvent = await this.prisma.stripeEvent.findUnique({
      where: { external_id: event.id },
    });

    if (existingEvent?.processed) {
      this.logger.log(`Webhook event ${event.id} already processed, skipping`);
      return;
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionEvent(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
      }

      await this.prisma.stripeEvent.upsert({
        where: { external_id: event.id },
        create: {
          external_id: event.id,
          type: event.type,
          data: event.data as any,
          processed: true,
        },
        update: {
          processed: true,
        },
      });

      this.logger.log(`Webhook event ${event.id} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing webhook event ${event.id}:`, error);

      await this.prisma.stripeEvent.upsert({
        where: { external_id: event.id },
        create: {
          external_id: event.id,
          type: event.type,
          data: event.data as any,
          processed: false,
        },
        update: {
          processed: false,
        },
      });

      throw error;
    }
  }

  private async handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspace_id;
    if (!workspaceId) {
      this.logger.warn(`Subscription ${subscription.id} has no workspace_id in metadata`);
      return;
    }

    const planStr = this.mapStripePriceToWorkspacePlan(subscription.items.data[0]?.price?.id || '');
    const plan = planStr as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
    const mappedStatus = subscription.status.toUpperCase() as any;

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: {
          provider_subscription_id: subscription.id,
          status: mappedStatus,
          plan,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
      });
    } else {
      await this.prisma.workspaceSubscription.create({
        data: {
          workspace_id: workspaceId,
          provider_subscription_id: subscription.id,
          status: mappedStatus,
          plan,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
      });
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    await this.handleSubscriptionEvent(subscription);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspace_id;
    if (!workspaceId) return;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: 'FREE' },
    });

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });
    }
  }

  private mapStripePriceToWorkspacePlan(priceId: string): 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE' {
    const priceMap: Record<string, 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'> = {
      [process.env.STRIPE_PRICE_GROWTH_MONTHLY || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_GROWTH_ANNUAL || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '']: 'ENTERPRISE',
      [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '']: 'ENTERPRISE',
    };

    return priceMap[priceId] || 'STARTER';
  }

  async getBillingPortalLink(workspaceId: string): Promise<string> {
    const subscription = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { provider_customer_id: true },
    });

    if (!subscription?.provider_customer_id) {
      throw new Error('No Stripe customer found for workspace');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
    });

    return session.url;
  }

  verifyWebhookSignature(body: string, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(body, signature, secret) as Stripe.Event;
  }
}
