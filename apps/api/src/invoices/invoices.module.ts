import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { HaciendaModule } from "../hacienda/hacienda.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FeaturesModule } from "../features/features.module";
import { WorkersModule } from "../workers/workers.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [
    AiModule,
    ConversationsModule,
    HaciendaModule,
    NotificationsModule,
    FeatureFlagsModule,
    FeaturesModule,
    WorkersModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, RemindersService],
})
export class InvoicesModule {}
