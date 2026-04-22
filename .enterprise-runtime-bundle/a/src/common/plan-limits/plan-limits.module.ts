import { Global, Module } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';

@Global() // Inject anywhere without re-importing
@Module({
  providers: [PlanLimitsService],
  exports: [PlanLimitsService],
})
export class PlanLimitsModule {}
