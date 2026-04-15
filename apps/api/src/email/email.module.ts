import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module';
import { EmailService } from './email.service';
import { InboundController } from './inbound.controller';

@Module({
  imports: [CryptoModule],
  controllers: [InboundController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
