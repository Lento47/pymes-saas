import { Module } from "@nestjs/common";
import { LearningController } from "./learning.controller";
import { CustomerMemoryService } from "./customer-memory.service";
import { BusinessMemoryService } from "./business-memory.service";
import { ConversationInsightService } from "./conversation-insight.service";
import { OutcomeTrackerService } from "./outcome-tracker.service";
import { PlaybookEngineService } from "./playbook-engine.service";

@Module({
  controllers: [LearningController],
  providers: [
    CustomerMemoryService,
    BusinessMemoryService,
    ConversationInsightService,
    OutcomeTrackerService,
    PlaybookEngineService,
  ],
  exports: [
    CustomerMemoryService,
    BusinessMemoryService,
    ConversationInsightService,
    OutcomeTrackerService,
  ],
})
export class LearningModule {}
