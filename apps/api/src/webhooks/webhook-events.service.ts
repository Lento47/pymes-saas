import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { parseJsonValue } from "../common/prisma/json";
import { WebhookEventStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    provider: string,
    payload: Record<string, any>,
  ): Promise<{ event: Record<string, any>; duplicate: boolean }> {
    const { eventType, fingerprint, phoneNumberId, wabaId, providerMessageId } =
      this.extractEventMeta(provider, payload);

    let workspaceId: string | null = null;
    if (phoneNumberId) {
      try {
        // Fetch all active WhatsApp channels and filter in-memory
        // to handle both object and string config_json values
        const channels = await this.prisma.channel.findMany({
          where: { type: "WHATSAPP", status: "ACTIVE" },
          select: { workspace_id: true, config_json: true },
        });

        const matched = channels.find((ch) => {
          const cfg = parseJsonValue<Record<string, any>>(ch.config_json, {});
          return cfg.phone_number_id === phoneNumberId || cfg.waba_id === phoneNumberId;
        });

        workspaceId = matched?.workspace_id ?? null;
      } catch (err) {
        this.logger.warn(
          `[${provider}] Failed to resolve workspace for phone_number_id=${phoneNumberId}: ${err}`,
        );
      }
    }

    try {
      const event = await this.prisma.webhookEvent.create({
        data: {
          provider,
          event_type: eventType,
          workspace_id: workspaceId,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          provider_message_id: providerMessageId,
          event_fingerprint: fingerprint,
          payload_json: payload as any,
        },
      });

      this.logger.log(
        `[${provider}] Webhook persisted — id=${event.id} fingerprint=${fingerprint} type=${eventType}` +
          (workspaceId ? ` workspace_id=${workspaceId}` : "") +
          (phoneNumberId ? ` phone_number_id=${phoneNumberId}` : ""),
      );

      return { event, duplicate: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.prisma.webhookEvent.findUnique({
          where: { event_fingerprint: fingerprint },
        });
        if (existing) {
          this.logger.log(
            `[${provider}] Duplicate webhook ignored (race-safe) — fingerprint=${fingerprint}`,
          );
          return { event: existing, duplicate: true };
        }
      }
      throw err;
    }
  }

  async claimNext(workerId: string): Promise<any | null> {
    const result = await this.prisma.rawQuery<any[]>(
      `
      UPDATE "webhook_events"
      SET
        status = 'PROCESSING'::"WebhookEventStatus",
        attempts = attempts + 1,
        locked_at = NOW(),
        locked_by = $1,
        updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM "webhook_events"
        WHERE status = 'PENDING'::"WebhookEventStatus"
           OR (status = 'RETRYABLE'::"WebhookEventStatus" AND next_retry_at <= NOW())
        ORDER BY received_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `,
      workerId,
    );

    return result?.length > 0 ? result[0] : null;
  }

  /**
   * Claim up to `batchSize` pending webhook events in a single DB round-trip.
   * Uses FOR UPDATE SKIP LOCKED for safe concurrent access across workers.
   */
  async claimBatch(workerId: string, batchSize: number = 25): Promise<any[]> {
    if (batchSize < 1) return [];

    const result = await this.prisma.rawQuery<any[]>(
      `UPDATE "webhook_events"
       SET
         status = 'PROCESSING'::"WebhookEventStatus",
         attempts = attempts + 1,
         locked_at = NOW(),
         locked_by = $1,
         updated_at = NOW()
       WHERE id IN (
         SELECT id
         FROM "webhook_events"
         WHERE status = 'PENDING'::"WebhookEventStatus"
            OR (status = 'RETRYABLE'::"WebhookEventStatus" AND next_retry_at <= NOW())
         ORDER BY received_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *;`,
      workerId,
      batchSize,
    );

    return result ?? [];
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookEventStatus.PROCESSED,
        locked_at: null,
        locked_by: null,
        processed_at: new Date(),
      },
    });
    this.logger.log(`Webhook event processed — id=${eventId}`);
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) return;

    // 5 attempts: exponential backoff 1m → 5m → 15m → 30m, then FAILED (dead-letter)
    if (event.attempts >= 5) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: WebhookEventStatus.FAILED,
          last_error: error,
          locked_at: null,
          locked_by: null,
        },
      });
      this.logger.error(
        `Webhook event FAILED (max attempts=5) — id=${eventId} attempts=${event.attempts} error=${error}`,
      );
    } else {
      const delays = [60_000, 300_000, 900_000, 1_800_000]; // 1m, 5m, 15m, 30m
      const delay = delays[event.attempts - 1] ?? 1_800_000;
      const nextRetryAt = new Date(Date.now() + delay);

      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: WebhookEventStatus.RETRYABLE,
          last_error: error,
          next_retry_at: nextRetryAt,
          locked_at: null,
          locked_by: null,
        },
      });
      this.logger.warn(
        `Webhook event RETRYABLE — id=${eventId} attempts=${event.attempts} next_retry_at=${nextRetryAt.toISOString()} error=${error}`,
      );
    }
  }

  /**
   * Daily reconciliation: re-queues FAILED events from the past 24 h that still
   * haven't been picked up, and returns a count of what was reset.
   * Called by the reconciliation cron at 03:00 UTC.
   */
  async reconcileStaleFailedEvents(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.rawQuery<{ id: string }[]>(`
      UPDATE "webhook_events"
      SET
        status = 'PENDING'::"WebhookEventStatus",
        attempts = 0,
        next_retry_at = NULL,
        locked_at = NULL,
        locked_by = NULL,
        last_error = CONCAT('[reconciled] ', last_error),
        updated_at = NOW()
      WHERE status = 'FAILED'::"WebhookEventStatus"
        AND created_at >= $1
      RETURNING id;
    `, cutoff);

    return result?.length ?? 0;
  }

  /**
   * Returns a summary of webhook event processing health for the admin dashboard.
   * Scoped to the last 24 h.
   */
  async getSyncStatus(): Promise<{
    last24h: { pending: number; processing: number; processed: number; retryable: number; failed: number };
    stuckCount: number;
  }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const counts = await this.prisma.rawQuery<{ status: string; cnt: string }[]>(`
      SELECT status, COUNT(*) AS cnt
      FROM "webhook_events"
      WHERE created_at >= $1
      GROUP BY status
    `, since);

    const byStatus: Record<string, number> = {};
    for (const row of counts ?? []) {
      byStatus[row.status] = parseInt(row.cnt, 10);
    }

    const stuckRows = await this.prisma.rawQuery<{ cnt: string }[]>(`
      SELECT COUNT(*) AS cnt
      FROM "webhook_events"
      WHERE status = 'PROCESSING'::"WebhookEventStatus"
        AND locked_at < NOW() - INTERVAL '5 minutes'
    `);

    return {
      last24h: {
        pending: byStatus["PENDING"] ?? 0,
        processing: byStatus["PROCESSING"] ?? 0,
        processed: byStatus["PROCESSED"] ?? 0,
        retryable: byStatus["RETRYABLE"] ?? 0,
        failed: byStatus["FAILED"] ?? 0,
      },
      stuckCount: parseInt(stuckRows?.[0]?.cnt ?? "0", 10),
    };
  }

  async sweepStuck(): Promise<number> {
    const stuckEvents = await this.prisma.rawQuery<any[]>(`
      UPDATE "webhook_events"
      SET
        status = CASE
          WHEN attempts >= 4 THEN 'FAILED'::"WebhookEventStatus"
          ELSE 'RETRYABLE'::"WebhookEventStatus"
        END,
        next_retry_at = CASE
          WHEN attempts >= 4 THEN NULL
          ELSE NOW()
        END,
        locked_at = NULL,
        locked_by = NULL,
        last_error = CASE
          WHEN attempts >= 4 THEN COALESCE(last_error, 'Stuck in PROCESSING — timed out')
          ELSE last_error
        END,
        updated_at = NOW()
      WHERE status = 'PROCESSING'::"WebhookEventStatus"
        AND locked_at < NOW() - INTERVAL '5 minutes'
      RETURNING id, status, attempts;
    `);

    if (stuckEvents?.length > 0) {
      for (const ev of stuckEvents) {
        this.logger.warn(
          `Stuck webhook recovered — id=${ev.id} status=${ev.status} attempts=${ev.attempts}`,
        );
      }
    }

    return stuckEvents?.length ?? 0;
  }

  private extractEventMeta(
    provider: string,
    payload: Record<string, any>,
  ): {
    eventType: string;
    fingerprint: string;
    phoneNumberId: string | null;
    wabaId: string | null;
    providerMessageId: string | null;
  } {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const wabaId = entry?.id ?? null;
    const phoneNumberId = value?.metadata?.phone_number_id ?? null;
    const messages = value?.messages;
    const statuses = value?.statuses;

    if (messages?.length > 0) {
      const msg = messages[0];
      if (!msg.id) {
        throw new Error(
          `[${provider}] Message event missing msg.id — cannot generate deterministic fingerprint`,
        );
      }
      const fp = `${provider}:message:${msg.id}`;
      return {
        eventType: "message",
        fingerprint: fp,
        phoneNumberId,
        wabaId,
        providerMessageId: msg.id,
      };
    }

    if (statuses?.length > 0) {
      const st = statuses[0];
      const statusId = st.id ?? "";
      const recipientId = st.recipient_id ?? "";
      const ts = st.timestamp ?? "";
      const statusVal = st.status ?? "";
      const fp = `${provider}:status:${statusId}:${recipientId}:${ts}:${statusVal}`;
      return {
        eventType: "status",
        fingerprint: fp,
        phoneNumberId,
        wabaId,
        providerMessageId: statusId,
      };
    }

    const stableParts = [
      provider,
      phoneNumberId ?? "unknown",
      value?.metadata?.display_phone_number ?? "",
      JSON.stringify(this.normalizePayload(value ?? {})),
    ];
    const hash = crypto.createHash("sha256").update(stableParts.join("|")).digest("hex");
    const fp = `${provider}:other:${hash}`;

    return {
      eventType: value?.messaging_product ?? "other",
      fingerprint: fp,
      phoneNumberId,
      wabaId,
      providerMessageId: null,
    };
  }

  private normalizePayload(obj: Record<string, any>): Record<string, any> {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.normalizePayload(i));
    const keys = Object.keys(obj).filter(
      (k) => !["entry", "changes", "received_at", "timestamp"].includes(k),
    );
    keys.sort();
    const result: Record<string, any> = {};
    for (const k of keys) {
      result[k] = this.normalizePayload(obj[k]);
    }
    return result;
  }
}
