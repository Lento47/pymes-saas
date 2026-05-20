import { Module, forwardRef } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module';
import { EmailService } from './email.service';
import { SmtpService } from './smtp.service';
// NOTE: InboundController and EmailController are both defined in
// ./inbound.controller.ts (two classes, one file). The InboundController
// handles the POST /inbound/email/webhook route; EmailController handles
// POST /email/test-smtp.
import { InboundController } from './inbound.controller';
import { EmailController } from './inbound.controller';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [CryptoModule, forwardRef(() => ConversationsModule)],
  controllers: [InboundController, EmailController],
  providers: [EmailService, SmtpService],
  exports: [EmailService, SmtpService],
})
export class EmailModule {}
