import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queues.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.CLASSIFIER)
    private readonly classifierQueue: Queue,

    @InjectQueue(QUEUE_NAMES.DOCUMENT)
    private readonly documentQueue: Queue,

    @InjectQueue(QUEUE_NAMES.AUTOMATION)
    private readonly automationQueue: Queue,

    @InjectQueue(QUEUE_NAMES.FOLLOWUP)
    private readonly followupQueue: Queue,

    @InjectQueue(QUEUE_NAMES.SUMMARY)
    private readonly summaryQueue: Queue,

    @InjectQueue(QUEUE_NAMES.HACIENDA)
    private readonly haciendaQueue: Queue,
  ) {}

  async enqueueClassifier(messageId: string, workspaceId: string): Promise<void> {
    await this.classifierQueue.add(
      'classify-message',
      { messageId, workspaceId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }

  async enqueueDocument(documentId: string, workspaceId: string): Promise<void> {
    await this.documentQueue.add(
      'process-document',
      { documentId, workspaceId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }

  async enqueueAutomation(
    ruleId: string,
    workspaceId: string,
    triggerEntityType: string,
    triggerEntityId: string,
  ): Promise<void> {
    await this.automationQueue.add(
      'run-automation',
      { ruleId, workspaceId, triggerEntityType, triggerEntityId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }
}
