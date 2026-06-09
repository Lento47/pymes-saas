import { Module } from "@nestjs/common";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";
import { TelegramModule } from "../telegram/telegram.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [TelegramModule, AuditModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
