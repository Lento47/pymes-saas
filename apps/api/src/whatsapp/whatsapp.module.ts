import { Module, forwardRef } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";
import { WhatsAppHealthController } from "./whatsapp-health.controller";
import { WhatsAppRateLimiter } from "./whatsapp-rate-limiter";
import { ConversationsModule } from "../conversations/conversations.module";
import { WebhookEventsModule } from "../webhooks/webhook-events.module";
import { EventsModule } from "../gateways/events.module";

@Module({
  imports: [
    forwardRef(() => ConversationsModule),
    forwardRef(() => WebhookEventsModule),
    EventsModule,
  ],
  controllers: [WhatsAppWebhookController, WhatsAppHealthController],
  providers: [WhatsAppService, WhatsAppRateLimiter],
  exports: [WhatsAppService, WhatsAppRateLimiter],
})
export class WhatsAppModule {}
