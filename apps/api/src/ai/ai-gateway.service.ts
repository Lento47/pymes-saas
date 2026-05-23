import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AssistantMessage, ChatCompletionWithUsage } from "./cloudflare-ai.service";

// Workers AI uses its own /workers-ai/run/{model} legacy path (no external API key needed).
// Other CF-supported providers work via the /compat endpoint but require their API keys
// configured in the CF AI Gateway dashboard (or passed via Authorization header).
const COMPAT_UNSUPPORTED = new Set(["workers-ai"]);

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  private readonly accountId: string | null;
  private readonly gatewayId: string | null;
  private readonly gatewayToken: string | null;
  private readonly defaultModel: string;

  // Compat mode: single OpenAI-compatible endpoint for ALL providers
  private readonly compatUrl: string | null;
  private readonly compatToken: string | null;

  constructor(private readonly config: ConfigService) {
    this.accountId = config.get<string>("CF_GATEWAY_ACCOUNT_ID") ?? null;
    this.gatewayId = config.get<string>("CF_GATEWAY_ID") ?? null;
    this.gatewayToken = config.get<string>("CF_GATEWAY_TOKEN") ?? null;
    this.defaultModel =
      config.get<string>("SYSTEM_AI_MODEL") ??
      "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast";

    // CF_AIG_TOKEN is the single token for the /compat universal endpoint
    this.compatToken =
      config.get<string>("CF_AIG_TOKEN") ??
      config.get<string>("CF_GATEWAY_TOKEN") ??
      null;

    // Compat URL: explicit var or auto-built from account+gateway IDs
    const explicitCompat = config.get<string>("CF_GATEWAY_COMPAT_URL") ?? null;
    if (explicitCompat) {
      this.compatUrl = explicitCompat;
    } else if (this.accountId && this.gatewayId) {
      this.compatUrl = `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/compat`;
    } else {
      this.compatUrl = null;
    }

    // Auto-detect account/gateway from CLOUDFLARE_AI_CHAT_URL when explicit vars are absent
    if (!this.accountId || !this.gatewayId) {
      const chatUrl = config.get<string>("CLOUDFLARE_AI_CHAT_URL") ?? "";
      const gatewayMatch = chatUrl.match(
        /gateway\.ai\.cloudflare\.com\/v1\/([^/?#]+)\/([^/?#]+)/,
      );
      if (gatewayMatch) {
        this.accountId = this.accountId ?? gatewayMatch[1];
        this.gatewayId = this.gatewayId ?? gatewayMatch[2];
        if (!this.compatUrl) {
          this.compatUrl = `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/compat`;
        }
        if (!this.gatewayToken) {
          this.gatewayToken = config.get<string>("CLOUDFLARE_AI_TOKEN") ?? null;
        }
        if (!config.get<string>("SYSTEM_AI_MODEL")) {
          const modelMatch = chatUrl.match(/\/workers-ai\/run\/(.+)/);
          if (modelMatch) {
            const extracted = modelMatch[1].split(/[?#]/)[0];
            if (extracted) this.defaultModel = `workers-ai/${extracted}`;
          }
        }
        this.logger.log(
          `AiGateway: auto-detected account=${this.accountId} gateway=${this.gatewayId}`,
        );
      }
    }

    if (this.compatUrl && this.compatToken) {
      this.logger.log(`AiGateway: compat mode enabled → ${this.compatUrl}`);
    }
  }

  get isConfigured(): boolean {
    return !!(this.compatUrl && this.compatToken) || !!(this.accountId && this.gatewayId);
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
    const result = await this.chatCompletionWithUsage(messages, options);
    return result.text;
  }

  async chatCompletionWithUsage(
    messages: AssistantMessage[],
    options?: {
      model?: string;
      apiKey?: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<ChatCompletionWithUsage> {
    const modelStr = options?.model ?? this.defaultModel;

    // ── Compat mode (preferred): single endpoint, single token, all providers ──
    const providerPrefix = modelStr.split("/")[0];
    const useLegacy = COMPAT_UNSUPPORTED.has(providerPrefix);
    if (this.compatUrl && this.compatToken && !useLegacy) {
      const providerApiKey = options?.apiKey ?? null;
      const res = await fetch(this.compatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-aig-authorization": `Bearer ${this.compatToken}`,
          ...(providerApiKey ? { Authorization: `Bearer ${providerApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelStr,
          messages,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.3,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`AI Gateway compat error [${modelStr}] ${res.status}: ${text}`);
        throw new Error(`AI Gateway request failed: ${res.status}`);
      }

      const json = (await res.json()) as any;
      // CF AI Gateway compat endpoint returns text in different locations.
      // When the model outputs JSON, the gateway pre-parses it into json.response (object).
      // Re-serialize so parseAction downstream can extract reply_text / interactive / etc.
      const responseField = json.response;
      const text = (
        json.choices?.[0]?.message?.content?.trim() ||
        json.result?.response?.trim() ||
        json.result?.choices?.[0]?.message?.content?.trim() ||
        (typeof responseField === "string" ? responseField.trim() : "") ||
        (responseField && typeof responseField === "object" ? JSON.stringify(responseField) : "") ||
        ""
      );
      if (!text) {
        this.logger.warn(`AI Gateway compat [${modelStr}] returned empty text. Raw keys: ${Object.keys(json).join(", ")}`);
      }
      const provider = modelStr.split("/")[0] ?? "unknown";
      return this.withUsage(text, json.usage ?? json.result?.usage, { provider, model: modelStr, messages });
    }

    // ── Legacy mode: provider-specific URLs and auth headers ──
    const { provider, model } = this.parseModel(modelStr);
    const url = this.buildGatewayUrl(provider, model);
    const body = this.buildRequestBody(provider, model, messages, options);
    const apiKey = this.getProviderApiKey(provider, options?.apiKey);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.gatewayToken) {
      headers["cf-aig-authorization"] = `Bearer ${this.gatewayToken}`;
    }

    if (provider === "anthropic") {
      if (apiKey) headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider !== "workers-ai") {
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    }

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
    return this.extractResponse(provider, model, json, messages);
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

  private extractResponse(
    provider: string,
    model: string,
    json: any,
    messages: AssistantMessage[],
  ): ChatCompletionWithUsage {
    let text = "";
    let usage: any = json.usage ?? json.result?.usage;

    if (provider === "anthropic") {
      text = json.content?.[0]?.text?.trim() ?? "";
      usage = json.usage;
    } else if (provider === "google-ai-studio") {
      text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      usage = json.usageMetadata;
    } else if (provider === "workers-ai") {
      const r = json.response;
      text = (
        json.result?.response?.trim() ||
        json.result?.choices?.[0]?.message?.content?.trim() ||
        json.choices?.[0]?.message?.content?.trim() ||
        (typeof r === "string" ? r.trim() : "") ||
        (r && typeof r === "object" ? JSON.stringify(r) : "") ||
        ""
      );
      usage = json.result?.usage ?? json.usage;
    } else {
      const r = json.response;
      text = (
        json.choices?.[0]?.message?.content?.trim() ||
        (typeof r === "string" ? r.trim() : "") ||
        (r && typeof r === "object" ? JSON.stringify(r) : "") ||
        ""
      );
    }

    if (!text) {
      this.logger.warn(`AI Gateway legacy [${provider}/${model}] empty text. Raw keys: ${Object.keys(json).join(", ")}`);
    }
    return this.withUsage(text, usage, { provider, model, messages });
  }

  private getProviderApiKey(provider: string, override?: string): string | null {
    if (override) return override;
    // Env key: GATEWAY_KEY_OPENAI, GATEWAY_KEY_ANTHROPIC, GATEWAY_KEY_GOOGLE_AI_STUDIO, etc.
    const envKey = `GATEWAY_KEY_${provider.toUpperCase().replace(/-/g, "_")}`;
    return this.config.get<string>(envKey) ?? null;
  }

  private withUsage(
    text: string,
    usage: any,
    context: { provider: string; model: string; messages: AssistantMessage[] },
  ): ChatCompletionWithUsage {
    const prompt = Number(
      usage?.prompt_tokens ??
        usage?.input_tokens ??
        usage?.promptTokenCount,
    );
    const completion = Number(
      usage?.completion_tokens ??
        usage?.output_tokens ??
        usage?.candidatesTokenCount,
    );
    const explicitTotal = Number(usage?.total_tokens ?? usage?.totalTokenCount);
    const total =
      Number.isFinite(explicitTotal) && explicitTotal > 0
        ? explicitTotal
        : Number.isFinite(prompt) && prompt >= 0 && Number.isFinite(completion) && completion >= 0
          ? prompt + completion
          : NaN;

    if (Number.isFinite(total) && total > 0) {
      const promptTokens = Number.isFinite(prompt) && prompt >= 0 ? prompt : 0;
      const completionTokens =
        Number.isFinite(completion) && completion >= 0
          ? completion
          : Math.max(0, total - promptTokens);
      return {
        text,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: total,
        estimated: false,
        provider: context.provider,
        model: context.model,
      };
    }

    const promptTokens = estimateGatewayTokens(context.messages.map((m) => m.content).join("\n"));
    const completionTokens = estimateGatewayTokens(text);
    return {
      text,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: Math.max(1, promptTokens + completionTokens),
      estimated: true,
      provider: context.provider,
      model: context.model,
    };
  }
}

function estimateGatewayTokens(text: string | null | undefined): number {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 3));
}
