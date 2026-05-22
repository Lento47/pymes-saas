import { Module, forwardRef } from "@nestjs/common";
import { ConversationsController } from "./conversations.controller";
import { InboundController } from "./inbound.controller";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "./messages.service";
import { EventsModule } from "../gateways/events.module";
import { EmailModule } from "../email/email.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { MessageTemplatesModule } from "../message-templates/message-templates.module";
import { TelegramModule } from "../telegram/telegram.module";
import { AiModule } from "../ai/ai.module";
import { TasksModule } from "../tasks/tasks.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AutomationsModule } from "../automations/automations.module";
import { RoutingModule } from "../routing/routing.module";
import { SlaService } from "./sla.service";

@Module({
  imports: [
    EventsModule,
    forwardRef(() => EmailModule),
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => MessageTemplatesModule),
    forwardRef(() => AiModule),
    forwardRef(() => TasksModule),
    NotificationsModule,
    forwardRef(() => AutomationsModule),
    RoutingModule,
  ],
  controllers: [ConversationsController, InboundController],
  providers: [ConversationsService, MessagesService, SlaService],
  exports: [ConversationsService, MessagesService, SlaService],
})
export class ConversationsModule {}
