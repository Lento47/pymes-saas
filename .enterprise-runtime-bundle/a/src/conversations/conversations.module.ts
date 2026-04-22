import { Module, forwardRef } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { InboundController } from './inbound.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { EventsModule } from '../gateways/events.module';
import { EmailModule } from '../email/email.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../ai/ai.module';
import { TasksModule } from '../tasks/tasks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [
    EventsModule,
    forwardRef(() => EmailModule),
    forwardRef(() => WhatsAppModule),
    AiModule,
    forwardRef(() => TasksModule),
    NotificationsModule,
    AutomationsModule,
  ],
  controllers: [ConversationsController, InboundController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule { }
