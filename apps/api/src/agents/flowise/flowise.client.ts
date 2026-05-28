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
    // OpenAI Function Agent chatflow (no tools): ChatOpenAI + BufferMemory + OpenAIFunctionAgent.
    // Uses the same node types as the working Tier support chatflows.
    // system_instructions is injected per-call via overrideConfig.systemMessage.
    const flow = {
      nodes: [
        {
          id: "chatOpenAI_0",
          position: { x: 100, y: 100 },
          type: "customNode",
          data: {
            id: "chatOpenAI_0",
            label: "ChatOpenAI",
            name: "chatOpenAI",
            type: "BaseChatModel",
            inputs: {
              modelName: model,
              temperature: 0.3,
              maxTokens: 4096,
            },
            outputs: { output: "chatOpenAI_0-output-BaseChatModel" },
            outputAnchors: [
              { id: "chatOpenAI_0-output-BaseChatModel", label: "BaseChatModel", name: "output" },
            ],
          },
        },
        {
          id: "bufferMemory_0",
          position: { x: 100, y: 300 },
          type: "customNode",
          data: {
            id: "bufferMemory_0",
            label: "Buffer Memory",
            name: "bufferMemory",
            type: "BaseChatMemory",
            inputs: { memoryKey: "chat_history", inputKey: "input" },
            outputs: { output: "bufferMemory_0-output-BaseChatMemory" },
            outputAnchors: [
              { id: "bufferMemory_0-output-BaseChatMemory", label: "BaseChatMemory", name: "output" },
            ],
          },
        },
        {
          id: "openAIFunctionAgent_0",
          position: { x: 700, y: 300 },
          type: "customNode",
          data: {
            id: "openAIFunctionAgent_0",
            label: "OpenAI Function Agent",
            name: "openAIFunctionAgent",
            type: "AgentExecutor",
            inputs: {
              tools: [],
              memory: "bufferMemory_0",
              model: "chatOpenAI_0",
              systemMessage: "",
            },
            outputs: { output: "openAIFunctionAgent_0-output-AgentExecutor" },
            outputAnchors: [
              { id: "openAIFunctionAgent_0-output-AgentExecutor", label: "AgentExecutor", name: "output" },
            ],
          },
        },
      ],
      edges: [
        {
          id: "e-model",
          source: "chatOpenAI_0",
          sourceHandle: "chatOpenAI_0-output-BaseChatModel",
          target: "openAIFunctionAgent_0",
          targetHandle: "openAIFunctionAgent_0-input-model-BaseChatModel",
        },
        {
          id: "e-memory",
          source: "bufferMemory_0",
          sourceHandle: "bufferMemory_0-output-BaseChatMemory",
          target: "openAIFunctionAgent_0",
          targetHandle: "openAIFunctionAgent_0-input-memory-BaseChatMemory",
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
