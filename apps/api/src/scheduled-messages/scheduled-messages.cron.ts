import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScheduledMessagesService } from "./scheduled-messages.service";

@Injectable()
export class ScheduledMessagesCron {
  private readonly logger = new Logger(ScheduledMessagesCron.name);
  private running = false;

  constructor(private readonly service: ScheduledMessagesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("processDue already running, skipping tick");
      return;
    }
    this.running = true;
    try {
      await this.service.processDue();
    } catch (err: any) {
      this.logger.error(`processDue error: ${err.message}`, err.stack);
    } finally {
      this.running = false;
    }
  }
}
