import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentController } from './agent.controller';
import { AgentToolsController } from './agent-tools.controller';
import { AiAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { InsightsModule } from '../insights/insights.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, CryptoModule, InsightsModule, SearchModule],
  providers: [AiService, AgentService, AgentToolsService],
  controllers: [AgentController, AgentToolsController, AiAssistantController],
  exports: [AiService, AgentService, AgentToolsService],
})
export class AiModule {}

