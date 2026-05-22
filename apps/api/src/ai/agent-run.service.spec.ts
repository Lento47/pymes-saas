jest.mock("../common/prisma/prisma.service", () => ({
  PrismaService: class PrismaService {},
}));

jest.mock("./cloudflare-ai.service", () => ({
  CloudflareAiService: class CloudflareAiService {},
}));

jest.mock("./emprende-ai.service", () => ({
  EmrendeAiService: class EmrendeAiService {},
}));

jest.mock("../gateways/events.gateway", () => ({
  EventsGateway: class EventsGateway {},
}));

jest.mock("../whatsapp/whatsapp.service", () => ({
  WhatsAppService: class WhatsAppService {},
}));

import { AgentRunService } from "./agent-run.service";

describe("AgentRunService", () => {
  function makeService() {
    return new AgentRunService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  describe("getRunFromMeta", () => {
    it("returns null when stored run is missing id", () => {
      const service = makeService();

      const result = service.getRunFromMeta({
        metadata_json: { agent_run: { status: "RUNNING", intent: "ORDER" } },
      });

      expect(result).toBeNull();
    });

    it("returns null for empty or malformed metadata", () => {
      const service = makeService();

      expect(service.getRunFromMeta({ metadata_json: {} })).toBeNull();
      expect(service.getRunFromMeta({ metadata_json: { agent_run: {} } })).toBeNull();
    });

    it("normalizes optional collection fields on valid stored runs", () => {
      const service = makeService();

      const result = service.getRunFromMeta({
        metadata_json: {
          agent_run: {
            id: "agr_1",
            status: "RUNNING",
            intent: "ORDER",
            started_at: "2026-05-22T00:00:00.000Z",
          },
        },
      });

      expect(result).toEqual({
        id: "agr_1",
        status: "RUNNING",
        intent: "ORDER",
        started_at: "2026-05-22T00:00:00.000Z",
        collected: {},
        pending_fields: [],
        steps: [],
        artifact: null,
      });
    });
  });
});
