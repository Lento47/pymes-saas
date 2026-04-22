import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { QueueService } from './queue.service';
import { ClassifierProcessor } from './processors/classifier.processor';
import { DocumentProcessor } from './processors/document.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { FollowupProcessor } from './processors/followup.processor';
import { SummaryProcessor } from './processors/summary.processor';
import { NotificationProcessor } from './processors/notification.processor';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    QueueService,
    ClassifierProcessor,
    DocumentProcessor,
    AutomationProcessor,
    FollowupProcessor,
    SummaryProcessor,
    NotificationProcessor,
  ],
  exports: [QueueService],
})
export class WorkersModule {}
