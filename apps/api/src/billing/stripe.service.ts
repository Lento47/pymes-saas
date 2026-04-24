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
      select: { stripe_customer_id: true, name: true },
    });

    if (workspace?.stripe_customer_id) {
      return workspace.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      email,
      metadata: { workspace_id: workspaceId },
      name: workspace?.name,
    });

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { stripe_customer_id: customer.id },
    });

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
        data: { path: ['idempotency_key'], equals: idempotencyKey },
      },
    });

    if (existingSession?.data?.session_id) {
      return {
        sessionId: existingSession.data.session_id,
        url: existingSession.data.url,
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

    const plan = this.mapStripePriceToWorkspacePlan(subscription.items.data[0]?.price?.id || '');

    await this.prisma.workspaceSubscription.upsert({
      where: { workspace_id: workspaceId },
      create: {
        workspace_id: workspaceId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
      update: {
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    });

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
      data: { plan: 'STARTER' },
    });

    await this.prisma.workspaceSubscription.update({
      where: { workspace_id: workspaceId },
      data: { status: 'cancelled' },
    });
  }

  private mapStripePriceToWorkspacePlan(priceId: string): string {
    const priceMap: Record<string, string> = {
      [process.env.STRIPE_PRICE_GROWTH_MONTHLY || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_GROWTH_ANNUAL || '']: 'GROWTH',
      [process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '']: 'BUSINESS',
      [process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '']: 'BUSINESS',
      [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '']: 'ENTERPRISE',
      [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '']: 'ENTERPRISE',
    };

    return priceMap[priceId] || 'STARTER';
  }

  async getBillingPortalLink(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { stripe_customer_id: true },
    });

    if (!workspace?.stripe_customer_id) {
      throw new Error('No Stripe customer found for workspace');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
    });

    return session.url;
  }

  verifyWebhookSignature(body: string, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(body, signature, secret) as Stripe.Event;
  }
}
