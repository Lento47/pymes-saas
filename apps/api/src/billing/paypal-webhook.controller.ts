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

@Controller("payments/paypal")
export class PaypalWebhookController {
  private readonly logger = new Logger(PaypalWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
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

    this.logger.log(`PayPal webhook received: ${event.event_type} (${event.id})`);

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        await this.handleCaptureCompleted(event);
        break;
      case "CHECKOUT.ORDER.DECLINED":
        await this.handleOrderDeclined(event);
        break;
      default:
        break;
    }

    return { received: true };
  }

  private async handleCaptureCompleted(event: any) {
    try {
      const resource = event.resource || {};
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      const captureId = resource.id;
      const amount = parseFloat(resource.amount?.value || "0");

      if (!orderId || amount <= 0) {
        this.logger.warn(`Webhook ${event.id}: missing orderId or invalid amount`);
        return;
      }

      const paymentOrder = await this.prisma.paypalPaymentOrder.findUnique({
        where: { order_id: orderId },
      });

      if (!paymentOrder) {
        this.logger.warn(`Webhook ${event.id}: no payment order found for ${orderId}`);
        return;
      }

      if (paymentOrder.status === "COMPLETED") {
        this.logger.log(`Webhook ${event.id}: order ${orderId} already completed, skipping`);
        return;
      }

      const existingTx = await this.credits.findTransactionByPaypalOrderId(orderId);
      if (existingTx && existingTx.amount > 0) {
        this.logger.log(`Webhook ${event.id}: order ${orderId} already has credits, marking completed`);
        await this.prisma.paypalPaymentOrder.update({
          where: { id: paymentOrder.id },
          data: { status: "COMPLETED", capture_id: captureId },
        });
        return;
      }

      const creditAmount = this.amountToCredits(amount);
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

      this.logger.log(
        `Webhook ${event.id}: credits ${creditAmount} added for order ${orderId} via webhook`,
      );
    } catch (error) {
      this.logger.error(`Error processing webhook PAYMENT.CAPTURE.COMPLETED ${event.id}:`, error);
    }
  }

  private async handleOrderDeclined(event: any) {
    try {
      const resource = event.resource || {};
      const orderId = resource.id;

      if (!orderId) return;

      await this.prisma.paypalPaymentOrder.updateMany({
        where: { order_id: orderId, status: "CREATED" },
        data: { status: "FAILED" },
      });

      this.logger.log(`Webhook ${event.id}: order ${orderId} marked as FAILED`);
    } catch (error) {
      this.logger.error(`Error processing webhook CHECKOUT.ORDER.DECLINED ${event.id}:`, error);
    }
  }

  private amountToCredits(amountUsd: number): number {
    if (amountUsd >= 69.99) return 5000;
    if (amountUsd >= 24.99) return 1500;
    if (amountUsd >= 9.99) return 500;
    if (amountUsd >= 2.99) return 100;
    return Math.round(amountUsd / 0.03);
  }
}
