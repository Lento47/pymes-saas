import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { TasksModule } from './tasks/tasks.module';
import { DocumentsModule } from './documents/documents.module';
import { AutomationsModule } from './automations/automations.module';
import { SummariesModule } from './summaries/summaries.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { AuditModule } from './audit/audit.module';
import { WorkersModule } from './workers/workers.module';
import { EventsModule } from './gateways/events.module';
import { EmailModule } from './email/email.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PlanLimitsModule } from './common/plan-limits/plan-limits.module';
import { DepartmentsModule } from './departments/departments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),

    PrismaModule,
    StorageModule,
    CryptoModule,
    PlanLimitsModule,

    AuthModule,
    WorkspacesModule,
    UsersModule,

    ContactsModule,
    ChannelsModule,
    ConversationsModule,

    TasksModule,
    DocumentsModule,

    AutomationsModule,
    SummariesModule,
    NotificationsModule,

    SearchModule,
    AuditModule,

    DepartmentsModule,

    WorkersModule,
    EventsModule,
    EmailModule,
    WhatsAppModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
