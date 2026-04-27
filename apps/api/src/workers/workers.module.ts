import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';

import { QUEUE_NAMES } from './queues.constants';
import { QueueService } from './queue.service';
import { ClassifierProcessor } from './processors/classifier.processor';
import { DocumentProcessor } from './processors/document.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { FollowupProcessor } from './processors/followup.processor';
import { SummaryProcessor } from './processors/summary.processor';
import { NotificationProcessor } from './processors/notification.processor';

@Module({
  imports: [
    AiModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          username: config.get<string>('REDIS_USERNAME') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CLASSIFIER },
      { name: QUEUE_NAMES.DOCUMENT },
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.FOLLOWUP },
      { name: QUEUE_NAMES.SUMMARY },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
  ],
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
