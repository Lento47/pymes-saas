import { Module } from '@nestjs/common';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuthModule } from '../auth.module';

@Module({
  imports: [PrismaModule, CryptoModule, AuthModule],
  controllers: [SamlController],
  providers: [SamlService],
  exports: [SamlService],
})
export class SamlModule {}
