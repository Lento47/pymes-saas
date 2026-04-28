import { Module } from '@nestjs/common';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Module({
  providers: [PlanLimitsService],
  exports: [PlanLimitsService],
})
export class BillingModule {}
