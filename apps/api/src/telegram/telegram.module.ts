import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [ConfigModule, PrismaModule, CryptoModule, ConversationsModule, EventsModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
