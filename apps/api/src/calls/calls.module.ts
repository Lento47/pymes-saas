import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { EventsModule } from "../gateways/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { CallRateLimitGuard } from "./call-rate-limit.guard";

@Module({
  imports: [PrismaModule, EventsModule, NotificationsModule, FeatureFlagsModule],
  controllers: [CallsController],
  providers: [CallsService, CallRateLimitGuard],
  exports: [CallsService],
})
export class CallsModule {}
