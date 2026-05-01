import { Module, forwardRef } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module';
import { EmailService } from './email.service';
import { SmtpService } from './smtp.service';
import { InboundController } from './inbound.controller';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [CryptoModule, forwardRef(() => ConversationsModule)],
  controllers: [InboundController],
  providers: [EmailService, SmtpService],
  exports: [EmailService, SmtpService],
})
export class EmailModule {}
