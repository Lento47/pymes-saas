import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FlowisePredictRequest, FlowisePredictResponse } from "./flowise.types";

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

  async predict(
    chatflowId: string,
    body: FlowisePredictRequest,
  ): Promise<FlowisePredictResponse> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
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
