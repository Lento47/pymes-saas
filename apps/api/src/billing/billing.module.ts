import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { BillingInvoiceService } from "./billing-invoice.service";
import { PaypalService } from "./paypal.service";
import { PaypalController } from "./paypal.controller";
import { PaypalWebhookController } from "./paypal-webhook.controller";
import { MemoryModule } from "../memory/memory.module";
import { AiTokensModule } from "../ai-tokens/ai-tokens.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [MemoryModule, AiTokensModule, PrismaModule, AuditModule],
  controllers: [BillingController, PaypalController, PaypalWebhookController],
  providers: [PlanLimitsService, BillingInvoiceService, PaypalService],
  exports: [PlanLimitsService, PaypalService],
})
export class BillingModule {}
