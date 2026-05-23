import { ConfigService } from "@nestjs/config";
import { CloudflareAiService } from "./cloudflare-ai.service";

describe("CloudflareAiService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeService(chatUrl: string, model?: string) {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | undefined> = {
          CLOUDFLARE_AI_TOKEN: "token",
          CLOUDFLARE_AI_SEARCH_URL: "https://example.com/search",
          CLOUDFLARE_AI_CHAT_URL: chatUrl,
          CLOUDFLARE_AI_MODEL: model,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    return new CloudflareAiService(config);
  }

  it("omits model for Workers AI run endpoints that encode the model in the URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ result: { response: "ok" } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/run/@cf/meta/llama-3.1-8b-instruct",
    );

    await service.chatCompletion([{ role: "user", content: "hola" }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      messages: [{ role: "user", content: "hola" }],
      max_tokens: 1024,
      temperature: 0.3,
    });
    expect(body.model).toBeUndefined();
  });

  it("replaces the Workers AI run endpoint model when an override is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          choices: [{ message: { content: "ok from kimi" } }],
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/run/@cf/meta/llama-3.1-8b-instruct",
    );

    const reply = await service.chatCompletion(
      [{ role: "user", content: "hola" }],
      { model: "@cf/moonshotai/kimi-k2.6" },
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/run/@cf/moonshotai/kimi-k2.6",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBeUndefined();
    expect(reply).toBe("ok from kimi");
  });

  it("includes model for OpenAI-compatible Cloudflare chat endpoints", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "ok" } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions",
      "@cf/openai/gpt-oss-20b",
    );

    await service.chatCompletion([{ role: "user", content: "hola" }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("@cf/openai/gpt-oss-20b");
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
  });

  it("returns Workers AI usage from result.usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          choices: [{ message: { content: "respuesta" } }],
          usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/run/@cf/meta/llama-3.1-8b-instruct",
    );

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result).toMatchObject({
      text: "respuesta",
      prompt_tokens: 4,
      completion_tokens: 6,
      total_tokens: 10,
      estimated: false,
      provider: "workers-ai",
      model: "@cf/meta/llama-3.1-8b-instruct",
    });
  });

  it("estimates usage when the provider does not return token usage", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "respuesta larga" } }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService(
      "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions",
      "@cf/openai/gpt-oss-20b",
    );

    const result = await service.chatCompletionWithUsage([{ role: "user", content: "hola" }]);

    expect(result.text).toBe("respuesta larga");
    expect(result.total_tokens).toBeGreaterThan(0);
    expect(result.estimated).toBe(true);
    expect(result.provider).toBe("cloudflare-openai-compatible");
  });
});
