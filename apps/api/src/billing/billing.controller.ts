import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { PaypalService } from "./paypal.service";
import { BillingInvoiceService } from "./billing-invoice.service";
import { FilterBillingInvoicesDto } from "./dto/filter-billing-invoices.dto";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RequirePermission, Permission } from "../common/permissions";

// ─── Env vars required for PayPal subscriptions ───────────────────────────
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
//   PAYPAL_PLAN_EMPRENDE_MONTHLY, PAYPAL_PLAN_STARTER_MONTHLY,
//   PAYPAL_PLAN_GROWTH_MONTHLY,   PAYPAL_PLAN_BUSINESS_MONTHLY
//   PAYPAL_PLAN_*_YEARLY  (optional yearly variants)
//   PAYPAL_ENVIRONMENT=sandbox|live   (default: sandbox)
//   PAYPAL_WEBHOOK_ID  (for webhook verification)
//   VITE_PYMESHUB_API_URL  (used to build return/cancel URLs)
// ─────────────────────────────────────────────────────────────────────────

@Controller("billing")
@RequirePermission(Permission.BILLING_MANAGE)
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly paypal: PaypalService,
    private readonly billingInvoice: BillingInvoiceService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private getAppBaseUrl(): string {
    return (
      this.config.get<string>("CORS_ORIGIN")?.split(",")[0]?.trim() ||
      "https://pymeshub.lat"
    );
  }

  // ── GET /billing/prices — returns PayPal plan IDs keyed by planKey_interval ──
  @Get("prices")
  @UseGuards(JwtAuthGuard)
  getPrices() {
    return this.paypal.getAvailablePlans();
  }

  // ── GET /billing/plan-details — full price + planId info ──────────────────
  @Get("plan-details")
  @UseGuards(JwtAuthGuard)
  getPlanDetails() {
    return this.paypal.getPlanPrices();
  }

  // ── POST /billing/checkout — create PayPal subscription, return approval URL ─
  // Server-authoritative: client sends planKey + interval; backend resolves planId.
  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @CurrentUser() user: AuthUser,
    @Body() body: { planKey: string; interval?: "MONTHLY" | "YEARLY" },
  ) {
    if (!body.planKey) throw new BadRequestException("planKey es requerido");

    const interval = body.interval ?? "MONTHLY";
    const planId = this.paypal.resolvePlanId(body.planKey, interval);
    if (!planId) {
      throw new BadRequestException(
        `Plan "${body.planKey}" (${interval}) no está configurado. Verificá PAYPAL_PLAN_* en las variables de entorno.`,
      );
    }

    try {
      const base = this.getAppBaseUrl();
      const returnUrl = `${base}/#/billing`;
      const cancelUrl = `${base}/#/billing?pp_canceled=1`;

      const { subscriptionId, approvalUrl } = await this.paypal.createSubscription(
        planId,
        user.email,
        returnUrl,
        cancelUrl,
      );

      this.logger.log(
        `Checkout: workspace=${user.workspace_id} planKey=${body.planKey} interval=${interval} sub=${subscriptionId}`,
      );
      void this.audit.log(user.workspace_id, {
        user_id: user.id,
        action: "subscription.checkout_initiated",
        entity_type: "subscription",
        entity_id: subscriptionId,
        after: { plan_key: body.planKey, interval, subscription_id: subscriptionId },
      });
      return { checkoutUrl: approvalUrl, subscriptionId };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Checkout failed workspace=${user.workspace_id}:`, err);
      throw new InternalServerErrorException("No se pudo iniciar el pago. Intentá de nuevo.");
    }
  }

  // ── POST /billing/subscription/confirm — called after PayPal redirect ─────
  // Server-authoritative: client sends planKey + interval; backend resolves planId.
  // Also verifies the PayPal subscription's plan_id matches the resolved server planId.
  @Post("subscription/confirm")
  @UseGuards(JwtAuthGuard)
  async confirmSubscription(
    @CurrentUser() user: AuthUser,
    @Body() body: { subscriptionId: string; planKey: string; interval?: "MONTHLY" | "YEARLY" },
  ) {
    if (!body.subscriptionId) throw new BadRequestException("subscriptionId es requerido");
    if (!body.planKey) throw new BadRequestException("planKey es requerido");

    const interval = body.interval ?? "MONTHLY";

    // Resolve the authoritative PayPal plan ID from planKey + interval
    const resolvedPlanId = this.paypal.resolvePlanId(body.planKey, interval);
    if (!resolvedPlanId) {
      throw new BadRequestException(
        `Plan "${body.planKey}" (${interval}) no está configurado en el servidor.`,
      );
    }

    try {
      // Verify PayPal subscription exists and its plan_id matches what the server expects
      const paypalSub = await this.paypal.getSubscription(body.subscriptionId).catch(() => null);
      if (paypalSub) {
        if (paypalSub.status !== "ACTIVE" && paypalSub.status !== "APPROVED") {
          throw new BadRequestException(
            `La suscripción no está activa en PayPal (status: ${paypalSub.status}).`,
          );
        }
        if (paypalSub.plan_id !== resolvedPlanId) {
          this.logger.warn(
            `Plan ID mismatch: expected=${resolvedPlanId} got=${paypalSub.plan_id} ` +
            `workspace=${user.workspace_id} sub=${body.subscriptionId}`,
          );
          throw new BadRequestException("La suscripción no coincide con el plan seleccionado.");
        }
      }

      await this.paypal.activateSubscriptionInDb(
        user.workspace_id,
        body.subscriptionId,
        resolvedPlanId,
        user.email,
        interval,
      );
      void this.audit.log(user.workspace_id, {
        user_id: user.id,
        action: "subscription.activated",
        entity_type: "subscription",
        entity_id: body.subscriptionId,
        after: { plan_key: body.planKey, plan_id: resolvedPlanId, interval, provider: "PAYPAL" },
      });
      return { success: true, message: "Suscripción activada correctamente." };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Confirm subscription failed workspace=${user.workspace_id}:`, err);
      throw new InternalServerErrorException("No se pudo confirmar la suscripción.");
    }
  }

  // ── POST /billing/cancel — cancel active PayPal subscription ──────────────
  @Post("cancel")
  @UseGuards(JwtAuthGuard)
  async cancelPlan(@CurrentUser() user: AuthUser) {
    try {
      const sub = await this.prisma.workspaceSubscription.findFirst({
        where: {
          workspace_id: user.workspace_id,
          provider: "PAYPAL",
          status: { in: ["ACTIVE", "TRIALING"] },
        },
        select: { id: true, provider_subscription_id: true },
      });

      if (!sub?.provider_subscription_id) {
        throw new BadRequestException("No hay suscripción activa para cancelar.");
      }

      await this.paypal.cancelSubscription(sub.provider_subscription_id);

      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED", cancel_at_period_end: false },
      });

      await this.prisma.workspace.update({
        where: { id: user.workspace_id },
        data: { plan: "FREE" },
      });

      void this.audit.log(user.workspace_id, {
        user_id: user.id,
        action: "subscription.cancelled",
        entity_type: "subscription",
        entity_id: sub.provider_subscription_id,
        after: { cancelled_by: "user", provider: "PAYPAL" },
      });
      return { success: true, message: "Suscripción cancelada." };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Cancel failed workspace=${user.workspace_id}:`, err);
      throw new InternalServerErrorException("No se pudo cancelar el plan.");
    }
  }

  // ── POST /billing/change-plan — cancel old + start new subscription ────────
  // Server-authoritative: client sends planKey + interval; backend resolves planId.
  @Post("change-plan")
  @UseGuards(JwtAuthGuard)
  async changePlan(
    @CurrentUser() user: AuthUser,
    @Body() body: { planKey: string; interval?: "MONTHLY" | "YEARLY" },
  ) {
    if (!body.planKey) throw new BadRequestException("planKey es requerido");

    const interval = body.interval ?? "MONTHLY";
    const planId = this.paypal.resolvePlanId(body.planKey, interval);
    if (!planId) {
      throw new BadRequestException(
        `Plan "${body.planKey}" (${interval}) no está configurado en el servidor.`,
      );
    }

    try {
      // Cancel existing subscription if any
      const existing = await this.prisma.workspaceSubscription.findFirst({
        where: {
          workspace_id: user.workspace_id,
          provider: "PAYPAL",
          status: { in: ["ACTIVE", "TRIALING"] },
        },
        select: { id: true, provider_subscription_id: true },
      });

      if (existing?.provider_subscription_id) {
        await this.paypal.cancelSubscription(
          existing.provider_subscription_id,
          "Cambio de plan solicitado por el usuario",
        ).catch((err) => this.logger.warn(`Could not cancel old sub: ${err.message}`));
        await this.prisma.workspaceSubscription.update({
          where: { id: existing.id },
          data: { status: "CANCELLED" },
        });
      }

      // Create new subscription
      const base = this.getAppBaseUrl();
      const { subscriptionId, approvalUrl } = await this.paypal.createSubscription(
        planId,
        user.email,
        `${base}/#/billing`,
        `${base}/#/billing?pp_canceled=1`,
      );

      return { checkoutUrl: approvalUrl, subscriptionId };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Change plan failed workspace=${user.workspace_id}:`, err);
      throw new InternalServerErrorException("No se pudo cambiar el plan.");
    }
  }

  // ── GET /billing/portal — no PayPal portal; return null gracefully ─────────
  @Get("portal")
  @UseGuards(JwtAuthGuard)
  getPortal() {
    return { url: null };
  }

  // ── GET /billing/invoices ─────────────────────────────────────────────────
  @Get("invoices")
  @UseGuards(JwtAuthGuard)
  async getInvoices(@CurrentUser() user: AuthUser, @Query() filters: FilterBillingInvoicesDto) {
    return this.billingInvoice.findByWorkspace(user.workspace_id, filters);
  }

  // ── GET /billing/invoices/:id/pdf ─────────────────────────────────────────
  @Get("invoices/:id/pdf")
  @UseGuards(JwtAuthGuard)
  async getInvoicePdf(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) invoiceId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.billingInvoice.getPdfBuffer(invoiceId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  // ── GET /billing/subscription — current workspace subscription status ──────
  @Get("subscription")
  @UseGuards(JwtAuthGuard)
  async getSubscription(@CurrentUser() user: AuthUser) {
    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: {
        workspace_id: user.workspace_id,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      },
      orderBy: { created_at: "desc" },
    });

    if (!sub) {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: user.workspace_id },
        select: { plan: true },
      });
      return { plan: ws?.plan ?? "FREE", status: "MANUAL", provider: null };
    }

    return sub;
  }
}
