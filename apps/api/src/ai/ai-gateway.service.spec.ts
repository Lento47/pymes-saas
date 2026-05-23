import { ConfigService } from "@nestjs/config";
import { AiGatewayService } from "./ai-gateway.service";

describe("AiGatewayService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("extracts Workers AI responses returned as result.choices", async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          CF_GATEWAY_ACCOUNT_ID: "account",
          CF_GATEWAY_ID: "gateway",
          CF_GATEWAY_TOKEN: "token",
          SYSTEM_AI_MODEL: "workers-ai/@cf/moonshotai/kimi-k2.6",
        };
        return values[key];
      }),
    } as unknown as ConfigService;
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
});
