import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { WebhookEventsModule } from '../webhooks/webhook-events.module';

@Module({
  imports: [forwardRef(() => ConversationsModule), forwardRef(() => WebhookEventsModule)],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
