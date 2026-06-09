import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "./queues.constants";

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
      "classify-message",
      { messageId, workspaceId },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
  }

  async enqueueDocument(documentId: string, workspaceId: string): Promise<void> {
    await this.documentQueue.add(
      "process-document",
      { documentId, workspaceId },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
  }

  async enqueueAutomation(
    ruleId: string,
    workspaceId: string,
    triggerEntityType: string,
    triggerEntityId: string,
  ): Promise<void> {
    await this.automationQueue.add(
      "run-automation",
      { ruleId, workspaceId, triggerEntityType, triggerEntityId },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    );
  }

  /**
   * Enqueue a Hacienda invoice submission job.
   *
   * Retry policy (Ley 8001 — 8-day contingency window):
   *   10 attempts × exponential backoff starting at 5s, capped at 30 min.
   *   Attempts: 5s → 10s → 20s → 40s → 80s → 2.7m → 5.5m → 11m → 22m → 30m
   *   Total window: ≈ 72 minutes — well inside the 8-day contingency deadline.
   *
   * Dead-letter: failed jobs are kept in Redis for 500 entries so admins can
   * inspect / retry from a dashboard. Use invoiceId as jobId for idempotency —
   * duplicate enqueues for the same invoice are silently ignored by BullMQ.
   */
  async enqueueHaciendaSubmit(invoiceId: string, workspaceId: string): Promise<void> {
    await this.haciendaQueue.add(
      "submit-invoice",
      { invoiceId, workspaceId },
      {
        jobId: invoiceId,
        attempts: 10,
        backoff: {
          type: "custom",
          // Exponential delay capped at 30 minutes
          delay: 5_000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 }, // dead-letter: keep 500 failed jobs for inspection
      },
    );
  }
}
