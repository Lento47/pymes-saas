import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiGatewayService } from "./ai-gateway.service";

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssistantResponse {
  answer: string;
  sources: { title: string; url?: string; snippet?: string }[];
}

export interface CloudflareChatOptions {
  model?: string | null;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated: boolean;
  provider: string;
  model: string;
}

export interface ChatCompletionWithUsage extends ChatTokenUsage {
  text: string;
}

@Injectable()
export class CloudflareAiService {
  private readonly logger = new Logger(CloudflareAiService.name);

  private readonly token: string | null;
  private readonly searchUrl: string | null;
  private readonly chatUrl: string | null;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly aiGateway?: AiGatewayService,
  ) {
    this.token = config.get<string>("CLOUDFLARE_AI_TOKEN") ?? null;
    this.searchUrl = config.get<string>("CLOUDFLARE_AI_SEARCH_URL") ?? null;
    this.chatUrl = config.get<string>("CLOUDFLARE_AI_CHAT_URL") ?? null;
    this.model = config.get<string>("CLOUDFLARE_AI_MODEL") ?? "@cf/meta/llama-3.1-8b-instruct";
  }

  get isConfigured(): boolean {
    return !!(this.token && this.searchUrl && this.chatUrl);
  }

  async ask(
    question: string,
    history: AssistantMessage[] = [],
    extraContext?: string,
  ): Promise<AssistantResponse> {
    if (!this.isConfigured) {
      throw new Error("Cloudflare AI is not configured");
    }

    // 1. Retrieve relevant context via RAG search
    const sources = await this.search(question);

    // 2. Build context string from search results
    const ragContext = sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet ?? ""}`)
      .join("\n\n");

    // 3. Build enriched context
    const contextParts: string[] = [];
    if (ragContext) contextParts.push(`Relevant context from our knowledge base:\n\n${ragContext}`);
    if (extraContext) contextParts.push(`Additional context:\n\n${extraContext}`);
    const fullContext = contextParts.join("\n\n---\n\n");

    // 3. Call chat completions with context injected
    const systemPrompt = `You are PymeHub Assistant, a helpful AI for PymeHub — a B2B SaaS platform designed for SMBs (small and medium-sized businesses) in Latin America. PymeHub provides unified inbox, CRM, invoicing, task management, document storage, automations, and AI-powered insights.

Answer questions about PymeHub's features, pricing, and how to use the platform. Be concise, friendly, and professional. If you don't know something, say so.

${fullContext ? `Relevant context from our knowledge base:\n\n${fullContext}` : ""}`;

    const messages: AssistantMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6), // keep last 3 turns
      { role: "user", content: question },
    ];

    const answer = await this.chatCompletion(messages);

    return { answer, sources };
  }

  private async search(
    query: string,
  ): Promise<{ title: string; url?: string; snippet?: string }[]> {
    try {
      const res = await fetch(this.searchUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query, max_results: 5 }),
      });

      if (!res.ok) {
        this.logger.warn(`Cloudflare AI search returned ${res.status}`);
        return [];
      }

      const data = (await res.json()) as Record<string, unknown>;

      // Cloudflare AI Search response shape: { results: [{ title, url, content }] }
      const results: Record<string, unknown>[] = (data.results ?? data.data ?? []) as Record<
        string,
        unknown
      >[];
      return results.map((r) => ({
        title: String(r.title ?? r.name ?? "Source"),
        url: r.url as string | undefined,
        snippet: (r.content ?? r.snippet ?? r.text) as string | undefined,
      }));
    } catch (err) {
      this.logger.warn("Cloudflare AI search failed", err);
      return [];
    }
  }

  async chatCompletion(
    messages: AssistantMessage[],
    options: CloudflareChatOptions = {},
  ): Promise<string> {
    const result = await this.chatCompletionWithUsage(messages, options);
    return result.text;
  }

  async chatCompletionWithUsage(
    messages: AssistantMessage[],
    options: CloudflareChatOptions = {},
  ): Promise<ChatCompletionWithUsage> {
    // Delegate to AiGatewayService when available — supports all CF Gateway providers
    if (this.aiGateway?.isConfigured) {
      const modelOverride = this.normalizeWorkersAiModel(options.model);
      const model = modelOverride ? `workers-ai/${modelOverride}` : undefined;
      return this.aiGateway.chatCompletionWithUsage(messages, {
        model,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
    }

    // Fallback: direct Workers AI call via legacy CLOUDFLARE_AI_CHAT_URL
    if (!this.chatUrl) throw new Error("Cloudflare AI is not configured");

    const isWorkersAiRunEndpoint = this.chatUrl.includes("/ai/run/");
    const modelOverride = this.normalizeWorkersAiModel(options.model);
    const maxTokens = options.maxTokens ?? 500;
    const temperature = options.temperature ?? 0.3;
    const chatUrl =
      isWorkersAiRunEndpoint && modelOverride
        ? this.withWorkersAiRunModel(this.chatUrl, modelOverride)
        : this.chatUrl;
    const resolvedModel = isWorkersAiRunEndpoint
      ? modelOverride ?? this.extractWorkersAiRunModel(chatUrl) ?? this.model
      : modelOverride ?? this.model;
    const body = isWorkersAiRunEndpoint
      ? { messages, max_tokens: maxTokens, temperature }
      : { model: resolvedModel, messages, max_tokens: maxTokens, temperature };

    const llmController = new AbortController();
    const llmTimer = setTimeout(() => llmController.abort(), 15_000);

    let res: Response;
    try {
      res = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
        signal: llmController.signal,
      });
    } finally {
      clearTimeout(llmTimer);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare AI chat failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as any;
    const text = (
      data.choices?.[0]?.message?.content ??
      data.result?.choices?.[0]?.message?.content ??
      data.result?.response ??
      ""
    );
    return this.withUsage(text.trim(), data.usage ?? data.result?.usage, {
      provider: isWorkersAiRunEndpoint ? "workers-ai" : "cloudflare-openai-compatible",
      model: resolvedModel,
      messages,
    });
  }

  private normalizeWorkersAiModel(model: string | null | undefined): string | null {
    if (typeof model !== "string") return null;
    const trimmed = model.trim();
    if (!trimmed || !trimmed.startsWith("@cf/") || /\s/.test(trimmed)) return null;
    return trimmed.slice(0, 160);
  }

  private withWorkersAiRunModel(chatUrl: string, model: string): string {
    const marker = "/ai/run/";
    const markerIndex = chatUrl.indexOf(marker);
    if (markerIndex < 0) return chatUrl;

    return chatUrl.slice(0, markerIndex + marker.length) + model;
  }

  private extractWorkersAiRunModel(chatUrl: string): string | null {
    const marker = "/ai/run/";
    const markerIndex = chatUrl.indexOf(marker);
    if (markerIndex < 0) return null;
    return chatUrl.slice(markerIndex + marker.length).split(/[?#]/)[0] || null;
  }

  private withUsage(
    text: string,
    usage: any,
    context: { provider: string; model: string; messages: AssistantMessage[] },
  ): ChatCompletionWithUsage {
    const prompt = Number(usage?.prompt_tokens ?? usage?.input_tokens);
    const completion = Number(usage?.completion_tokens ?? usage?.output_tokens);
    const explicitTotal = Number(usage?.total_tokens);
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

    const promptTokens = estimateTextTokens(context.messages.map((m) => m.content).join("\n"));
    const completionTokens = estimateTextTokens(text);
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

export function estimateTextTokens(text: string | null | undefined): number {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 3));
}
