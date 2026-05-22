import { Module, forwardRef } from "@nestjs/common";
import { AutomationsService } from "./automations.service";
import { AutomationsController } from "./automations.controller";
import { WorkersModule } from "../workers/workers.module";
import { BillingModule } from "../billing/billing.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FeaturesModule } from "../features/features.module";

@Module({
  imports: [forwardRef(() => WorkersModule), BillingModule, FeatureFlagsModule, FeaturesModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
