import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

// Shared / Global
import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { PlanLimitsModule } from './common/plan-limits/plan-limits.module';

// Fase 1
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UsersModule } from './users/users.module';

// Fase 2
import { ContactsModule } from './contacts/contacts.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';

// Fase 3
import { TasksModule } from './tasks/tasks.module';
import { DocumentsModule } from './documents/documents.module';

// Fase 4
import { AutomationsModule } from './automations/automations.module';
import { SummariesModule } from './summaries/summaries.module';
import { NotificationsModule } from './notifications/notifications.module';

// Fase 5
import { SearchModule } from './search/search.module';
import { AuditModule } from './audit/audit.module';

// Workers
import { WorkersModule } from './workers/workers.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),

    // Shared global
    PrismaModule,
    StorageModule,
    PlanLimitsModule,
    HealthModule,

    // Fase 1
    AuthModule,
    WorkspacesModule,
    UsersModule,

    // Fase 2
    ContactsModule,
    ChannelsModule,
    ConversationsModule,

    // Fase 3
    TasksModule,
    DocumentsModule,

    // Fase 4
    AutomationsModule,
    SummariesModule,
    NotificationsModule,

    // Fase 5
    SearchModule,
    AuditModule,

    // Workers
    WorkersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
