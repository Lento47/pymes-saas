import { Global, Module } from "@nestjs/common";
import { PlanLimitsService } from "./plan-limits.service";
import { PlanThrottlerGuard } from "./plan-throttler.guard";
import { PrismaModule } from "../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PlanLimitsService, PlanThrottlerGuard],
  exports: [PlanLimitsService, PlanThrottlerGuard],
})
export class PlanLimitsModule {}
