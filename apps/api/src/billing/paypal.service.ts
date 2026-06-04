import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

// ── Plan keys → env var suffix mapping ────────────────────────────────────
const PLAN_KEYS = ["emprende", "starter", "growth", "business"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

const PLAN_PRICES_USD: Record<PlanKey, number> = {
  emprende: 12,
  starter: 25,
  growth: 59,
  business: 119,
};

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units?: {
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { value: string; currency_code: string };
        status_details?: { reason?: string };
      }[];
    };
  }[];
}

interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  start_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value?: string }; time?: string };
  };
  links?: { href: string; rel: string; method: string }[];
}

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  readonly environment: string;
  readonly apiBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId = config.getOrThrow<string>("PAYPAL_CLIENT_ID");
    this.clientSecret = config.getOrThrow<string>("PAYPAL_CLIENT_SECRET");
    this.webhookId = config.get<string>("PAYPAL_WEBHOOK_ID") ?? "";
    this.environment = config.get<string>("PAYPAL_ENVIRONMENT") ?? "sandbox";
    this.apiBase = PAYPAL_API_BASE[this.environment as "sandbox" | "live"] ?? PAYPAL_API_BASE.sandbox;
  }

  // ── Auth ───────────────────────────────────────────────────────────────

  async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal auth failed: ${res.status} ${text}`);
      throw new BadRequestException("Error de autenticación con PayPal");
    }

    const data = await res.json();
    return data.access_token;
  }

  // ── Plans (read from env) ──────────────────────────────────────────────

  getAvailablePlans(): Record<string, string> {
    const plans: Record<string, string> = {};
    for (const key of PLAN_KEYS) {
      const monthly = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_MONTHLY`);
      const yearly = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_YEARLY`);
      if (monthly) plans[`${key}_monthly`] = monthly;
      if (yearly) plans[`${key}_yearly`] = yearly;
    }
    return plans;
  }

  getPlanPrices(): Record<string, { planKey: string; interval: string; priceUsd: number; planId: string | null }> {
    const result: Record<string, { planKey: string; interval: string; priceUsd: number; planId: string | null }> = {};
    for (const key of PLAN_KEYS) {
      const monthlyId = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_MONTHLY`) ?? null;
      const yearlyId = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_YEARLY`) ?? null;
      result[`${key}_monthly`] = { planKey: key, interval: "MONTHLY", priceUsd: PLAN_PRICES_USD[key], planId: monthlyId };
      result[`${key}_yearly`] = { planKey: key, interval: "YEARLY", priceUsd: PLAN_PRICES_USD[key] * 10, planId: yearlyId };
    }
    return result;
  }

  // ── One-time orders (credit/token top-ups) ─────────────────────────────

  async createOrder(amountUsd: number): Promise<{ orderId: string }> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
          description: "Créditos de memoria IA - PymesHub",
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal createOrder failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo crear la orden de PayPal");
    }

    const order = await res.json();
    this.logger.log(`PayPal order created: ${order.id} status=${order.status}`);
    return { orderId: order.id };
  }

  async captureOrder(orderId: string): Promise<{ captureId: string; status: string; amount: number }> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal captureOrder failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo capturar el pago de PayPal");
    }

    const order: PayPalCaptureResponse = await res.json();
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) throw new BadRequestException("No se encontró el capture en la respuesta de PayPal");

    if (capture.status !== "COMPLETED" && this.environment !== "sandbox") {
      throw new BadRequestException(
        `El pago no fue completado (${capture.status})` +
        (capture.status_details?.reason ? `: ${capture.status_details.reason}` : ""),
      );
    }

    const amount = parseFloat(capture.amount?.value ?? "0");
    this.logger.log(`PayPal order captured: ${orderId} capture=${capture.id} amount=${amount} status=${capture.status}`);
    return { captureId: capture.id, status: capture.status, amount };
  }

  // ── Subscriptions ──────────────────────────────────────────────────────

  /**
   * Creates a PayPal subscription for a given plan.
   * Returns the subscription ID and the PayPal approval URL to redirect the user to.
   */
  async createSubscription(
    planId: string,
    email: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const token = await this.getAccessToken();

    const body = {
      plan_id: planId,
      subscriber: { email_address: email },
      application_context: {
        brand_name: "PymesHub",
        locale: "es-CR",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: { payer_selected: "PAYPAL", payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED" },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    const res = await fetch(`${this.apiBase}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal createSubscription failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo crear la suscripción en PayPal. Intente de nuevo.");
    }

    const sub: PayPalSubscription = await res.json();
    const approvalLink = sub.links?.find((l) => l.rel === "approve");
    if (!approvalLink?.href) {
      throw new BadRequestException("PayPal no devolvió un link de aprobación.");
    }

    this.logger.log(`PayPal subscription created: ${sub.id} plan=${planId}`);
    return { subscriptionId: sub.id, approvalUrl: approvalLink.href };
  }

  async getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.apiBase}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`PayPal getSubscription failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo obtener la suscripción de PayPal");
    }

    return res.json();
  }

  async cancelSubscription(subscriptionId: string, reason = "Cancelado por el usuario"): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.apiBase}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    // 204 = success, 422 = already cancelled (treat as success)
    if (!res.ok && res.status !== 422) {
      const text = await res.text();
      this.logger.error(`PayPal cancelSubscription failed: ${res.status} ${text}`);
      throw new BadRequestException("No se pudo cancelar la suscripción en PayPal");
    }

    this.logger.log(`PayPal subscription cancelled: ${subscriptionId}`);
  }

  /**
   * Resolves the planKey (e.g. "starter") from a PayPal plan ID.
   */
  resolvePlanKeyFromPlanId(planId: string): PlanKey | null {
    for (const key of PLAN_KEYS) {
      const monthly = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_MONTHLY`);
      const yearly = this.config.get<string>(`PAYPAL_PLAN_${key.toUpperCase()}_YEARLY`);
      if (monthly === planId || yearly === planId) return key;
    }
    return null;
  }

  /**
   * After the user approves the subscription on PayPal, confirms it in the DB.
   * Creates or updates the WorkspaceSubscription record.
   */
  async activateSubscriptionInDb(
    workspaceId: string,
    subscriptionId: string,
    planId: string,
    email: string,
    interval: "MONTHLY" | "YEARLY" = "MONTHLY",
  ): Promise<void> {
    const planKey = this.resolvePlanKeyFromPlanId(planId);
    if (!planKey) {
      this.logger.warn(`activateSubscriptionInDb: unknown planId ${planId} for workspace ${workspaceId}`);
      throw new BadRequestException("Plan desconocido");
    }

    // Verify subscription is ACTIVE or APPROVED with PayPal
    const sub = await this.getSubscription(subscriptionId).catch(() => null);
    if (sub && sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
      throw new BadRequestException(`La suscripción aún no está activa en PayPal (status: ${sub.status})`);
    }

    const planEnum = planKey.toUpperCase() as any;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (interval === "YEARLY" ? 12 : 1));

    // Cancel any previous active subscription for this workspace
    await this.prisma.workspaceSubscription.updateMany({
      where: { workspace_id: workspaceId, status: { in: ["ACTIVE", "TRIALING"] } },
      data: { status: "CANCELLED" },
    });

    await this.prisma.workspaceSubscription.create({
      data: {
        workspace_id: workspaceId,
        provider: "PAYPAL",
        status: "ACTIVE",
        plan: planEnum,
        billing_interval: interval,
        provider_customer_id: email,
        provider_subscription_id: subscriptionId,
        current_period_start: now,
        current_period_end: periodEnd,
      },
    });

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: planEnum },
    });

    this.logger.log(`Workspace ${workspaceId} activated on plan=${planEnum} via PayPal sub=${subscriptionId}`);
  }
}
