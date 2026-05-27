import { Module, OnModuleInit } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { FlowiseClient } from "./flowise/flowise.client";
import { AgentRuntimeService } from "./runtime/agent-runtime.service";
import { AgentGuardrailsService } from "./runtime/agent-guardrails.service";
import { AgentUsageService } from "./runtime/agent-usage.service";
import { TtsModule } from "../tts/tts.module";
import { LearningModule } from "../learning/learning.module";
import { PlanLimitsModule } from "../common/plan-limits/plan-limits.module";
import { SupportAgentTemplateSeed } from "./support-agent-template.seed";

@Module({
  imports: [TtsModule, LearningModule, PlanLimitsModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    FlowiseClient,
    AgentRuntimeService,
    AgentGuardrailsService,
    AgentUsageService,
    SupportAgentTemplateSeed,
  ],
  exports: [AgentRuntimeService],
})
export class AgentsModule implements OnModuleInit {
  constructor(private readonly supportSeed: SupportAgentTemplateSeed) {}

  async onModuleInit() {
    await this.supportSeed.seed();
  }
}
