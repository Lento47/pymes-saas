import { ConfigService } from "@nestjs/config";
import { AiGatewayService } from "./ai-gateway.service";

describe("AiGatewayService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeConfig(values: Record<string, string>) {
    return {
      get: jest.fn((key: string) => {
        const defaults: Record<string, string> = {
          CF_GATEWAY_ACCOUNT_ID: "account",
          CF_GATEWAY_ID: "gateway",
          CF_GATEWAY_TOKEN: "token",
          SYSTEM_AI_MODEL: "workers-ai/@cf/moonshotai/kimi-k2.6",
        };
        return { ...defaults, ...values }[key];
      }),
    } as unknown as ConfigService;
  }

  it("extracts Workers AI responses returned as result.choices", async () => {
    const config = makeConfig({});
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          choices: [{ message: { content: "respuesta workers ai" } }],
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new AiGatewayService(config);

    const result = await service.chatCompletion([{ role: "user", content: "hola" }]);

    expect(result).toBe("respuesta workers ai");
  });

  it("extracts Workers AI token usage from result.usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          choices: [{ message: { content: "respuesta workers ai" } }],
          usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new AiGatewayService(makeConfig({}));

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result).toMatchObject({
      text: "respuesta workers ai",
      prompt_tokens: 5,
      completion_tokens: 7,
      total_tokens: 12,
      estimated: false,
      provider: "workers-ai",
      model: "@cf/moonshotai/kimi-k2.6",
    });
  });

  it("extracts OpenAI-compatible token usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "respuesta openai" } }],
        usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new AiGatewayService(makeConfig({ SYSTEM_AI_MODEL: "openai/gpt-4o-mini" }));

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result).toMatchObject({
      text: "respuesta openai",
      prompt_tokens: 9,
      completion_tokens: 4,
      total_tokens: 13,
      estimated: false,
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("extracts Anthropic input and output token usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        content: [{ text: "respuesta anthropic" }],
        usage: { input_tokens: 11, output_tokens: 3 },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new AiGatewayService(makeConfig({ SYSTEM_AI_MODEL: "anthropic/claude-3-5-haiku-latest" }));

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result).toMatchObject({
      text: "respuesta anthropic",
      prompt_tokens: 11,
      completion_tokens: 3,
      total_tokens: 14,
      estimated: false,
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
    });
  });

  it("extracts Google usageMetadata token usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: "respuesta google" }] } }],
        usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 8, totalTokenCount: 14 },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new AiGatewayService(makeConfig({ SYSTEM_AI_MODEL: "google-ai-studio/gemini-2.0-flash" }));

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result).toMatchObject({
      text: "respuesta google",
      prompt_tokens: 6,
      completion_tokens: 8,
      total_tokens: 14,
      estimated: false,
      provider: "google-ai-studio",
      model: "gemini-2.0-flash",
    });
  });
});
