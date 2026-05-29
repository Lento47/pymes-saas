import { Module, forwardRef } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { StorageModule } from "../common/storage/storage.module";
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
import { AiGatewayService } from "./ai-gateway.service";
import { EmrendeAiService } from "./emprende-ai.service";
import { EmrendeAiController } from "./emprende-ai.controller";
import { AgentRunService } from "./agent-run.service";
import { AiConversationControlService } from "./ai-conversation-control.service";
import { AiProviderBalancerService } from "./ai-provider-balancer.service";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { TelegramModule } from "../telegram/telegram.module";
import { PlanLimitsModule } from "../common/plan-limits/plan-limits.module";
import { MemoryModule } from "../memory/memory.module";
import { AiTokensModule } from "../ai-tokens/ai-tokens.module";

import { AiTriageService } from "./ai-triage.service";
import { ElevenLabsService } from "./elevenlabs.service";
import { MessageRouterService } from "./message-router/message-router.service";
import { IntentClassifierService } from "./message-router/intent-classifier.service";
import { LlmIntentClassifierService } from "./message-router/llm-intent-classifier.service";
import { QuickReplyService } from "./message-router/quick-reply.service";
import { PolicyEngineService } from "./message-router/policy-engine.service";
import { SmartSendService } from "./message-router/smart-send.service";
import { AgentDispatcherService } from "./message-router/agent-dispatcher.service";
import { HumanHandoffService } from "./message-router/human-handoff.service";
import { ContextEnricherService } from "./message-router/context-enricher.service";
import { ModelSelectorService } from "./message-router/model-selector.service";
import { RouterMetricsService } from "./message-router/router-metrics.service";
import { AiDecisionAuditService } from "./message-router/ai-decision-audit.service";
import { EmprendePlaybooksService } from "./emprende-playbooks.service";
import { PlaybookExecutionService } from "./playbook-execution.service";
import { PlatformAdminService } from "./platform-admin.service";
import { FixApprovalService } from "./fix-approval.service";
import { FlowiseAutoReplyService } from "./flowise-auto-reply.service";
import { ProductMetricsModule } from "../common/metrics/product-metrics.module";
import { PlatformModule } from "../platform/platform.module";

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
    PlanLimitsModule,
    MemoryModule,
    AiTokensModule,
    StorageModule,
    ProductMetricsModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => PlatformModule),
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
    AiGatewayService,
    AiProviderBalancerService,
    AiTriageService,
    EmrendeAiService,
    AgentRunService,
    AiConversationControlService,
    ElevenLabsService,
    EmprendePlaybooksService,
    PlaybookExecutionService,
    PlatformAdminService,
    FixApprovalService,
    FlowiseAutoReplyService,
    MessageRouterService,
    IntentClassifierService,
    LlmIntentClassifierService,
    QuickReplyService,
    PolicyEngineService,
    SmartSendService,
    AgentDispatcherService,
    HumanHandoffService,
    ContextEnricherService,
    ModelSelectorService,
    RouterMetricsService,
    AiDecisionAuditService,
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
    AiGatewayService,
    AiProviderBalancerService,
    AiTriageService,
    EmrendeAiService,
    AgentRunService,
    AiConversationControlService,
    ElevenLabsService,
    EmprendePlaybooksService,
    PlaybookExecutionService,
    PlatformAdminService,
    FixApprovalService,
    FlowiseAutoReplyService,
    MessageRouterService,
    IntentClassifierService,
    LlmIntentClassifierService,
    QuickReplyService,
    PolicyEngineService,
    SmartSendService,
    AgentDispatcherService,
    HumanHandoffService,
    ContextEnricherService,
    ModelSelectorService,
    RouterMetricsService,
    AiDecisionAuditService,
  ],
})
export class AiModule {}
