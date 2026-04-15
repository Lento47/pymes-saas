import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { InboundController } from './inbound.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';

@Module({
  controllers: [ConversationsController, InboundController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
