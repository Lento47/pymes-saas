import { Module, forwardRef } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";
import { WhatsAppHealthController } from "./whatsapp-health.controller";
import { WhatsAppRateLimiter } from "./whatsapp-rate-limiter";
import { ConversationsModule } from "../conversations/conversations.module";

@Module({
  imports: [forwardRef(() => ConversationsModule)],
  controllers: [WhatsAppWebhookController, WhatsAppHealthController],
  providers: [WhatsAppService, WhatsAppRateLimiter],
  exports: [WhatsAppService, WhatsAppRateLimiter],
})
export class WhatsAppModule {}
