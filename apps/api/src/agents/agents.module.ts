import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { FlowiseClient } from "./flowise/flowise.client";
import { AgentRuntimeService } from "./runtime/agent-runtime.service";
import { AgentGuardrailsService } from "./runtime/agent-guardrails.service";
import { AgentUsageService } from "./runtime/agent-usage.service";

@Module({
  imports: [],
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
