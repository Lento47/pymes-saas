import { Module, forwardRef } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AgentService } from "./agent.service";
import { AgentToolsService } from "./agent-tools.service";
import { AgentController } from "./agent.controller";
import { AgentToolsController } from "./agent-tools.controller";
import { AiAssistantController } from "./ai-assistant.controller";
import { PublicAgentController } from "./public-agent.controller";
import { PrismaModule } from "../common/prisma/prisma.module";
import { CryptoModule } from "../common/crypto/crypto.module";
import { InsightsModule } from "../insights/insights.module";
import { SearchModule } from "../search/search.module";
import { DocsModule } from "../docs/docs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventsModule } from "../gateways/events.module";
import { SupportRouterService } from "./support-router.service";
import { DiagnosticService } from "./diagnostic.service";
import { EngineeringFixService } from "./engineering-fix.service";
import { SupportNotificationService } from "./support-notification.service";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { CaseCommentsService } from "./case-comments.service";
import { CloudflareAiService } from "./cloudflare-ai.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { EmrendeAiController } from "./emprende-ai.controller";
import { AgentRunService } from "./agent-run.service";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { TelegramModule } from "../telegram/telegram.module";

import { AiTriageService } from "./ai-triage.service";

// NOTE: do NOT import EmailModule here. Adding it creates a cycle
// AiModule → EmailModule → ConversationsModule → AiModule (the last
// link is eager because ConversationsModule.imports has AiModule
// without forwardRef, and MessagesService injects AiService directly).
// Email-based support notifications are dispatched via a downstream
// transactional-email path that doesn't share AiModule's DI graph.

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    InsightsModule,
    SearchModule,
    DocsModule,
    EventsModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
  ],
  providers: [
    AiService,
    AgentService,
    AgentToolsService,
    SupportRouterService,
    DiagnosticService,
    EngineeringFixService,
    SupportNotificationService,
    KnowledgeBaseService,
    CaseCommentsService,
    CloudflareAiService,
    AiTriageService,
    EmrendeAiService,
    AgentRunService,
  ],
  controllers: [
    AgentController,
    AgentToolsController,
    AiAssistantController,
    PublicAgentController,
    EmrendeAiController,
  ],
  exports: [
    AiService,
    AgentService,
    AgentToolsService,
    SupportNotificationService,
    KnowledgeBaseService,
    CloudflareAiService,
    AiTriageService,
    EmrendeAiService,
    AgentRunService,
  ],
})
export class AiModule {}
