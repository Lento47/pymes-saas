import { Module } from '@nestjs/common';
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
import { DocsModule } from '../docs/docs.module';
import { SupportRouterService } from './support-router.service';
import { DiagnosticService } from './diagnostic.service';
import { EngineeringFixService } from './engineering-fix.service';

@Module({
  imports: [PrismaModule, CryptoModule, InsightsModule, SearchModule, DocsModule],
  providers: [AiService, AgentService, AgentToolsService, SupportRouterService, DiagnosticService, EngineeringFixService],
  controllers: [AgentController, AgentToolsController, AiAssistantController, PublicAgentController],
  exports: [AiService, AgentService, AgentToolsService],
})
export class AiModule {}

