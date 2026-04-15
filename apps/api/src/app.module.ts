import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// ── Common ────────────────────────────────────────────────────────────────────
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';

// ── Feature modules ───────────────────────────────────────────────────────────
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { EmailModule } from './email/email.module';

// ── WebSocket gateway (global) ────────────────────────────────────────────────
import { EventsModule } from './events/events.module';

// ─────────────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    // Environment variables — load first so all modules can access process.env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Infrastructure (both are @Global — available everywhere without import)
    PrismaModule,
    CryptoModule,

    // Real-time WebSocket gateway
    EventsModule,

    // Auth
    AuthModule,

    // Feature modules
    ChannelsModule,
    ConversationsModule,

    // Email / Resend integration
    EmailModule,
  ],
})
export class AppModule {}
