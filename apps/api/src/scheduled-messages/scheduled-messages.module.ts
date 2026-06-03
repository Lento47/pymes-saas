import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { EventsModule } from "../gateways/events.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { TelegramModule } from "../telegram/telegram.module";
import { ScheduledMessagesService } from "./scheduled-messages.service";
import { ScheduledMessagesCron } from "./scheduled-messages.cron";
import { ScheduledMessagesController } from "./scheduled-messages.controller";

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
  ],
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService, ScheduledMessagesCron],
  exports: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
