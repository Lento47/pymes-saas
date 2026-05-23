import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AssistantMessage } from "./cloudflare-ai.service";

// Providers using OpenAI-compatible format
const OPENAI_COMPAT_PROVIDERS = new Set([
  "openai",
  "groq",
  "mistral",
  "cohere",
  "perplexity-ai",
  "deepseek",
  "cerebras",
  "workers-ai",
  "baseten",
  "dynamic",
  "parallel",
  "grok",
  "moonshot",
]);

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  private readonly accountId: string | null;
  private readonly gatewayId: string | null;
  private readonly gatewayToken: string | null;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.accountId = config.get<string>("CF_GATEWAY_ACCOUNT_ID") ?? null;
    this.gatewayId = config.get<string>("CF_GATEWAY_ID") ?? null;
    this.gatewayToken = config.get<string>("CF_GATEWAY_TOKEN") ?? null;
    this.defaultModel =
      config.get<string>("SYSTEM_AI_MODEL") ??
      "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  }

  get isConfigured(): boolean {
    return !!(this.accountId && this.gatewayId);
  }

  async chatCompletion(
    messages: AssistantMessage[],
    options?: {
      model?: string;
      apiKey?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<string> {
    const modelStr = options?.model ?? this.defaultModel;
    const { provider, model } = this.parseModel(modelStr);
    const url = this.buildGatewayUrl(provider, model);
    const body = this.buildRequestBody(provider, model, messages, options);
    const apiKey = this.getProviderApiKey(provider, options?.apiKey);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // CF AI Gateway auth header (required for all requests through the gateway)
    if (this.gatewayToken) {
      headers["cf-aig-authorization"] = `Bearer ${this.gatewayToken}`;
    }

    if (provider === "anthropic") {
      if (apiKey) headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider !== "workers-ai") {
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    }
    // workers-ai uses only the gateway-level cf-aig-authorization (free tier, no per-provider key)

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`AI Gateway error [${provider}/${model}] ${res.status}: ${text}`);
      throw new Error(`AI Gateway request failed: ${res.status}`);
    }

    const json = (await res.json()) as any;
    return this.extractResponse(provider, json);
  }

  private parseModel(modelStr: string): { provider: string; model: string } {
    // Handle workers-ai models which use @cf/ prefix: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    const workersAiMatch = modelStr.match(/^workers-ai\/(@cf\/.+)$/);
    if (workersAiMatch) {
      return { provider: "workers-ai", model: workersAiMatch[1] };
    }

    const slashIdx = modelStr.indexOf("/");
    if (slashIdx < 0) {
      // No slash — treat as workers-ai model
      return { provider: "workers-ai", model: modelStr };
    }

    const provider = modelStr.slice(0, slashIdx);
    const model = modelStr.slice(slashIdx + 1);
    return { provider, model };
  }

  private buildGatewayUrl(provider: string, model: string): string {
    const base = `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}`;

    switch (provider) {
      case "anthropic":
        return `${base}/anthropic/v1/messages`;
      case "google-ai-studio":
        return `${base}/google-ai-studio/v1beta/models/${model}:generateContent`;
      case "workers-ai":
        return `${base}/workers-ai/run/${model}`;
      case "groq":
        return `${base}/groq/openai/chat/completions`;
      default:
        // OpenAI-compatible: openai, mistral, cohere, perplexity-ai, deepseek, cerebras, grok, etc.
        return `${base}/${provider}/chat/completions`;
    }
  }

  private buildRequestBody(
    provider: string,
    model: string,
    messages: AssistantMessage[],
    options?: { maxTokens?: number; temperature?: number },
  ): object {
    const maxTokens = options?.maxTokens ?? 1024;
    const temperature = options?.temperature ?? 0.3;

    if (provider === "anthropic") {
      const systemMsg = messages.find((m) => m.role === "system");
      const otherMsgs = messages.filter((m) => m.role !== "system");
      return {
        model,
        system: systemMsg?.content ?? "",
        messages: otherMsgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
      };
    }

    if (provider === "google-ai-studio") {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMsgs = messages.filter((m) => m.role !== "system");
      const contents = chatMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const body: Record<string, unknown> = {
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }
      return body;
    }

    if (provider === "workers-ai") {
      // Workers AI run endpoint — no model field in body
      return { messages, max_tokens: maxTokens, temperature };
    }

    // OpenAI-compatible (openai, groq, mistral, grok, deepseek, cohere, etc.)
    return { model, messages, max_tokens: maxTokens, temperature };
  }

  private extractResponse(provider: string, json: any): string {
    if (provider === "anthropic") {
      return json.content?.[0]?.text?.trim() ?? "";
    }
    if (provider === "google-ai-studio") {
      return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    }
    if (provider === "workers-ai") {
      return (
        json.result?.response?.trim() ??
        json.choices?.[0]?.message?.content?.trim() ??
        ""
      );
    }
    // OpenAI-compatible
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private getProviderApiKey(provider: string, override?: string): string | null {
    if (override) return override;
    // Env key: GATEWAY_KEY_OPENAI, GATEWAY_KEY_ANTHROPIC, GATEWAY_KEY_GOOGLE_AI_STUDIO, etc.
    const envKey = `GATEWAY_KEY_${provider.toUpperCase().replace(/-/g, "_")}`;
    return this.config.get<string>(envKey) ?? null;
  }
}
