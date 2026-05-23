import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { ContactMemoryService } from "./contact-memory.service";
import { CreditsService } from "./credits.service";
import { MemoryTtlJob } from "./memory-ttl.job";
import { MemoryController } from "./memory.controller";
import { AiTokensModule } from "../ai-tokens/ai-tokens.module";

@Module({
  imports: [PrismaModule, AiTokensModule],
  providers: [ContactMemoryService, CreditsService, MemoryTtlJob],
  controllers: [MemoryController],
  exports: [ContactMemoryService, CreditsService],
})
export class MemoryModule {}
