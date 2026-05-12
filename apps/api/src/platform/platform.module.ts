import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FeaturesModule } from '../features/features.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, FeaturesModule, AuditModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
