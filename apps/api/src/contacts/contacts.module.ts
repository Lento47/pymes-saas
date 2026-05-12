import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { BillingModule } from '../billing/billing.module';
import { FeaturesModule } from '../features/features.module';

@Module({
  imports: [BillingModule, FeaturesModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
