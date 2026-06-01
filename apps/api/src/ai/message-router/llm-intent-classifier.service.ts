import { Injectable, Logger } from "@nestjs/common";
import { AiGatewayService } from "../ai-gateway.service";
import { AiTokenMeteringService } from "../../ai-tokens/ai-token-metering.service";
import type { AssistantMessage } from "../cloudflare-ai.service";
import { ConversationContext, Intent } from "./types";

const VALID_INTENTS: Intent[] = [
  "greeting",
  "product_question",
  "price_question",
  "invoice_request",
  "payment_status",
  "complaint",
  "technical_support",
  "sales_lead",
  "human_request",
  "opt_out",
  "spam",
  "unknown",
];

const SYSTEM_PROMPT = `Classify the intent of the following customer message into exactly one of these categories:
${VALID_INTENTS.join(", ")}

Definitions:
- opt_out: customer explicitly wants to stop receiving messages ("stop", "no me escriban", "baja")
- human_request: customer explicitly wants to talk to a human agent
- spam: unsolicited promotional or fraudulent content
- greeting: simple hello with no other intent (short, 1-6 words)
- complaint: expressing dissatisfaction, reporting a problem, or requesting a refund
- invoice_request: asking for invoice, receipt, or fiscal document (factura, comprobante)
- payment_status: asking about a charge, payment balance, or confirmation of payment
- technical_support: asking for help with a technical issue or how to use something
- sales_lead: interested in buying, requesting a quote or proposal
- price_question: asking about cost, price, or rates
- product_question: asking about a specific product or service details
- unknown: cannot determine intent with reasonable confidence

Return ONLY valid JSON: {"intent": "<category>", "confidence": "high"|"medium"|"low", "reasoning": "<brief>"}`;

/** Tokens used by the classification system prompt + response. */
const CLASSIFY_SYSTEM_TOKENS = Math.ceil(SYSTEM_PROMPT.length / 3);
/** Increased from 120 to 500 — MiMo thinking models (v2.5-pro) spend tokens on
 *  reasoning_content before producing the final answer. 120 tokens was enough
 *  for non-reasoning models but left MiMo with empty content. */
const CLASSIFY_MAX_COMPLETION = 500;
const LLM_TIMEOUT_MS = 3000;

@Injectable()
export class LlmIntentClassifierService {
  private readonly logger = new Logger(LlmIntentClassifierService.name);

  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly aiTokens: AiTokenMeteringService,
  ) {}

  async classify(
    text: string,
    context: ConversationContext,
    msgContext?: { conversationId?: string; messageId?: string },
  ): Promise<{
    intent: Intent;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    tokensConsumed: number;
  }> {
    const fallback = {
      intent: "unknown" as Intent,
      confidence: "low" as const,
      reasoning: "llm_unavailable",
      tokensConsumed: 0,
    };

    const messages: AssistantMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Message: "${text.slice(0, 500)}"` },
    ];

    const estimatedTokens =
      CLASSIFY_SYSTEM_TOKENS +
      Math.ceil(text.slice(0, 500).length / 3) +
      CLASSIFY_MAX_COMPLETION;

    // Reserve tokens before the AI call (soft-block if balance is 0)
    const reservation = await this.aiTokens
      .reserveTokens(context.workspaceId, estimatedTokens, {
        description: "Clasificación de intención (Router IA)",
        conversationId: msgContext?.conversationId ?? null,
        messageId: msgContext?.messageId ?? null,
        metadata: { source: "llm-intent-classifier" },
      })
      .catch(() => null);

    // No balance → skip LLM, fall back to "unknown"
    if (reservation && !reservation.success) {
      this.logger.debug(
        `[llm-classifier] insufficient tokens workspace=${context.workspaceId} — skipping LLM`,
      );
      if (reservation.reservationId) {
        await this.aiTokens
          .releaseReservation(context.workspaceId, reservation.reservationId)
          .catch(() => undefined);
      }
      return fallback;
    }

    let actualTokens = 0;
    let reservationId = reservation?.reservationId ?? null;

    try {
      const raw = await Promise.race([
        this.aiGateway.chatCompletion(messages, {
          maxTokens: CLASSIFY_MAX_COMPLETION,
          temperature: 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), LLM_TIMEOUT_MS),
        ),
      ]);

      // Consume reservation with actual usage estimate
      actualTokens = CLASSIFY_SYSTEM_TOKENS + Math.ceil(text.slice(0, 500).length / 3) + Math.ceil(raw.length / 3);
      if (reservationId) {
        await this.aiTokens
          .consumeReservation(
            context.workspaceId,
            reservationId,
            { prompt_tokens: actualTokens - Math.ceil(raw.length / 3), completion_tokens: Math.ceil(raw.length / 3), total_tokens: actualTokens, estimated: true, provider: "ai-gateway", model: "router-classifier" },
            {
              conversationId: msgContext?.conversationId ?? null,
              messageId: msgContext?.messageId ?? null,
              description: "Clasificación de intención (Router IA)",
              metadata: { source: "llm-intent-classifier" },
            },
          )
          .catch(() => undefined);
        reservationId = null;
      }

      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned) as {
        intent?: unknown;
        confidence?: unknown;
        reasoning?: unknown;
      };

      const intent = VALID_INTENTS.includes(parsed.intent as Intent)
        ? (parsed.intent as Intent)
        : "unknown";

      const confidence = (["high", "medium", "low"] as const).includes(
        parsed.confidence as "high" | "medium" | "low",
      )
        ? (parsed.confidence as "high" | "medium" | "low")
        : "low";

      return { intent, confidence, reasoning: String(parsed.reasoning ?? ""), tokensConsumed: actualTokens };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "timeout") {
        this.logger.warn(`[llm-classifier] failed: ${msg}`);
      }
      // Release reservation on failure/timeout
      if (reservationId) {
        await this.aiTokens
          .releaseReservation(context.workspaceId, reservationId)
          .catch(() => undefined);
      }
      return fallback;
    }
  }
}
