import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DbInitService } from './db-init.service';

@Global()
@Module({
  providers: [PrismaService, DbInitService],
  exports: [PrismaService],
})
export class PrismaModule {}
