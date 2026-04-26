import { Module } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [PlanLimitsService],
  exports: [PlanLimitsService],
})
export class BillingModule {}
