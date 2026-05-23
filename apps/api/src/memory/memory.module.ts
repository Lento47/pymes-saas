import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { ContactMemoryService } from "./contact-memory.service";
import { CreditsService } from "./credits.service";
import { MemoryTtlJob } from "./memory-ttl.job";
import { MemoryController } from "./memory.controller";

@Module({
  imports: [PrismaModule],
  providers: [ContactMemoryService, CreditsService, MemoryTtlJob],
  controllers: [MemoryController],
  exports: [ContactMemoryService, CreditsService],
})
export class MemoryModule {}
