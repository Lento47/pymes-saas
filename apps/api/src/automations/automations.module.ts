import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { WorkersModule } from '../workers/workers.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [WorkersModule, BillingModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
