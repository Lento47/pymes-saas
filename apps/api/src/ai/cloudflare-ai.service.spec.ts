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
});
