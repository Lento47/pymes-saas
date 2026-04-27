import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentController } from './agent.controller';
import { AgentToolsController } from './agent-tools.controller';
import { AiAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [AiService, AgentService, AgentToolsService],
  controllers: [AgentController, AgentToolsController, AiAssistantController],
  exports: [AiService, AgentService, AgentToolsService],
})
export class AiModule {}

