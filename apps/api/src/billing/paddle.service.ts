import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paddle, Environment, LogLevel, type EventEntity } from '@paddle/paddle-node-sdk';
import { BillingInvoiceService } from './billing-invoice.service';
import { PLAN_ORDER } from '../common/plan-limits/plan-limits.service';
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
    if (!this.paddle) throw new ServiceUnavailableException(`Paddle is not configured`);
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
      throw new NotFoundException(`No Paddle customer found for workspace`);
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
      throw new BadRequestException(`newPriceId is required`);
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
      throw new NotFoundException(`No active Paddle subscription. Use /billing/checkout for first-time purchase.`);
    }

    // CONSULTA EL ITEM_ID ACTUAL EN PADDLE (NECESARIO PARA EL UPDATE).
    const paddleSub = await paddle.subscriptions.get(sub.provider_subscription_id);
    const currentItem = paddleSub.items?.[0];
    if (!currentItem?.price?.id) {
      throw new InternalServerErrorException('Could not read current Paddle subscription items');
    }

    // SI ES EL MISMO PRICE — NO HACER NADA.
    if (currentItem.price.id === newPriceId) {
      return { updated: false, plan: sub.plan, status: sub.status, prorated: false };
    }

    // CLASIFICAR UPGRADE VS DOWNGRADE COMPARANDO PLANES INTERNOS.
    // PLAN_ORDER (FUENTE UNICA EN plan-limits) INCLUYE BUSINESS Y BUSINESS_PLUS.
    const newPlan = this.mapPaddlePriceToPlan(newPriceId);
    const newRank = PLAN_ORDER.indexOf(newPlan as typeof PLAN_ORDER[number]);
    const currentRank = PLAN_ORDER.indexOf(sub.plan as typeof PLAN_ORDER[number]);
    const isDowngrade = newRank <= currentRank;

    // IMPORTANTE — PADDLE RECHAZA 'prorated_immediately' CUANDO LA SUSCRIPCION
    // ESTA EN TRIAL. EN ESE CASO SIEMPRE HAY QUE USAR 'do_not_bill'.
    // EL CAMBIO DE PLAN EN TRIAL ENTRA EN VIGOR SIN CARGO; EL COBRO OCURRE
    // CUANDO EL TRIAL TERMINA (PADDLE LO MANEJA AUTOMATICAMENTE).
    const isTrialing = paddleSub.status === 'trialing';

    // IMPORTANTE — DOWNGRADE NO COBRA HOY:
    //   prorationBillingMode='do_not_bill' EVITA EL CARGO INMEDIATO,
    //   effectiveFrom='next_billing_period' AGENDA EL CAMBIO PARA EL CICLO
    //   SIGUIENTE. EL USUARIO DISFRUTA EL PLAN ACTUAL (CARO) HASTA QUE
    //   TERMINE EL PERIODO YA PAGADO.
    // UPGRADE (FUERA DE TRIAL) COBRA INMEDIATAMENTE LA DIFERENCIA PRORRATEADA.
    const prorationBillingMode = (isDowngrade || isTrialing) ? 'do_not_bill' : 'prorated_immediately';

    const updated = await paddle.subscriptions.update(sub.provider_subscription_id, {
      items: [{ priceId: newPriceId, quantity: 1 }],
      prorationBillingMode,
      ...(isDowngrade && !isTrialing ? { scheduledChange: { action: 'change', effectiveAt: 'next_billing_period' } as any } : {}),
    } as any);

    // ACTUALIZA NUESTRO REGISTRO LOCAL. EL WEBHOOK `subscription.updated`
    // TAMBIEN LLEGARA Y SOBREESCRIBIRA — ESTO ES SOLO PARA UI INMEDIATA.
    //
    // CASO DOWNGRADE (FUERA DE TRIAL): EL PLAN LOCAL NO CAMBIA AUN — EL
    // USUARIO SIGUE EN EL PLAN CARO HASTA EL FIN DEL PERIODO ACTUAL.
    //
    // CASO TRIALING (UPGRADE O DOWNGRADE): EL NUEVO PLAN ENTRA EN VIGOR EN
    // EL TRIAL, SIN CARGO. ACTUALIZAMOS LOCAL DE INMEDIATO PARA QUE LA UI
    // REFLEJE EL PLAN CORRECTO. PADDLE COBRARA AL FINAL DEL TRIAL.
    const status = this.mapPaddleStatus(updated.status);
    const shouldUpdateNow = !isDowngrade || isTrialing;
    if (shouldUpdateNow) {
      await this.prisma.$transaction([
        this.prisma.workspaceSubscription.update({
          where: { id: sub.id },
          data: { plan: newPlan, status: status as any },
        }),
        this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { plan: newPlan },
        }),
      ]);
      this.logger.log(`Plan changed immediately: workspace=${workspaceId}, ${sub.plan} -> ${newPlan}`);
    } else {
      this.logger.log(`Downgrade scheduled for end of period: workspace=${workspaceId}, ${sub.plan} -> ${newPlan}`);
    }

    return {
      updated: true,
      plan: shouldUpdateNow ? newPlan : sub.plan,
      scheduled_plan: !shouldUpdateNow ? newPlan : null,
      status,
      prorated: !isDowngrade && !isTrialing,
      effective: shouldUpdateNow ? 'immediate' : 'next_billing_period',
    };
  }

  async cancelSubscription(workspaceId: string) {
    const paddle = this.requireClient();

    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      select: { id: true, provider_subscription_id: true },
    });

    if (!sub?.provider_subscription_id) {
      throw new NotFoundException(`No active Paddle subscription`);
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
          {
            const subId = (event.data as any)?.subscriptionId;
            if (subId) {
              const sub = await this.prisma.workspaceSubscription.findFirst({
                where: { provider_subscription_id: subId },
                select: { workspace_id: true, workspace: { select: { name: true } } },
              });
              if (sub) {
                await this.createDiagnosticCase(sub.workspace_id,
                  `Pago fallido para ${sub.workspace.name}`,
                  'PADDLE_PAYMENT_FAILED',
                  `Un pago de Paddle falló. El usuario necesita actualizar su método de pago.`,
                  'high',
                );
              }
            }
          }
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

      const subId = (event.data as any)?.subscriptionId || (event.data as any)?.id;
      if (subId) {
        const sub = await this.prisma.workspaceSubscription.findFirst({
          where: { provider_subscription_id: subId },
          select: { workspace_id: true, workspace: { select: { name: true } } },
        });
        if (sub) {
          await this.createDiagnosticCase(sub.workspace_id,
            `Error procesando webhook de Paddle: ${eventType}`,
            'PADDLE_WEBHOOK_ERROR',
            `Evento ${eventId} falló: ${(error as Error)?.message}`,
            'critical',
          );
        }
      }

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

    this.logger.log(`Subscription event: customer=${customerId}, plan=${plan}, status=${status}, slug=${workspaceSlug}`);

    if (status === 'PAST_DUE' && workspaceSlug) {
      const ws = await this.prisma.workspace.findUnique({ where: { slug: workspaceSlug }, select: { id: true, name: true } });
      if (ws) {
        await this.createDiagnosticCase(ws.id,
          `Suscripción en mora para ${ws.name}`,
          'SUBSCRIPTION_PAST_DUE',
          `La suscripción de ${ws.name} está en estado PAST_DUE. El pago no se ha podido procesar.`,
          'high',
        );
      }
    }

    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { provider_customer_id: customerId },
      select: { id: true, workspace_id: true },
    });

    this.logger.log(`Existing subscription: ${existing ? `id=${existing.id}, ws=${existing.workspace_id}` : 'none'}`);

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
      const addonKey = customData?.addon || customData?.addon_key || undefined;
      const validAddons = ['ai_assistant', 'whatsapp_premium', 'extra_user', 'advanced_inventory', 'approvals_signature'];
      if (addonKey && validAddons.includes(addonKey)) {
        this.logger.log(`Activating addon ${addonKey} for workspace ${workspaceId}`);
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings_json: true },
        });
        const settings = (workspace?.settings_json as Record<string, any>) ?? {};
        settings[`${addonKey}_active`] = true;
        settings[`${addonKey}_activated_at`] = new Date().toISOString();
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { settings_json: settings as any },
        });
        this.logger.log(`Add-on activated: ${addonKey} for workspace ${workspaceId}`);
      } else {
        this.logger.log(`Updating workspace ${workspaceId} plan to ${plan}`);
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { plan },
        });
        this.logger.log(`Workspace ${workspaceId} plan updated to ${plan}`);
        await this.resolveBillingCases(workspaceId, 'SUBSCRIPTION_WORKSPACE_MISMATCH');
      }
    } else {
      this.logger.warn(`No workspaceId resolved for customer ${customerId}, slug=${workspaceSlug}`);

      if (workspaceSlug) {
        const ws = await this.prisma.workspace.findUnique({
          where: { slug: workspaceSlug }, select: { id: true, name: true },
        });
        if (ws) {
          await this.createDiagnosticCase(ws.id,
            `Webhook no pudo vincular suscripción para ${ws.name}`,
            'SUBSCRIPTION_WORKSPACE_MISMATCH',
            `customer=${customerId}, slug=${workspaceSlug}, plan=${plan}. Posiblemente el customer_id no coincide con ningún registro existente.`,
          );
        }
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
      const ws = await this.prisma.workspace.findUnique({
        where: { id: sub.workspace_id },
        select: { id: true, name: true },
      });
      if (ws) {
        await this.createDiagnosticCase(ws.id,
          `Suscripción cancelada para ${ws.name}`,
          'SUBSCRIPTION_CANCELED',
          `El cliente canceló su suscripción. Plan revertido a FREE.`,
          'medium',
        );
      }

      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', plan: 'FREE' },
      });

      const wss = await this.prisma.workspace.findUnique({
        where: { id: sub.workspace_id },
        select: { settings_json: true },
      });
      const settings = (wss?.settings_json as Record<string, any>) ?? {};
      let modified = false;
      const addonKeys = ['ai_assistant_active', 'ai_assistant_activated_at',
        'whatsapp_premium_active', 'whatsapp_premium_activated_at',
        'extra_user_active', 'extra_user_activated_at',
        'advanced_inventory_active', 'advanced_inventory_activated_at',
        'approvals_signature_active', 'approvals_signature_activated_at'];
      for (const key of addonKeys) {
        if (key in settings) { delete settings[key]; modified = true; }
      }
      const updateData: any = { plan: 'FREE' };
      if (modified) {
        updateData.settings_json = settings as any;
      }
      await this.prisma.workspace.update({
        where: { id: sub.workspace_id },
        data: updateData,
      });
    }
  }

  // Currencies that do NOT use 2-decimal minor units (Paddle still sends in minor units,
  // but the divisor is 1, not 100). Add more as needed.
  private static readonly ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'CLP', 'ISK', 'VND', 'XAF', 'XOF']);

  private parsePaddleAmount(raw: unknown, currency: string): number {
    const minor = parseInt(String(raw ?? '0'), 10);
    if (Number.isNaN(minor)) return 0;
    const divisor = PaddleService.ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
    return Math.round((minor / divisor) * 100) / 100;
  }

  private async handleTransactionCompleted(data: any): Promise<void> {
    const subscriptionId = data.subscriptionId || data.subscription_id;
    if (!subscriptionId) return;

    const transactionId: string | undefined = data.id || data.transactionId;
    this.logger.log(`Transaction completed: tx=${transactionId} sub=${subscriptionId}`);

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

    if (!sub) {
      this.logger.warn(`Transaction completed but no subscription found for ${subscriptionId}`);
      return;
    }

    this.logger.log(`Transaction handler: ws=${sub.workspace_id}, current plan=${sub.plan}, sub status=${sub.status}`);

    await this.prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', plan: sub.plan },
    });

    this.logger.log(`Updating workspace ${sub.workspace_id} plan to ${sub.plan}`);
    await this.prisma.workspace.update({
      where: { id: sub.workspace_id },
      data: { plan: sub.plan },
    });
    this.logger.log(`Workspace ${sub.workspace_id} plan updated to ${sub.plan}`);

    // DEDUPE — `transaction.completed` y `transaction.paid` pueden disparar por
    // la misma compra. Marcamos la factura con `[paddle_tx:<id>]` en notes y
    // saltamos si ya existe.
    const txMarker = transactionId ? `[paddle_tx:${transactionId}]` : null;
    if (txMarker) {
      const dup = await this.prisma.billingInvoice.findFirst({
        where: { workspace_id: sub.workspace_id, notes: { contains: txMarker } },
        select: { id: true, number: true },
      });
      if (dup) {
        this.logger.log(`Invoice already exists for tx=${transactionId} (invoice ${dup.number}), skipping`);
        return;
      }
    }

    // PADDLE MANDA TOTALES EN MINOR UNITS COMO STRING ("5000" = $50.00).
    const currency = (data.currencyCode || data.currency_code || 'USD').toUpperCase();
    const totals = data.details?.totals ?? data.totals ?? {};
    const subtotal = this.parsePaddleAmount(totals.subtotal, currency);
    const taxAmount = this.parsePaddleAmount(totals.tax, currency);
    const total = this.parsePaddleAmount(totals.total ?? totals.grandTotal, currency);
    const fallbackAmount = this.parsePaddleAmount(data.amount, currency);
    const interval = data.billingPeriod?.interval || data.billing_period?.interval || 'MONTHLY';
    const planInterval: 'MONTHLY' | 'ANNUAL' =
      interval === 'month' ? 'MONTHLY' : interval === 'year' ? 'ANNUAL' : 'MONTHLY';

    // Owner para el cliente y el email
    const owner = await this.prisma.workspaceUser.findFirst({
      where: { workspace_id: sub.workspace_id, is_owner: true },
      select: { user: { select: { email: true, name: true } } },
    });
    const clientName = owner?.user?.name || sub.workspace?.name || 'Cliente';
    const clientEmail = owner?.user?.email || '';

    let invoiceId: string | null = null;
    try {
      const invoice = await this.billingInvoice.generateForSubscription(
        sub.workspace_id,
        sub.id,
        {
          clientName,
          clientEmail,
          planName: sub.plan,
          planInterval,
          seats: 1,
          // Si Paddle no mando subtotal explicito, usa total (sin IVA recalculado).
          amount: subtotal || total || fallbackAmount,
          subtotal: subtotal || total || fallbackAmount,
          taxAmount: subtotal ? taxAmount : 0,
          taxRate: subtotal && taxAmount ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0,
          currency,
          notes: txMarker ? `Pago procesado · ${txMarker}` : 'Pago procesado',
        },
      );
      invoiceId = invoice.id;
    } catch (err) {
      this.logger.error(`Failed to create billing invoice for workspace ${sub.workspace_id}: ${(err as Error).message}`);
      return;
    }

    // Email con PDF adjunto — fire-and-forget, no bloquea el webhook.
    this.sendInvoiceEmail(invoiceId, clientEmail, owner?.user?.name ?? null).catch((err) =>
      this.logger.warn(`Invoice email failed for invoice ${invoiceId}: ${err.message}`),
    );
  }

  private async sendInvoiceEmail(invoiceId: string, to: string, recipientName: string | null) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured, skipping invoice email');
      return;
    }
    if (!to) {
      this.logger.warn(`No recipient email for invoice ${invoiceId}, skipping`);
      return;
    }

    // Genera el PDF y los datos para el cuerpo del email.
    const { buffer, filename } = await this.billingInvoice.getPdfBuffer(invoiceId);
    const inv = await this.prisma.billingInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { number: true, plan_name: true, total: true, currency: true, issued_at: true },
    });

    const formattedTotal = inv.currency === 'CRC'
      ? `₡${inv.total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthName = inv.issued_at.toLocaleString('es-CR', { month: 'long', year: 'numeric' });

    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from: 'PymesHub <billing@pymeshub.lat>',
        to,
        subject: `Factura ${inv.number} — ${inv.plan_name} (${monthName})`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111827">
          <h2 style="color:#1a56db;margin:0 0 16px">PymesHub</h2>
          <p>Hola${recipientName ? ` ${recipientName.replace(/[<>&"']/g, (c: string) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]!))}` : ''},</p>
          <p>Tu pago de <strong>${formattedTotal}</strong> por el plan <strong>${inv.plan_name}</strong> fue procesado correctamente.</p>
          <p style="background:#f8fafc;padding:12px 16px;border-radius:6px;margin:16px 0">
            <span style="color:#6b7280;font-size:12px;display:block">Numero de factura</span>
            <strong style="font-size:14px">${inv.number}</strong>
          </p>
          <p>Adjuntamos la factura en PDF. Tambien podes descargarla desde <a href="https://pymeshub.lat/settings/billing" style="color:#1a56db">Configuracion → Facturacion</a>.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#9ca3af;font-size:11px">PymesHub — Plataforma SaaS para PYMEs · Costa Rica<br/>support@pymeshub.com · pymeshub.lat</p>
        </div>`,
        attachments: [
          {
            filename,
            content: buffer,
          },
        ],
      });
      this.logger.log(`Invoice email sent to ${to} (invoice ${inv.number}, ${buffer.length} bytes PDF)`);
    } catch (err) {
      this.logger.error(`Failed to send invoice email for ${inv.number}: ${(err as Error).message}`);
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

    const result = priceVars[priceId] ?? 'FREE';
    if (result === 'FREE' && priceId) {
      this.logger.warn(`mapPaddlePriceToPlan: unmapped Paddle price ID "${priceId}" — falling back to FREE. Check env vars PADDLE_PRICE_*_MONTHLY/ANNUAL.`);
    }
    return result;
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

  async createDiagnosticCase(
    workspaceId: string,
    title: string,
    errorCode: string,
    errorDetail: string,
    riskLevel: string = 'high',
  ) {
    try {
      await (this.prisma as any).supportDiagnosticCase.create({
        data: {
          workspace_id: workspaceId,
          module: 'billing',
          error_code: errorCode,
          category: 'BILLING_OR_PLAN',
          risk_level: riskLevel,
          status: 'OPEN',
          title,
          user_description: errorDetail,
          safe_summary: 'Revisar logs de Railway para más detalles. Verificar configuración de Paddle.',
          evidence_json: { error_code: errorCode, detail: errorDetail, timestamp: new Date().toISOString() },
        },
      });
      this.logger.log(`Billing diagnostic case created: ${title}`);
    } catch (err: any) {
      this.logger.error(`Failed to create billing diagnostic case: ${err?.message}`);
    }
  }

  async resolveBillingCases(workspaceId: string, errorCode: string) {
    try {
      const updated = await (this.prisma as any).supportDiagnosticCase.updateMany({
        where: { workspace_id: workspaceId, error_code: errorCode, status: 'OPEN' },
        data: { status: 'RESOLVED', resolution_json: { resolved_at: new Date().toISOString(), auto: true } },
      });
      if (updated.count > 0) {
        this.logger.log(`Auto-resolved ${updated.count} billing case(s) for ${errorCode}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to auto-resolve billing cases: ${err?.message}`);
    }
  }
}
