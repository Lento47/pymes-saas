import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [AiService, AgentService],
  controllers: [AgentController],
  exports: [AiService, AgentService],
})
export class AiModule {}

