import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { FlowiseClient } from "./flowise/flowise.client";
import { AgentRuntimeService } from "./runtime/agent-runtime.service";
import { AgentGuardrailsService } from "./runtime/agent-guardrails.service";
import { AgentUsageService } from "./runtime/agent-usage.service";
import { TtsModule } from "../tts/tts.module";
import { LearningModule } from "../learning/learning.module";
import { PlanLimitsModule } from "../common/plan-limits/plan-limits.module";

@Module({
  imports: [TtsModule, LearningModule, PlanLimitsModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    FlowiseClient,
    AgentRuntimeService,
    AgentGuardrailsService,
    AgentUsageService,
  ],
  exports: [AgentRuntimeService],
})
export class AgentsModule {}
