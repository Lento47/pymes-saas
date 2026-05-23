import {
  Controller,
  Logger,
  Post,
  Req,
  RawBodyRequest,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { PaypalService } from "./paypal.service";
import { CreditsService } from "../memory/credits.service";

@Controller("payments/paypal")
export class PaypalWebhookController {
  private readonly logger = new Logger(PaypalWebhookController.name);

  constructor(
    private readonly paypal: PaypalService,
    private readonly credits: CreditsService,
  ) {}

  @Post("webhook")
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const headers = {
      "paypal-auth-algo": request.headers["paypal-auth-algo"] as string,
      "paypal-cert-url": request.headers["paypal-cert-url"] as string,
      "paypal-transmission-id": request.headers["paypal-transmission-id"] as string,
      "paypal-transmission-sig": request.headers["paypal-transmission-sig"] as string,
      "paypal-transmission-time": request.headers["paypal-transmission-time"] as string,
    };

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      this.logger.warn("PAYPAL_WEBHOOK_ID not configured, skipping verification");
    }

    const rawBody = request.rawBody?.toString() || JSON.stringify(request.body);
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException("Invalid webhook body");
    }

    this.logger.log(`PayPal webhook received: ${event.event_type} (${event.id})`);

    const eventType = event.event_type || "";

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
      await this.processPaymentEvent(event);
    }

    return { received: true };
  }

  private async processPaymentEvent(event: any) {
    try {
      const resource = event.resource || {};
      let orderId: string | null = null;
      let amount: number = 0;
      let workspaceId: string | null = null;

      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        orderId = resource.supplementary_data?.related_ids?.order_id || resource.custom_id || null;
        amount = parseFloat(resource.amount?.value || "0");
      } else if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
        const purchaseUnit = resource.purchase_units?.[0];
        orderId = resource.id;
        amount = parseFloat(purchaseUnit?.amount?.value || "0");
      }

      if (!orderId || amount <= 0) {
        this.logger.warn(`Cannot process webhook event ${event.id}: missing orderId or amount`);
        return;
      }

      const existingTx = await this.credits.findTransactionByPaypalOrderId(orderId);
      if (existingTx) {
        this.logger.log(`Order ${orderId} already processed, skipping`);
        return;
      }

      this.logger.log(`Webhook deferred — order ${orderId} will be captured on frontend callback`);
    } catch (error) {
      this.logger.error(`Error processing webhook event ${event.id}:`, error);
    }
  }
}
