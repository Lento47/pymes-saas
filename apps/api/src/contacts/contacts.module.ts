import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { ContactMetricsService } from "./contact-metrics.service";
import { BillingModule } from "../billing/billing.module";
import { FeaturesModule } from "../features/features.module";
import { EventsModule } from "../gateways/events.module";

@Module({
  imports: [BillingModule, FeaturesModule, EventsModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactMetricsService],
  exports: [ContactsService],
})
export class ContactsModule {}
