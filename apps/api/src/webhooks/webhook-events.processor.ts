import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as crypto from "crypto";
import { WebhookEventsService } from "./webhook-events.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";

const WORKER_ID = `webhook-worker-${crypto.randomUUID().slice(0, 8)}`;
const BATCH_SIZE = 25;

@Injectable()
// TODO: Add dead-letter queue for webhook events that exhaust retries.
// Currently failed events are swept (sweepStuck) but permanently lost events
// have no fallback. Consider BullMQ dead-letter pattern or a failed_events table.
export class WebhookEventsProcessor {
  private readonly logger = new Logger(WebhookEventsProcessor.name);

  constructor(
    private readonly webhookEvents: WebhookEventsService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollEvents() {
    const events = await this.webhookEvents.claimBatch(WORKER_ID, BATCH_SIZE);
    if (!events || events.length === 0) return;

    this.logger.log(`Batch claimed — count=${events.length} worker=${WORKER_ID}`);

    for (const event of events) {
      this.logger.log(
        `Event claimed — id=${event.id} provider=${event.provider} type=${event.event_type} attempts=${event.attempts}`,
      );

      try {
        switch (event.provider) {
          case "whatsapp":
            await this.whatsapp.processInboundFromEvent(event);
            break;
          default:
            this.logger.warn(`Unknown provider — id=${event.id} provider=${event.provider}`);
            await this.webhookEvents.markFailed(event.id, `Unknown provider: ${event.provider}`);
            continue;
        }

        await this.webhookEvents.markProcessed(event.id);
      } catch (err) {
        const errorMsg = err?.message ?? "Unknown error";
        this.logger.error(`Event processing failed — id=${event.id} error=${errorMsg}`);
        await this.webhookEvents.markFailed(event.id, errorMsg);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStuckEvents() {
    const count = await this.webhookEvents.sweepStuck();
    if (count > 0) {
      this.logger.log(`Sweep recovered ${count} stuck webhook events`);
    }
  }

  @Cron("0 3 * * *") // 03:00 UTC daily
  async reconcileFailedEvents() {
    const count = await this.webhookEvents.reconcileStaleFailedEvents();
    if (count > 0) {
      this.logger.warn(`[reconcile] Reset ${count} stale FAILED webhook events back to PENDING`);
    } else {
      this.logger.log("[reconcile] No stale failed webhook events found");
    }
  }
}
