import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paddle, Environment, LogLevel, type EventEntity } from '@paddle/paddle-node-sdk';
import { BillingInvoiceService } from './billing-invoice.service';
import { Resend } from 'resend';

// ───────────────────────────────────────────────────────────────────────────
// IMPORTANTE — CONFIGURACION DE PADDLE
//
// PADDLE ESTA EN SANDBOX HOY. AL PASAR A PROD, EN RAILWAY ROTAR:
//   - PADDLE_API_KEY (DE PROD)
//   - PADDLE_ENVIRONMENT=production
//   - PADDLE_WEBHOOK_SECRET (DE PROD)
//   - PADDLE_PRICE_STARTER_MONTHLY / _ANNUAL
//   - PADDLE_PRICE_GROWTH_MONTHLY  / _ANNUAL
//   - PADDLE_PRICE_ENTERPRISE_MONTHLY / _ANNUAL
//
// EL FRONTEND LEE ESTOS PRICE IDs VIA `GET /api/billing/prices` — NO LOS
// LEE DE SUS PROPIAS ENV VARS. ASI HAY UNA SOLA FUENTE DE VERDAD.
//
// LO QUE NO ES IMPORTANTE: EL CODIGO DE ESTE ARCHIVO NO CAMBIA AL PASAR A
// PROD. SOLO SE TOCAN LAS ENV VARS.
// ───────────────────────────────────────────────────────────────────────────
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
    successUrl?: string,
  ) {
    const paddle = this.requireClient();

    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customerId,
      checkout: successUrl ? { url: successUrl } : undefined,
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

  // ────────────────────────────────────────────────────────────────────────
  // CAMBIO DE PLAN PARA SUSCRIPCION YA EXISTENTE — PRORRATEADO POR PADDLE.
  //
  // IMPORTANTE — REGLAS DE NEGOCIO:
  //   - UPGRADE (PLAN MAS CARO): PADDLE COBRA LA DIFERENCIA INMEDIATAMENTE
  //     (`prorationBillingMode: 'prorated_immediately'`).
  //   - DOWNGRADE (PLAN MAS BARATO O IGUAL): NO SE COBRA NADA HOY. EL
  //     CAMBIO ENTRA EN VIGOR EN EL SIGUIENTE PERIODO DE FACTURACION
  //     (`prorationBillingMode: 'do_not_bill'` + `effectiveFrom: 'next_billing_period'`).
  //
  // SE USA EN VEZ DE CHECKOUT NUEVO CUANDO EL WORKSPACE YA TIENE
  // `provider_subscription_id`. EL FRONT DECIDE EL PATH (createCheckout VS
  // changePlan) MIRANDO `subscription.provider_subscription_id`.
  //
  // PADDLE EN SANDBOX. AL PASAR A PROD, ESTA RUTA NO CAMBIA — SOLO LOS
  // ENV VARS (PADDLE_API_KEY, PADDLE_ENVIRONMENT, PADDLE_PRICE_*).
  // ────────────────────────────────────────────────────────────────────────
  async changePlan(workspaceId: string, newPriceId: string) {
    const paddle = this.requireClient();

    if (!newPriceId) {
      throw new Error('newPriceId is required');
    }

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        plan: true,
        provider_subscription_id: true,
        status: true,
      },
    });

    if (!sub?.provider_subscription_id) {
      throw new Error('No active Paddle subscription. Use /billing/checkout for first-time purchase.');
    }

    // CONSULTA EL ITEM_ID ACTUAL EN PADDLE (NECESARIO PARA EL UPDATE).
    const paddleSub = await paddle.subscriptions.get(sub.provider_subscription_id);
    const currentItem = paddleSub.items?.[0];
    if (!currentItem?.price?.id) {
      throw new Error('Could not read current Paddle subscription items');
    }

    // SI ES EL MISMO PRICE — NO HACER NADA.
    if (currentItem.price.id === newPriceId) {
      return { updated: false, plan: sub.plan, status: sub.status, prorated: false };
    }

    // CLASIFICAR UPGRADE VS DOWNGRADE COMPARANDO PLANES INTERNOS.
    const newPlan = this.mapPaddlePriceToPlan(newPriceId);
    const planRank: Record<string, number> = { FREE: 0, STARTER: 1, GROWTH: 2, ENTERPRISE: 3 };
    const isDowngrade = (planRank[newPlan] ?? 0) <= (planRank[sub.plan] ?? 0);

    // IMPORTANTE — DOWNGRADE NO COBRA HOY:
    //   prorationBillingMode='do_not_bill' EVITA EL CARGO INMEDIATO,
    //   effectiveFrom='next_billing_period' AGENDA EL CAMBIO PARA EL CICLO
    //   SIGUIENTE. EL USUARIO DISFRUTA EL PLAN ACTUAL (CARO) HASTA QUE
    //   TERMINE EL PERIODO YA PAGADO.
    // UPGRADE COBRA INMEDIATAMENTE LA DIFERENCIA PRORRATEADA.
    const updated = await paddle.subscriptions.update(sub.provider_subscription_id, {
      items: [{ priceId: newPriceId, quantity: 1 }],
      prorationBillingMode: isDowngrade ? 'do_not_bill' : 'prorated_immediately',
      ...(isDowngrade ? { scheduledChange: { action: 'change', effectiveAt: 'next_billing_period' } as any } : {}),
    } as any);

    // ACTUALIZA NUESTRO REGISTRO LOCAL. EL WEBHOOK `subscription.updated`
    // TAMBIEN LLEGARA Y SOBREESCRIBIRA — ESTO ES SOLO PARA UI INMEDIATA.
    // NOTA: EN DOWNGRADE, EL `plan` LOCAL NO CAMBIA HASTA QUE EL WEBHOOK
    // CONFIRME EL CAMBIO EN EL PROXIMO CICLO. NO TOCAR `workspace.plan` AQUI
    // SI ES DOWNGRADE.
    const status = this.mapPaddleStatus(updated.status);
    if (!isDowngrade) {
      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { plan: newPlan, status: status as any },
      });
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan: newPlan },
      });
      this.logger.log(`Plan upgraded immediately: workspace=${workspaceId}, ${sub.plan} -> ${newPlan}`);
    } else {
      this.logger.log(`Plan downgrade scheduled for next period: workspace=${workspaceId}, ${sub.plan} -> ${newPlan}`);
    }

    return {
      updated: true,
      plan: isDowngrade ? sub.plan : newPlan, // PARA UI: SI ES DOWNGRADE, EL PLAN ACTUAL SIGUE VIGENTE HASTA EL PROXIMO CICLO
      scheduled_plan: isDowngrade ? newPlan : null,
      status,
      prorated: !isDowngrade,
      effective: isDowngrade ? 'next_billing_period' : 'immediate',
    };
  }

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

  async syncSubscription(workspaceId: string, customerId?: string, subscriptionId?: string) {
    const paddle = this.requireClient();

    if (subscriptionId) {
      return this.syncExistingSubscription(workspaceId, workspaceId, subscriptionId, true);
    }

    if (customerId) {
      return this.syncByCustomerId(workspaceId, customerId);
    }

    // Always try email lookup first to get the latest subscription from Paddle
    const info = await this.getWorkspaceInfo(workspaceId);
    this.logger.log(`Auto-sync: looking up Paddle customer for email=${info.email}, workspace=${info.name}`);
    if (info.email) {
      try {
        const paddleApiKey = this.configService.get<string>('PADDLE_API_KEY');
        const env = this.configService.get<string>('PADDLE_ENVIRONMENT', 'sandbox');
        const baseUrl = env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
        const url = `${baseUrl}/customers?email=${encodeURIComponent(info.email)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${paddleApiKey}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const body: any = await res.json();
          const customers = body?.data || [];
          this.logger.log(`Auto-sync: Paddle API returned ${customers.length} customer(s) for email ${info.email}`);
          if (customers.length > 0) {
            return this.syncByCustomerId(workspaceId, customers[0].id);
          }
        } else {
          this.logger.warn(`Auto-sync: Paddle API returned ${res.status} for email lookup`);
        }
      } catch (err) {
        this.logger.error(`Email customer lookup HTTP failed for ${info.email}:`, err);
      }
    }

    // Fallback: try stored subscription
    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_customer_id: true, provider_subscription_id: true },
    });

    if (sub?.provider_subscription_id) {
      return this.syncExistingSubscription(sub.id, workspaceId, sub.provider_subscription_id);
    }

    return { synced: false, reason: 'No subscription found. Provide a Paddle customer ID.' };
  }

  private async syncByCustomerId(workspaceId: string, customerId: string) {
    const paddle = this.requireClient();

    try {
      const customer = await (paddle as any).customers.get(customerId);
      if (!customer) {
        return { synced: false, reason: `Customer ${customerId} not found` };
      }

      const subsCollection: any = await (paddle as any).subscriptions.list({ customerId: [customerId] });
      const subsPage = await subsCollection.next();
      const subsList = subsPage || [];
      const activeSub = subsList.find((s: any) =>
        ['active', 'trialing'].includes(s.status),
      );

      if (!activeSub) {
        return { synced: false, reason: 'No active/trialing subscription found' };
      }

      const plan = this.mapPaddlePriceToPlan(
        activeSub.items?.[0]?.price?.id || '',
      );
      const status = this.mapPaddleStatus(activeSub.status);

      const existing = await this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: workspaceId },
      });

      const subData = {
        provider_customer_id: customerId,
        provider_subscription_id: activeSub.id,
        provider: 'PADDLE' as const,
        plan,
        status,
        current_period_start: activeSub.currentBillingPeriod?.startsAt
          ? new Date(activeSub.currentBillingPeriod.startsAt)
          : undefined,
        current_period_end: activeSub.currentBillingPeriod?.endsAt
          ? new Date(activeSub.currentBillingPeriod.endsAt)
          : undefined,
      };

      let subscriptionId: string;

      if (existing) {
        await this.prisma.workspaceSubscription.update({
          where: { id: existing.id },
          data: subData as any,
        });
        subscriptionId = existing.id;
      } else {
        const created = await this.prisma.workspaceSubscription.create({
          data: { workspace_id: workspaceId, ...subData } as any,
        });
        subscriptionId = created.id;
      }

      try {
        const info = await this.getWorkspaceInfo(workspaceId);
        await this.billingInvoice.generateForSubscription(workspaceId, subscriptionId, {
          clientName: info.name,
          clientEmail: info.email,
          planName: plan,
          planInterval: 'MONTHLY',
          seats: 1,
          amount: 0,
          currency: 'CRC',
          notes: `Suscripción sincronizada — ${plan} (${status})`,
        });
        } catch (err) {
          this.logger.warn(`Failed to generate invoice for synced sub: ${(err as Error).message}`);
        }

      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan },
      });

      this.logger.log(`Synced (by customerId ${customerId}) workspace ${workspaceId}: plan=${plan}`);
      return { synced: true, plan, status, customerId };
    } catch (err) {
      this.logger.error(`syncByCustomerId failed for ${customerId}:`, err);
      return { synced: false, reason: `Paddle API error: ${(err as Error).message}` };
    }
  }

  private async syncExistingSubscription(
    subId: string,
    workspaceId: string,
    providerSubscriptionId: string,
    createIfMissing = false,
  ) {
    const paddle = this.requireClient();

    try {
      const paddleSub = await paddle.subscriptions.get(providerSubscriptionId);
      const plan = this.mapPaddlePriceToPlan(
        paddleSub.items?.[0]?.price?.id || '',
      );
      const status = this.mapPaddleStatus(paddleSub.status);

      const existing = await this.prisma.workspaceSubscription.findFirst({
        where: createIfMissing ? { workspace_id: workspaceId } : { id: subId },
      });

      const subData = {
        provider_subscription_id: providerSubscriptionId,
        provider_customer_id: paddleSub.customerId,
        provider: 'PADDLE' as const,
        plan,
        status,
        current_period_start: paddleSub.currentBillingPeriod?.startsAt
          ? new Date(paddleSub.currentBillingPeriod.startsAt)
          : undefined,
        current_period_end: paddleSub.currentBillingPeriod?.endsAt
          ? new Date(paddleSub.currentBillingPeriod.endsAt)
          : undefined,
      };

      let subscriptionId: string;

      if (existing) {
        await this.prisma.workspaceSubscription.update({
          where: { id: existing.id },
          data: subData as any,
        });
        subscriptionId = existing.id;
      } else {
        const created = await this.prisma.workspaceSubscription.create({
          data: { workspace_id: workspaceId, ...subData } as any,
        });
        subscriptionId = created.id;
      }

      // Generate an invoice for every sync
      try {
        const info = await this.getWorkspaceInfo(workspaceId);
        await this.billingInvoice.generateForSubscription(workspaceId, subscriptionId, {
          clientName: info.name,
          clientEmail: info.email,
          planName: plan,
          planInterval: 'MONTHLY',
          seats: 1,
          amount: 0,
          currency: 'CRC',
          notes: `Suscripción sincronizada — ${plan} (${status})`,
        });
      } catch (err) {
        this.logger.warn(`Failed to generate invoice: ${(err as Error).message}`);
      }

      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan },
      });

      this.logger.log(`Synced subscription for workspace ${workspaceId}: plan=${plan}`);
      return { synced: true, plan, status };
    } catch (err) {
      this.logger.error(`syncExistingSubscription failed for ${providerSubscriptionId}:`, err);
      return { synced: false, reason: `Paddle API error: ${(err as Error).message}` };
    }
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

      // Send invoice email notification
      this.sendInvoiceEmail(sub.workspace_id, amount, currency, sub.plan).catch(err =>
        this.logger.warn(`Invoice email failed: ${err.message}`),
      );
    } catch (err) {
      this.logger.error(`Failed to generate billing invoice for workspace ${sub.workspace_id}: ${(err as Error).message}`);
    }
  }

  private async sendInvoiceEmail(workspaceId: string, amount: number, currency: string, plan: string) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured, skipping invoice email');
      return;
    }

    const resend = new Resend(apiKey);
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const owner = await this.prisma.workspaceUser.findFirst({
      where: { workspace_id: workspaceId, is_owner: true },
      select: { user: { select: { email: true, name: true } } },
    });

    const to = owner?.user?.email;
    if (!to) {
      this.logger.warn(`No owner email found for workspace ${workspaceId}, skipping invoice email`);
      return;
    }

    const monthName = new Date().toLocaleString('es-CR', { month: 'long', year: 'numeric' });
    const formattedAmount = currency === 'CRC'
      ? `₡${amount.toLocaleString('es-CR')}`
      : `$${amount.toLocaleString('en-US')}`;

    try {
      await resend.emails.send({
        from: 'PyMesHub <billing@pymeshub.lat>',
        to,
        subject: `Factura PyMesHub — ${plan} (${monthName})`,
        html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#6366f1">PyMesHub</h2>
          <p>Hola ${owner?.user?.name || ''},</p>
          <p>Tu pago por <strong>${formattedAmount}</strong> fue procesado para el plan <strong>${plan}</strong>.</p>
          <p>Periodo: ${monthName}</p>
          <p>Podés descargar tu factura desde <a href="https://pymeshub.lat/settings/billing">Configuración → Facturación</a>.</p>
          <hr style="border-color:#e5e7eb;margin:16px 0"/>
          <p style="color:#6b7280;font-size:12px">PyMesHub — Business OS para PYMEs</p>
        </div>`,
      });
      this.logger.log(`Invoice email sent to ${to} for workspace ${ws?.name}`);
    } catch (err) {
      this.logger.error(`Failed to send invoice email: ${(err as Error).message}`);
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

  private async getWorkspaceInfo(workspaceId: string): Promise<{ name: string; email: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const owner = await this.prisma.workspaceUser.findFirst({
      where: { workspace_id: workspaceId, role: 'OWNER' },
      select: { user: { select: { email: true } } },
    });

    return {
      name: workspace?.name || 'Cliente',
      email: owner?.user?.email || '',
    };
  }
}
