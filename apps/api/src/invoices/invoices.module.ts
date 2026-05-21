import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { HaciendaModule } from "../hacienda/hacienda.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkersModule } from "../workers/workers.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [
    AiModule,
    ConversationsModule,
    HaciendaModule,
    NotificationsModule,
    WorkersModule,
    forwardRef(() => WhatsAppModule),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, RemindersService],
})
export class InvoicesModule {}
