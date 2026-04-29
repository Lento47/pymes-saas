import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { PaddleService } from './paddle.service';

@Module({
  controllers: [BillingController],
  providers: [PlanLimitsService, BillingInvoiceService, PaddleService],
  exports: [PlanLimitsService],
})
export class BillingModule {}
