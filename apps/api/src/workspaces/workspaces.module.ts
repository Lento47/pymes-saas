import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { CryptoModule } from "../common/crypto/crypto.module";
import { BillingModule } from "../billing/billing.module";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { EventsModule } from "../gateways/events.module";
import { FeaturesModule } from "../features/features.module";

@Module({
  imports: [
    CryptoModule,
    BillingModule,
    AiModule,
    AuthModule,
    EmailModule,
    EventsModule,
    FeaturesModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
