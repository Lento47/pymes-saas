import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  FlowisePredictRequest,
  FlowisePredictResponse,
  FlowiseChatflowResponse,
} from "./flowise.types";

@Injectable()
export class FlowiseClient {
  private readonly logger = new Logger(FlowiseClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      config.get<string>("FLOWISE_BASE_URL") ?? "http://localhost:3001";
    this.apiKey = config.get<string>("FLOWISE_API_KEY") ?? null;
    this.timeoutMs = config.get<number>("FLOWISE_TIMEOUT_MS") ?? 30_000;
  }

  get isEnabled(): boolean {
    return this.config.get<string>("FLOWISE_ENABLED") === "true";
  }

  private get authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  private buildFlowData(model: string): string {
    // Minimal ConversationChain chatflow: ChatOpenAI + BufferMemory.
    // system_instructions is injected per-call via overrideConfig.systemMessagePrompt.
    const flow = {
      nodes: [
        {
          id: "chatOpenAI_0",
          position: { x: 922, y: 205 },
          type: "customNode",
          data: {
            id: "chatOpenAI_0",
            label: "ChatOpenAI",
            version: 6,
            name: "chatOpenAI",
            type: "ChatOpenAI",
            baseClasses: [
              "ChatOpenAI",
              "BaseChatModel",
              "BaseLanguageModel",
              "Runnable",
            ],
            category: "Chat Models",
            inputs: {
              modelName: model,
              temperature: "0.3",
              streaming: true,
              maxTokens: "",
            },
            outputs: {},
          },
          width: 300,
          height: 574,
        },
        {
          id: "bufferMemory_0",
          position: { x: 430, y: 50 },
          type: "customNode",
          data: {
            id: "bufferMemory_0",
            label: "Buffer Memory",
            version: 2,
            name: "bufferMemory",
            type: "BufferMemory",
            baseClasses: ["BufferMemory", "BaseChatMemory", "BaseMemory"],
            category: "Memory",
            inputs: {
              memoryKey: "chat_history",
              inputKey: "input",
              sessionId: "",
              sessionTimeOut: "",
            },
            outputs: {},
          },
          width: 300,
          height: 377,
        },
        {
          id: "conversationChain_0",
          position: { x: 1487, y: 350 },
          type: "customNode",
          data: {
            id: "conversationChain_0",
            label: "Conversation Chain",
            version: 3,
            name: "conversationChain",
            type: "ConversationChain",
            baseClasses: [
              "ConversationChain",
              "LLMChain",
              "BaseChain",
              "Runnable",
            ],
            category: "Chains",
            inputs: {
              model: "{{chatOpenAI_0.data.instance}}",
              memory: "{{bufferMemory_0.data.instance}}",
              // Empty by default; PymesHub injects via overrideConfig per call
              systemMessagePrompt: "",
            },
            outputs: {},
          },
          width: 300,
          height: 430,
        },
      ],
      edges: [
        {
          source: "chatOpenAI_0",
          sourceHandle:
            "chatOpenAI_0-output-chatOpenAI-ChatOpenAI|BaseChatModel|BaseLanguageModel|Runnable",
          target: "conversationChain_0",
          targetHandle: "conversationChain_0-input-model-BaseChatModel",
          type: "buttonedge",
          id: "edge-chatOpenAI-conversationChain",
        },
        {
          source: "bufferMemory_0",
          sourceHandle:
            "bufferMemory_0-output-bufferMemory-BufferMemory|BaseChatMemory|BaseMemory",
          target: "conversationChain_0",
          targetHandle: "conversationChain_0-input-memory-BaseChatMemory",
          type: "buttonedge",
          id: "edge-bufferMemory-conversationChain",
        },
      ],
    };

    return JSON.stringify(flow);
  }

  async createChatflow(name: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows`;
    const model =
      this.config.get<string>("FLOWISE_DEFAULT_MODEL") ?? "gpt-4o-mini";

    const body = {
      name,
      flowData: this.buildFlowData(model),
      deployed: true,
      isPublic: false,
      type: "CHATFLOW",
    };

    return this._postChatflow(url, body);
  }

  /** Create a chatflow using arbitrary pre-built flowData JSON (for tool-calling agents) */
  async createChatflowWithData(name: string, flowDataJson: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows`;
    const body = { name, flowData: flowDataJson, deployed: true, isPublic: false, type: "CHATFLOW" };
    return this._postChatflow(url, body);
  }

  /** List all chatflows — returns array of { id, name } */
  async listChatflows(): Promise<Array<{ id: string; name: string }>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows`;
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json", ...this.authHeaders } });
      if (!res.ok) return [];
      const data = (await res.json()) as any[];
      return data.map((c: any) => ({ id: c.id as string, name: c.name as string }));
    } catch {
      return [];
    }
  }

  private async _postChatflow(url: string, body: Record<string, any>): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Flowise chatflow creation failed: ${res.status} ${text}`);
      }
      const data = (await res.json()) as FlowiseChatflowResponse;
      this.logger.log(`Chatflow created in Flowise: ${data.id} (${body.name})`);
      return data.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FlowiseClient._postChatflow failed: ${msg}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async predict(
    chatflowId: string,
    body: FlowisePredictRequest,
  ): Promise<FlowisePredictResponse> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Flowise returned ${res.status}: ${text}`);
      }

      return res.json() as Promise<FlowisePredictResponse>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FlowiseClient.predict failed: ${msg}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
