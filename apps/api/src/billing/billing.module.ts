import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { BillingInvoiceService } from "./billing-invoice.service";
import { PaddleSdkService } from "./paddle-sdk.service";
import { PaypalService } from "./paypal.service";
import { PaypalController } from "./paypal.controller";
import { PaypalWebhookController } from "./paypal-webhook.controller";
import { MemoryModule } from "../memory/memory.module";

@Module({
  imports: [MemoryModule],
  controllers: [BillingController, PaypalController, PaypalWebhookController],
  providers: [PlanLimitsService, BillingInvoiceService, PaddleSdkService, PaypalService],
  exports: [PlanLimitsService],
})
export class BillingModule {}
