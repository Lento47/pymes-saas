import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [SamlController],
  providers: [SamlService],
})
export class SamlModule {}
