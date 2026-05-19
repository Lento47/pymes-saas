import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { CryptoModule } from '../common/crypto/crypto.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { EventsModule } from '../gateways/events.module';
import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [CryptoModule, AiModule, AuthModule, EmailModule, EventsModule, BillingModule, StorageModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
