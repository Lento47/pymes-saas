import { Module, forwardRef } from "@nestjs/common";
import { WebhookEventsService } from "./webhook-events.service";
import { WebhookEventsProcessor } from "./webhook-events.processor";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";

@Module({
  imports: [forwardRef(() => WhatsAppModule)],
  providers: [WebhookEventsService, WebhookEventsProcessor],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}
