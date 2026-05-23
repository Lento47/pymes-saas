import { Injectable, Logger } from "@nestjs/common";
import { AiGatewayService } from "./ai-gateway.service";
import type { AssistantMessage, ChatCompletionWithUsage } from "./cloudflare-ai.service";

@Injectable()
export class AiProviderBalancerService {
  private readonly logger = new Logger(AiProviderBalancerService.name);

  constructor(private readonly gateway: AiGatewayService) {}

  // providers: ordered list of "provider/model" strings. Empty = use gateway default.
  async chatCompletionWithUsage(
    messages: AssistantMessage[],
    providers: string[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<ChatCompletionWithUsage> {
    const targets = providers.length > 0 ? providers : [undefined as unknown as string];
    const errors: string[] = [];
    // Track quota-exhausted provider prefixes (e.g. "workers-ai") so we skip
    // sibling models that share the same daily/rate limit pool.
    const exhaustedPools = new Set<string>();

    for (const model of targets) {
      const prefix = model?.split("/")[0] ?? "default";

      if (exhaustedPools.has(prefix)) {
        this.logger.warn(`Skipping ${model} — quota pool "${prefix}" already exhausted`);
        errors.push(`${model}: quota pool exhausted (skipped)`);
        continue;
      }

      try {
        return await this.gateway.chatCompletionWithUsage(messages, {
          model,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
        });
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        // 429 = rate-limit / quota exhausted — mark the whole provider pool
        const isQuotaError = msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("neurons");
        if (isQuotaError) {
          exhaustedPools.add(prefix);
          this.logger.warn(`Provider pool "${prefix}" quota exhausted — skipping remaining ${prefix} models`);
        } else {
          this.logger.warn(`Provider ${model ?? "default"} failed, trying next: ${msg}`);
        }
        errors.push(`${model ?? "default"}: ${msg}`);
      }
    }
    throw new Error(`All providers failed — ${errors.join(" | ")}`);
  }

  async chatCompletion(
    messages: AssistantMessage[],
    providers: string[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const result = await this.chatCompletionWithUsage(messages, providers, options);
    return result.text;
  }
}
