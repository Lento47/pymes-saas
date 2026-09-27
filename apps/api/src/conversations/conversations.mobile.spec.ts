import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

describe("inbox permissions after JWT authentication", () => {
  let app: INestApplication;
  const service = { findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }), create: jest.fn().mockResolvedValue({ id: "conversation-a" }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ConversationsController] })
      .useMocker(token => token === ConversationsService ? service : {})
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: any) {
        const req = context.switchToHttp().getRequest();
        req.user = { id: "user-a", workspace_id: "workspace-a", role: req.headers["test-role"] }; return true;
      } }).compile();
    app = module.createNestApplication(); await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app?.close());
  it.each(["VIEWER", "AGENT", "MANAGER", "ADMIN", "OWNER"])("lets %s read its inbox", async role => {
    await request(app.getHttpServer()).get("/conversations").set("test-role", role).expect(200);
    expect(service.findAll).toHaveBeenCalledWith("workspace-a", {}, { id: "user-a", role });
  });
  it("rejects billing before reading conversations despite the role hierarchy", async () => {
    await request(app.getHttpServer()).get("/conversations").set("test-role", "BILLING").expect(403);
    expect(service.findAll).not.toHaveBeenCalled();
  });
  it.each(["VIEWER", "BILLING"])("rejects %s creating conversations", async role => {
    await request(app.getHttpServer()).post("/conversations").set("test-role", role).send({ channel_id: "channel-a" }).expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });
  it("retains agent access to conversation creation", async () => {
    await request(app.getHttpServer()).post("/conversations").set("test-role", "AGENT").send({ channel_id: "channel-a" }).expect(201);
    expect(service.create).toHaveBeenCalledWith("workspace-a", { channel_id: "channel-a" });
  });
});

describe("inbox search and pagination", () => {
  it("searches subject and client before pagination, retaining workspace and department scope", async () => {
    const prisma = {
      setWorkspaceContext: jest.fn(), departmentMember: { findMany: jest.fn().mockResolvedValue([{ department_id: "department-a" }]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(24) },
    };
    const service = new ConversationsService(...[prisma, {}, {}, {}] as unknown as ConstructorParameters<typeof ConversationsService>);
    const result = await service.findAll("workspace-a", { q: "  Ana  ", page: 2, limit: 20, status: "OPEN", channel_type: "EMAIL" }, { id: "agent-a", role: "AGENT" });
    const query = prisma.conversation.findMany.mock.calls[0][0];
    expect(query).toMatchObject({ skip: 20, take: 20, where: { workspace_id: "workspace-a", department_id: { in: ["department-a"] }, status: "OPEN", channel: { type: "EMAIL" }, OR: [
      { subject: { contains: "Ana", mode: "insensitive" } }, { contact: { full_name: { contains: "Ana", mode: "insensitive" } } },
      { contact: { email: { contains: "Ana", mode: "insensitive" } } }, { contact: { phone: { contains: "Ana", mode: "insensitive" } } },
    ] } });
    expect(prisma.conversation.count).toHaveBeenCalledWith({ where: query.where });
    expect(result.meta).toEqual({ total: 24, page: 2, limit: 20, pages: 2 });
  });
});
