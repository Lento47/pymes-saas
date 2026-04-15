import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { InboundController } from './inbound.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [EventsModule],
  controllers: [ConversationsController, InboundController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule { }
