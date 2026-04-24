import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { CryptoModule } from '../common/crypto/crypto.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [CryptoModule, PlanLimitsModule, AiModule, AuthModule, EmailModule, EventsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
