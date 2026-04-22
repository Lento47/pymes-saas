import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

