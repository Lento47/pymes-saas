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
    for (const model of targets) {
      try {
        return await this.gateway.chatCompletionWithUsage(messages, {
          model,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
        });
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        this.logger.warn(`Provider ${model ?? "default"} failed, trying next: ${msg}`);
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
