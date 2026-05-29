import { Injectable, Logger } from "@nestjs/common";
import { AiGatewayService } from "../ai-gateway.service";
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

const LLM_TIMEOUT_MS = 3000;

@Injectable()
export class LlmIntentClassifierService {
  private readonly logger = new Logger(LlmIntentClassifierService.name);

  constructor(private readonly aiGateway: AiGatewayService) {}

  async classify(
    text: string,
    _context: ConversationContext,
  ): Promise<{ intent: Intent; confidence: "high" | "medium" | "low"; reasoning: string }> {
    const fallback = {
      intent: "unknown" as Intent,
      confidence: "low" as const,
      reasoning: "llm_unavailable",
    };

    try {
      const messages: AssistantMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Message: "${text.slice(0, 500)}"` },
      ];

      const raw = await Promise.race([
        this.aiGateway.chatCompletion(messages, { maxTokens: 120, temperature: 0 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), LLM_TIMEOUT_MS),
        ),
      ]);

      // Strip markdown code fences if present
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

      return { intent, confidence, reasoning: String(parsed.reasoning ?? "") };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "timeout") {
        this.logger.warn(`[llm-classifier] failed: ${msg}`);
      }
      return fallback;
    }
  }
}
