import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentController } from './agent.controller';
import { AgentToolsController } from './agent-tools.controller';
import { AiAssistantController } from './ai-assistant.controller';
import { PublicAgentController } from './public-agent.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { InsightsModule } from '../insights/insights.module';
import { SearchModule } from '../search/search.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    InsightsModule,
    SearchModule,
    forwardRef(() => ConversationsModule),
    NotificationsModule,
    forwardRef(() => EmailModule),
    forwardRef(() => WhatsAppModule),
    EventsModule,
  ],
  providers: [AiService, AgentService, AgentToolsService],
  controllers: [AgentController, AgentToolsController, AiAssistantController, PublicAgentController],
  exports: [AiService, AgentService, AgentToolsService],
})
export class AiModule {}

