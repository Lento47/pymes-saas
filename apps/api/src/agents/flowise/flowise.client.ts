import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  FlowisePredictRequest,
  FlowisePredictResponse,
  FlowiseChatflowResponse,
  FlowiseToolDef,
  FlowiseToolResponse,
  FlowiseCredentialDef,
  FlowiseCredentialResponse,
} from "./flowise.types";

@Injectable()
export class FlowiseClient {
  private readonly logger = new Logger(FlowiseClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;
  private readonly credentialCache = new Map<string, string>(); // name → Flowise credential ID

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

  // ── AgentFlow v2 node builders ─────────────────────────────────────────────

  static buildStartNode() {
    return {
      id: "startAgentflow_0",
      type: "agentFlow",
      position: { x: 100, y: 100 },
      data: {
        id: "startAgentflow_0",
        label: "Start",
        version: 1.1,
        name: "startAgentflow",
        type: "Start",
        color: "#7EE787",
        hideInput: true,
        baseClasses: ["Start"],
        category: "Agent Flows",
        description: "Starting point of the agentflow",
        inputParams: [],
        inputAnchors: [],
        inputs: {
          startInputType: "chatInput",
          startEphemeralMemory: "",
          // Declare flow state key so agent can write output and directReply can read it
          startState: JSON.stringify([{ key: "agentResponse", value: "" }]),
          startPersistState: "",
        },
        outputAnchors: [
          { id: "startAgentflow_0-output-startAgentflow", label: "Start", name: "startAgentflow" },
        ],
        outputs: {},
        selected: false,
      },
      width: 103,
      height: 66,
    };
  }

  static buildAgentNode(opts: {
    id?: string;
    label?: string;
    modelName: string;
    temperature?: number;
    streaming?: boolean;
    basepath?: string;
    credentialId?: string;
    systemMessages?: Array<{ role: string; content: string }>;
    tools?: Array<{ agentSelectedTool: string; agentSelectedToolRequiresHumanInput?: boolean }>;
    enableMemory?: boolean;
  }) {
    const id = opts.id ?? "agentAgentflow_0";
    const agentModelConfig: Record<string, unknown> = {
      credential: opts.credentialId ?? "",
      modelName: opts.modelName,
      temperature: opts.temperature ?? 0.3,
      streaming: opts.streaming !== false,
      maxTokens: "",
      agentModel: "chatOpenAI",
    };
    if (opts.basepath) agentModelConfig.basepath = opts.basepath;

    return {
      id,
      type: "agentFlow",
      position: { x: 280, y: 83.5 },
      data: {
        id,
        label: opts.label ?? "Agent 0",
        version: 1,
        name: "agentAgentflow",
        type: "Agent",
        color: "#4DD0E1",
        baseClasses: ["Agent"],
        category: "Agent Flows",
        description: "Dynamically choose and utilize tools during runtime, enabling multi-step reasoning",
        // Flowise credential resolver reads data.credential at this level
        credential: opts.credentialId ?? "",
        inputParams: [],
        inputAnchors: [],
        inputs: {
          agentModel: "chatOpenAI",
          agentMessages: opts.systemMessages ?? [],
          agentTools: opts.tools ?? [],
          agentKnowledgeDocumentStores: [],
          agentKnowledgeVSEmbeddings: "",
          agentEnableMemory: opts.enableMemory !== false,
          agentMemoryType: "allMessages",
          agentMemoryWindowSize: "",
          agentMemoryMaxTokenLimit: "",
          agentUserMessage: "",
          agentReturnResponseAs: "userMessage",
          // Write agent output to flow state so directReply can reference it
          agentUpdateState: JSON.stringify([{ key: "agentResponse", value: `{{ ${id}.output }}` }]),
          agentModelConfig,
        },
        outputAnchors: [
          { id: `${id}-output-agentAgentflow`, label: "Agent", name: "agentAgentflow" },
        ],
        outputs: {},
        selected: false,
      },
      width: 176,
      height: 100,
    };
  }

  static buildDirectReplyNode(sourceNodeId: string) {
    return {
      id: "directReplyAgentflow_0",
      type: "agentFlow",
      position: { x: 540, y: 100 },
      data: {
        id: "directReplyAgentflow_0",
        label: "Direct Reply 0",
        version: 1,
        name: "directReplyAgentflow",
        type: "DirectReply",
        color: "#4DDBBB",
        hideOutput: true,
        baseClasses: ["DirectReply"],
        category: "Agent Flows",
        description: "Directly reply to the user with a message",
        inputParams: [],
        inputAnchors: [],
        inputs: {
          // Reference agent output via flow state — documented {{ $flow.state.key }} pattern
          directReplyMessage: "{{ $flow.state.agentResponse }}",
        },
        outputAnchors: [],
        outputs: {},
        selected: false,
      },
      width: 171,
      height: 66,
    };
  }

  static buildEdge(
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
    sourceColor = "#7EE787",
    targetColor = "#4DD0E1",
  ) {
    return {
      source,
      sourceHandle,
      target,
      targetHandle,
      data: { sourceColor, targetColor, isHumanInput: false },
      type: "agentFlow",
      id: `${source}-${sourceHandle}-${target}-${targetHandle}`,
    };
  }

  // ── Flow builders ──────────────────────────────────────────────────────────

  private buildFlowData(
    modelName: string,
    systemMessage?: string,
    basepath?: string,
    credentialId?: string,
  ): string {
    const agentId = "agentAgentflow_0";
    const messages = systemMessage ? [{ role: "system", content: systemMessage }] : [];

    const start = FlowiseClient.buildStartNode();
    const agent = FlowiseClient.buildAgentNode({
      id: agentId,
      modelName,
      basepath,
      credentialId,
      systemMessages: messages,
    });
    const reply = FlowiseClient.buildDirectReplyNode(agentId);

    const edges = [
      FlowiseClient.buildEdge(
        "startAgentflow_0",
        "startAgentflow_0-output-startAgentflow",
        agentId,
        agentId,
        "#7EE787",
        "#4DD0E1",
      ),
      FlowiseClient.buildEdge(
        agentId,
        `${agentId}-output-agentAgentflow`,
        "directReplyAgentflow_0",
        "directReplyAgentflow_0",
        "#4DD0E1",
        "#4DDBBB",
      ),
    ];

    return JSON.stringify({ nodes: [start, agent, reply], edges });
  }

  buildSupportFlowData(opts: {
    modelName: string;
    systemPrompt: string;
    toolIds: string[];
    basepath?: string;
    temperature?: number;
    credentialId?: string;
  }): string {
    const agentId = "agentAgentflow_0";
    const tools = opts.toolIds.map((id) => ({
      agentSelectedTool: id,
      agentSelectedToolRequiresHumanInput: false,
    }));

    const start = FlowiseClient.buildStartNode();
    const agent = FlowiseClient.buildAgentNode({
      id: agentId,
      modelName: opts.modelName,
      temperature: opts.temperature,
      basepath: opts.basepath,
      credentialId: opts.credentialId,
      systemMessages: [{ role: "system", content: opts.systemPrompt }],
      tools,
    });
    const reply = FlowiseClient.buildDirectReplyNode(agentId);

    const edges = [
      FlowiseClient.buildEdge(
        "startAgentflow_0",
        "startAgentflow_0-output-startAgentflow",
        agentId,
        agentId,
        "#7EE787",
        "#4DD0E1",
      ),
      FlowiseClient.buildEdge(
        agentId,
        `${agentId}-output-agentAgentflow`,
        "directReplyAgentflow_0",
        "directReplyAgentflow_0",
        "#4DD0E1",
        "#4DDBBB",
      ),
    ];

    return JSON.stringify({ nodes: [start, agent, reply], edges });
  }

  // ── Chatflow CRUD ──────────────────────────────────────────────────────────

  async createChatflow(name: string, systemMessage?: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows`;
    const model = this.config.get<string>("FLOWISE_DEFAULT_MODEL") ?? "deepseek-v4-flash";
    const basepath = this.config.get<string>("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com";
    // chatOpenAI node requires an openAIApi-type credential.
    // FLOWISE_DEFAULT_API_KEY may be unset, so fall back to GATEWAY_KEY_DEEPSEEK
    // (same key used by FlowiseSetupService to provision support agents).
    const apiKey =
      this.config.get<string>("FLOWISE_DEFAULT_API_KEY") ||
      this.config.get<string>("GATEWAY_KEY_DEEPSEEK") ||
      "";

    // Only bind a credential when we actually have a non-empty API key.
    // Creating a credential with an empty key produces a garbage entry in Flowise
    // that causes "Missing credentials" at runtime (ChatOpenAI rejects falsy keys).
    let credentialId: string | undefined;
    if (apiKey) {
      try {
        credentialId = await this.getOrCreateCredential("PymesHub DeepSeek", apiKey);
      } catch {
        // non-fatal — chatflow will be created but may fail at runtime
      }
    }

    const body = {
      name,
      flowData: this.buildFlowData(model, systemMessage, basepath, credentialId),
      deployed: true,
      isPublic: false,
      type: "AGENTFLOW",
    };

    return this._postChatflow(url, body);
  }

  async createChatflowWithData(name: string, flowDataJson: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows`;
    const body = { name, flowData: flowDataJson, deployed: true, isPublic: false, type: "AGENTFLOW" };
    return this._postChatflow(url, body);
  }

  async listChatflows(): Promise<Array<{ id: string; name: string }>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/chatflows?type=AGENTFLOW`;
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json", ...this.authHeaders } });
      if (!res.ok) return [];
      const data = (await res.json()) as any[];
      return data.map((c: any) => ({ id: c.id as string, name: c.name as string }));
    } catch {
      return [];
    }
  }

  // ── Tool CRUD ──────────────────────────────────────────────────────────────

  async listTools(): Promise<Array<{ id: string; name: string }>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/tools`;
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json", ...this.authHeaders } });
      if (!res.ok) return [];
      const data = (await res.json()) as any[];
      return data.map((t: any) => ({ id: t.id as string, name: t.name as string }));
    } catch {
      return [];
    }
  }

  async createTool(tool: FlowiseToolDef): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/tools`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const body = { ...tool, color: tool.color ?? "#4DD0E1" };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Flowise tool creation failed: ${res.status} ${text}`);
      }
      const data = (await res.json()) as FlowiseToolResponse;
      this.logger.log(`Tool created in Flowise: ${data.id} (${tool.name})`);
      return data.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FlowiseClient.createTool failed for "${tool.name}": ${msg}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Credential CRUD ────────────────────────────────────────────────────────

  async listCredentials(): Promise<FlowiseCredentialResponse[]> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/credentials`;
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json", ...this.authHeaders } });
      if (!res.ok) return [];
      return (await res.json()) as FlowiseCredentialResponse[];
    } catch {
      return [];
    }
  }

  async createCredential(def: FlowiseCredentialDef): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/credentials`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders },
        body: JSON.stringify(def),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Flowise credential creation failed: ${res.status} ${text}`);
      }
      const data = (await res.json()) as FlowiseCredentialResponse;
      this.logger.log(`Credential created in Flowise: ${data.id} (${def.name})`);
      return data.id;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Overwrite the stored secret on an existing credential (same ID).
   * Used to refresh a stale/empty key, or one encrypted under a previous
   * FLOWISE_SECRETKEY_OVERWRITE, without changing the ID — so any flow that
   * already references this credential is healed in place.
   */
  async updateCredential(id: string, def: FlowiseCredentialDef): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/credentials/${id}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders },
        body: JSON.stringify(def),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Flowise credential update failed: ${res.status} ${text}`);
      }
      this.logger.log(`Credential refreshed in Flowise: ${id} (${def.name})`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Clear the in-process credential ID cache (call when Flowise may have been reset). */
  clearCredentialCache(): void {
    this.credentialCache.clear();
  }

  /**
   * Find an existing credential by name or create it.
   * Always queries Flowise to avoid returning stale IDs after a Flowise reset.
   * The cache is still written so multiple calls within the same flow-creation
   * path stay fast, but we never blindly trust it across requests.
   */
  async getOrCreateCredential(name: string, apiKey: string): Promise<string> {
    const existing = await this.listCredentials();
    const found = existing.find((c) => c.name === name);
    if (found) {
      // Refresh the stored key in place. The credential may have been created
      // earlier with an empty/stale key, or encrypted under a previous
      // FLOWISE_SECRETKEY_OVERWRITE (un-decryptable → "Missing credentials").
      // Reusing the same ID heals every flow that already references it.
      try {
        await this.updateCredential(found.id, {
          credentialName: "openAIApi",
          name,
          plainDataObj: { openAIApiKey: apiKey },
        });
      } catch {
        // non-fatal — fall back to the existing credential as-is
      }
      this.credentialCache.set(name, found.id);
      return found.id;
    }

    const id = await this.createCredential({
      credentialName: "openAIApi",
      name,
      plainDataObj: { openAIApiKey: apiKey },
    });
    this.credentialCache.set(name, id);
    return id;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

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
        throw new Error(`Flowise agentflow creation failed: ${res.status} ${text}`);
      }
      const data = (await res.json()) as FlowiseChatflowResponse;
      this.logger.log(`AgentFlow created in Flowise: ${data.id} (${body.name})`);
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
        headers: { "Content-Type": "application/json", ...this.authHeaders },
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
