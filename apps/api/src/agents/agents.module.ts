import { Module, OnModuleInit } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { FlowiseClient } from "./flowise/flowise.client";
import { FlowiseHealthService } from "./flowise/flowise-health.service";
import { AgentRuntimeService } from "./runtime/agent-runtime.service";
import { AgentGuardrailsService } from "./runtime/agent-guardrails.service";
import { AgentUsageService } from "./runtime/agent-usage.service";
import { TtsModule } from "../tts/tts.module";
import { LearningModule } from "../learning/learning.module";
import { PlanLimitsModule } from "../common/plan-limits/plan-limits.module";
import { SupportAgentTemplateSeed } from "./support-agent-template.seed";
import { FlowiseSetupService } from "./flowise-setup.service";
import { PrCreationPolicyService } from "./support/pr-creation-policy.service";
import { SupportOrchestratorService } from "./support/support-orchestrator.service";
import { PrismaModule } from "../common/prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventsModule } from "../gateways/events.module";
import { AuditModule } from "../audit/audit.module";
import { MemoryModule } from "../memory/memory.module";

@Module({
  imports: [TtsModule, LearningModule, PlanLimitsModule, PrismaModule, NotificationsModule, EventsModule, AuditModule, MemoryModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    FlowiseClient,
    FlowiseHealthService,
    AgentRuntimeService,
    AgentGuardrailsService,
    AgentUsageService,
    SupportAgentTemplateSeed,
    FlowiseSetupService,
    PrCreationPolicyService,
    SupportOrchestratorService,
  ],
  exports: [AgentRuntimeService, AgentGuardrailsService, FlowiseSetupService, FlowiseClient, FlowiseHealthService, PrCreationPolicyService, SupportOrchestratorService],
})
export class AgentsModule implements OnModuleInit {
  constructor(
    private readonly supportSeed: SupportAgentTemplateSeed,
    private readonly flowiseSetup: FlowiseSetupService,
  ) {}

  async onModuleInit() {
    await this.supportSeed.seed();
    // Auto-import 4 tiered support chatflows into Flowise (non-fatal)
    this.flowiseSetup.setup().catch((err: any) =>
      console.warn("[flowise-setup] Non-fatal setup error:", err?.message),
    );
  }
}
