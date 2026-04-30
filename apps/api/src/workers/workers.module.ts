import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { StorageService } from '../common/storage/storage.service';
import { QUEUE_NAMES } from './queues.constants';
import { QueueService } from './queue.service';
import { ClassifierProcessor } from './processors/classifier.processor';
import { DocumentProcessor } from './processors/document.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { FollowupProcessor } from './processors/followup.processor';
import { SummaryProcessor } from './processors/summary.processor';

const logger = new Logger('WorkersModule');
let redisWarned = false;

function createRedisConnection(config: ConfigService) {
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = config.get<number>('REDIS_PORT', 6379);
  const password = config.get<string>('REDIS_PASSWORD');

  const redis = new IORedis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 500, 2000);
    },
    reconnectOnError: () => false,
  });

  redis.on('error', (err: any) => {
    if (err?.code === 'ECONNREFUSED') {
      if (!redisWarned) {
        logger.warn('Redis not available — background jobs disabled, using fallback rate limiting');
        redisWarned = true;
      }
    } else {
      logger.error(`Redis error: ${err?.message ?? err}`);
    }
  });

  return redis;
}

@Module({
  imports: [
    NotificationsModule,
    AiModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: createRedisConnection(config),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CLASSIFIER },
      { name: QUEUE_NAMES.DOCUMENT },
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.FOLLOWUP },
      { name: QUEUE_NAMES.SUMMARY },
    ),
  ],
  providers: [
    QueueService,
    ClassifierProcessor,
    DocumentProcessor,
    AutomationProcessor,
    FollowupProcessor,
    SummaryProcessor,
    StorageService,
  ],
  exports: [QueueService],
})
export class WorkersModule {}
