import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { CloudflareAiService } from './cloudflare-ai.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule, ConfigModule],
  controllers: [AiController],
  providers: [AiService, CloudflareAiService],
  exports: [AiService, CloudflareAiService],
})
export class AiModule {}

