import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RunbooksController } from './runbooks.controller';
import { RunbooksService } from './runbooks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RunbooksController],
  providers: [RunbooksService],
  exports: [RunbooksService],
})
export class RunbooksModule {}
