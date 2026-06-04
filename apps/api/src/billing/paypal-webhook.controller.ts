import {
  Controller,
  Logger,
  Post,
  Req,
  RawBodyRequest,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreditsService } from "../memory/credits.service";
import { PaypalService } from "./paypal.service";

@Controller("payments/paypal")
export class PaypalWebhookController {
  private readonly logger = new Logger(PaypalWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly paypal: PaypalService,
  ) {}

  @Post("webhook")
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody?.toString() || JSON.stringify(request.body);
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException("Invalid webhook body");
    }

    this.logger.log(`PayPal webhook: ${event.event_type} (${event.id})`);

    switch (event.event_type) {
      // ── One-time payment events ─────────────────────────────────────────
      case "PAYMENT.CAPTURE.COMPLETED":
        await this.handleCaptureCompleted(event);
        break;
      case "CHECKOUT.ORDER.DECLINED":
        await this.handleOrderDeclined(event);
        break;

      // ── Subscription lifecycle events ───────────────────────────────────
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await this.handleSubscriptionActivated(event);
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
        await this.handleSubscriptionCancelled(event);
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await this.handleSubscriptionSuspended(event);
        break;
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        await this.handleSubscriptionPaymentFailed(event);
        break;
      case "PAYMENT.SALE.COMPLETED":
        await this.handleSubscriptionPaymentCompleted(event);
        break;
      default:
        break;
    }

    return { received: true };
  }

  // ── One-time order handlers ─────────────────────────────────────────────

  private async handleCaptureCompleted(event: any) {
    try {
      const resource = event.resource ?? {};
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      const captureId = resource.id;
      const amount = parseFloat(resource.amount?.value ?? "0");

      if (!orderId || amount <= 0) {
        this.logger.warn(`Webhook ${event.id}: missing orderId or invalid amount`);
        return;
      }

      const paymentOrder = await this.prisma.paypalPaymentOrder.findUnique({
        where: { order_id: orderId },
      });

      if (!paymentOrder) {
        this.logger.warn(`Webhook ${event.id}: no payment order for ${orderId}`);
        return;
      }
      if (paymentOrder.status === "COMPLETED") return;

      // Webhook is backup path — only runs if capture-order endpoint missed it.
      // Trust the stored credit amount; never derive from USD.
      const creditAmount = paymentOrder.credits;
      if (!creditAmount || creditAmount <= 0) {
        this.logger.warn(`Webhook ${event.id}: order ${orderId} has no credits stored, skipping`);
        return;
      }

      const existingTx = await this.credits.findTransactionByPaypalOrderId(orderId);
      if (existingTx && existingTx.amount > 0) {
        await this.prisma.paypalPaymentOrder.update({
          where: { id: paymentOrder.id },
          data: { status: "COMPLETED", capture_id: captureId },
        });
        return;
      }

      await this.credits.addCredits(
        paymentOrder.workspace_id,
        creditAmount,
        "PURCHASE",
        `Compra de ${creditAmount} créditos vía PayPal (webhook)`,
        orderId,
      );

      await this.prisma.paypalPaymentOrder.update({
        where: { id: paymentOrder.id },
        data: { status: "COMPLETED", capture_id: captureId },
      });

      this.logger.log(`Webhook: ${creditAmount} credits added for order ${orderId}`);
    } catch (err) {
      this.logger.error(`Error PAYMENT.CAPTURE.COMPLETED ${event.id}:`, err);
    }
  }

  private async handleOrderDeclined(event: any) {
    try {
      const orderId = event.resource?.id;
      if (!orderId) return;
      await this.prisma.paypalPaymentOrder.updateMany({
        where: { order_id: orderId, status: "CREATED" },
        data: { status: "FAILED" },
      });
    } catch (err) {
      this.logger.error(`Error CHECKOUT.ORDER.DECLINED ${event.id}:`, err);
    }
  }

  // ── Subscription handlers ───────────────────────────────────────────────

  private async handleSubscriptionActivated(event: any) {
    try {
      const resource = event.resource ?? {};
      const subscriptionId = resource.id as string;
      const planId = resource.plan_id as string;
      if (!subscriptionId || !planId) return;

      const planKey = this.paypal.resolvePlanKeyFromPlanId(planId);
      if (!planKey) {
        this.logger.warn(`handleSubscriptionActivated: unknown planId=${planId} sub=${subscriptionId}`);
        return;
      }

      // Find workspace by existing pending subscription record (created at checkout)
      const existing = await this.prisma.workspaceSubscription.findFirst({
        where: { provider_subscription_id: subscriptionId },
        select: { workspace_id: true, id: true },
      });

      if (!existing) {
        this.logger.warn(`handleSubscriptionActivated: no workspace found for sub=${subscriptionId}`);
        return;
      }

      await this.prisma.workspaceSubscription.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          plan: planKey.toUpperCase() as any,
          current_period_start: new Date(),
        },
      });

      await this.prisma.workspace.update({
        where: { id: existing.workspace_id },
        data: { plan: planKey.toUpperCase() as any },
      });

      this.logger.log(`Subscription activated: workspace=${existing.workspace_id} plan=${planKey} sub=${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Error BILLING.SUBSCRIPTION.ACTIVATED ${event.id}:`, err);
    }
  }

  private async handleSubscriptionCancelled(event: any) {
    try {
      const subscriptionId = event.resource?.id as string;
      if (!subscriptionId) return;

      const sub = await this.prisma.workspaceSubscription.findFirst({
        where: { provider_subscription_id: subscriptionId },
        select: { id: true, workspace_id: true },
      });

      if (!sub) return;

      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED" },
      });

      await this.prisma.workspace.update({
        where: { id: sub.workspace_id },
        data: { plan: "FREE" },
      });

      this.logger.log(`Subscription cancelled: workspace=${sub.workspace_id} sub=${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Error BILLING.SUBSCRIPTION.CANCELLED ${event.id}:`, err);
    }
  }

  private async handleSubscriptionSuspended(event: any) {
    try {
      const subscriptionId = event.resource?.id as string;
      if (!subscriptionId) return;

      await this.prisma.workspaceSubscription.updateMany({
        where: { provider_subscription_id: subscriptionId },
        data: { status: "PAST_DUE" },
      });
    } catch (err) {
      this.logger.error(`Error BILLING.SUBSCRIPTION.SUSPENDED ${event.id}:`, err);
    }
  }

  private async handleSubscriptionPaymentFailed(event: any) {
    try {
      const subscriptionId = event.resource?.id as string;
      if (!subscriptionId) return;

      await this.prisma.workspaceSubscription.updateMany({
        where: { provider_subscription_id: subscriptionId },
        data: { status: "PAST_DUE" },
      });

      this.logger.warn(`Subscription payment failed: sub=${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Error BILLING.SUBSCRIPTION.PAYMENT.FAILED ${event.id}:`, err);
    }
  }

  private async handleSubscriptionPaymentCompleted(event: any) {
    try {
      const resource = event.resource ?? {};
      const subscriptionId = resource.billing_agreement_id as string | undefined;
      if (!subscriptionId) return;

      // Renew period end
      const sub = await this.prisma.workspaceSubscription.findFirst({
        where: { provider_subscription_id: subscriptionId },
        select: { id: true, billing_interval: true },
      });

      if (!sub) return;

      const now = new Date();
      const periodEnd = new Date(now);
      if (sub.billing_interval === "YEARLY") {
        periodEnd.setMonth(periodEnd.getMonth() + 12);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await this.prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          current_period_start: now,
          current_period_end: periodEnd,
        },
      });

      this.logger.log(`Subscription payment completed: sub=${subscriptionId}`);
    } catch (err) {
      this.logger.error(`Error PAYMENT.SALE.COMPLETED ${event.id}:`, err);
    }
  }

}
