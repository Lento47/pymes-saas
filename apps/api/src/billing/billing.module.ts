import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlanLimitsService } from './plan-limits.service';
import { StripeService } from './stripe.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [PlanLimitsService, StripeService],
  exports: [PlanLimitsService, StripeService],
})
export class BillingModule {}
