import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerStorage } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { RedisThrottlerStorage } from "./common/redis-throttler-storage.service";

import { PrismaModule } from "./common/prisma/prisma.module";
import { StorageModule } from "./common/storage/storage.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { UsersModule } from "./users/users.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ChannelsModule } from "./channels/channels.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { TasksModule } from "./tasks/tasks.module";
import { DocumentsModule } from "./documents/documents.module";
import { AutomationsModule } from "./automations/automations.module";
import { SummariesModule } from "./summaries/summaries.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SearchModule } from "./search/search.module";
import { AuditModule } from "./audit/audit.module";
import { WorkersModule } from "./workers/workers.module";
import { EventsModule } from "./gateways/events.module";
import { EmailModule } from "./email/email.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { PlanLimitsModule } from "./common/plan-limits/plan-limits.module";
import { DepartmentsModule } from "./departments/departments.module";
import { InsightsModule } from "./insights/insights.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { InviteCodesModule } from "./invite-codes/invite-codes.module";
import { ErrorReportsModule } from "./error-reports/error-reports.module";
import { PlatformModule } from "./platform/platform.module";
import { RunbooksModule } from "./runbooks/runbooks.module";
import { HaciendaModule } from "./hacienda/hacienda.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { OrdersModule } from "./orders/orders.module";
import { HealthModule } from "./health/health.module";
import { BackupModule } from "./backup/backup.module";
import { AiModule } from "./ai/ai.module";
import { AgentsModule } from "./agents/agents.module";
import { TtsModule } from "./tts/tts.module";
import { ApiTokensModule } from "./api-tokens/api-tokens.module";
import { SanitizeModule } from "./common/sanitize/sanitize.module";
import { DataRetentionModule } from "./common/data-retention/data-retention.module";
import { CacheModule } from "./common/cache/cache.module";
import { BillingModule } from "./billing/billing.module";
import { RoutingModule } from "./routing/routing.module";
import { PlanThrottlerGuard } from "./common/plan-limits/plan-throttler.guard";
import { SamlModule } from "./auth/saml/saml.module";
import { I18nModule } from "./common/i18n/i18n.module";
import { TelegramModule } from "./telegram/telegram.module";
import { WebhookEventsModule } from "./webhooks/webhook-events.module";

// Demo data & templates
import { DemoModule } from "./demo/demo.module";
import { TemplateModule } from "./templates/template.module";
import { ImportModule } from "./import/import.module";
import { EnterpriseModule } from "./enterprise/enterprise.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { SlaModule } from "./sla/sla.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { MemoryModule } from "./memory/memory.module";
import { ContactSalesModule } from "./contact-sales/contact-sales.module";
import { UsageMeteringModule } from "./usage-metering/usage-metering.module";
import { MessageTemplatesModule } from "./message-templates/message-templates.module";
import { ProductMetricsModule } from "./common/metrics/product-metrics.module";
import { InventoryModule } from "./inventory/inventory.module";
import { AiTokensModule } from "./ai-tokens/ai-tokens.module";
import { LearningModule } from "./learning/learning.module";
import { ScheduledMessagesModule } from "./scheduled-messages/scheduled-messages.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 100 },   // IP no autenticada: 100/min
      { name: "auth", ttl: 15 * 60_000, limit: 10 },  // login/register: 10/15min
      { name: "webhook", ttl: 60_000, limit: 200 },   // webhooks WA/Telegram: 200/min
      { name: "ai", ttl: 60_000, limit: 30 },          // rutas de agente IA: 30/min
    ]),
    ScheduleModule.forRoot(),

    PrismaModule,
    StorageModule,
    CryptoModule,
    PlanLimitsModule,
    SanitizeModule,
    DataRetentionModule,
    CacheModule,

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
    InsightsModule,
    InvoicesModule,
    InviteCodesModule,
    HaciendaModule,
    PipelineModule,
    OrdersModule,
    AiModule,
    TtsModule,
    AgentsModule,
    ErrorReportsModule,
    HealthModule,
    BackupModule,
    ApiTokensModule,
    BillingModule,
    RoutingModule,
    SamlModule,
    I18nModule,
    TelegramModule,
    PlatformModule,
    RunbooksModule,

    WorkersModule,
    EventsModule,
    EmailModule,
    WhatsAppModule,
    WebhookEventsModule,

    // Business+ Enterprise
    EnterpriseModule,
    FeatureFlagsModule,
    SlaModule,
    OnboardingModule,
    MemoryModule,
    ContactSalesModule,
    UsageMeteringModule,
    MessageTemplatesModule,
    InventoryModule,
    AiTokensModule,
    LearningModule,
    ScheduledMessagesModule,

    // Metrics
    ProductMetricsModule,

    // Demo & Templates
    DemoModule,
    TemplateModule,
    ImportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PlanThrottlerGuard },
    { provide: ThrottlerStorage, useClass: RedisThrottlerStorage },
    RedisThrottlerStorage,
  ],
})
export class AppModule {}
