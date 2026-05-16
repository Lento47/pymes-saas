import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantResponse {
  answer: string;
  sources: { title: string; url?: string; snippet?: string }[];
}

@Injectable()
export class CloudflareAiService {
  private readonly logger = new Logger(CloudflareAiService.name);

  private readonly token: string | null;
  private readonly searchUrl: string | null;
  private readonly chatUrl: string | null;

  constructor(private readonly config: ConfigService) {
    this.token = config.get<string>('CLOUDFLARE_AI_TOKEN') ?? null;
    this.searchUrl = config.get<string>('CLOUDFLARE_AI_SEARCH_URL') ?? null;
    this.chatUrl = config.get<string>('CLOUDFLARE_AI_CHAT_URL') ?? null;
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
      throw new Error('Cloudflare AI is not configured');
    }

    // 1. Retrieve relevant context via RAG search
    const sources = await this.search(question);

    // 2. Build context string from search results
    const ragContext = sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet ?? ''}`)
      .join('\n\n');

    // 3. Build enriched context
    const contextParts: string[] = [];
    if (ragContext) contextParts.push(`Relevant context from our knowledge base:\n\n${ragContext}`);
    if (extraContext) contextParts.push(`Additional context:\n\n${extraContext}`);
    const fullContext = contextParts.join('\n\n---\n\n');

    // 3. Call chat completions with context injected
    const systemPrompt = `You are PymeHub Assistant, a helpful AI for PymeHub — a B2B SaaS platform designed for SMBs (small and medium-sized businesses) in Latin America. PymeHub provides unified inbox, CRM, invoicing, task management, document storage, automations, and AI-powered insights.

Answer questions about PymeHub's features, pricing, and how to use the platform. Be concise, friendly, and professional. If you don't know something, say so.

${fullContext ? `Relevant context from our knowledge base:\n\n${fullContext}` : ''}`;

    const messages: AssistantMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // keep last 3 turns
      { role: 'user', content: question },
    ];

    const answer = await this.chatCompletion(messages);

    return { answer, sources };
  }

  private async search(query: string): Promise<{ title: string; url?: string; snippet?: string }[]> {
    try {
      const res = await fetch(this.searchUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query, max_results: 5 }),
      });

      if (!res.ok) {
        this.logger.warn(`Cloudflare AI search returned ${res.status}`);
        return [];
      }

      const data = await res.json() as any;

      // Cloudflare AI Search response shape: { results: [{ title, url, content }] }
      const results: any[] = data.results ?? data.data ?? [];
      return results.map((r: any) => ({
        title: r.title ?? r.name ?? 'Source',
        url: r.url,
        snippet: r.content ?? r.snippet ?? r.text,
      }));
    } catch (err) {
      this.logger.warn('Cloudflare AI search failed', err);
      return [];
    }
  }

  private async chatCompletion(messages: AssistantMessage[]): Promise<string> {
    const res = await fetch(this.chatUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: '@cf/meta/llama-3.1-8b-instruct',
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare AI chat failed: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    // OpenAI-compatible response shape
    return data.choices?.[0]?.message?.content ?? data.result?.response ?? '';
  }
}
