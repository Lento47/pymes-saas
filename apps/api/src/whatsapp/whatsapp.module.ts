import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [forwardRef(() => ConversationsModule), EventsModule],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
