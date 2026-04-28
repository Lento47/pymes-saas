import { Module } from '@nestjs/common';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SamlController],
  providers: [SamlService],
})
export class SamlModule {}
