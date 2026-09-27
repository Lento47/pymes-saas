import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { RemindersService } from "./reminders.service";
import { FeaturesService } from "../features/features.service";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FeatureFlagGuard } from "../feature-flags/feature-flags.guard";

describe("invoice HTTP authorization after authentication", () => {
  let app: INestApplication;
  const invoices = { findContacts: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }), findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }), approveInvoice: jest.fn().mockResolvedValue({ id: "invoice-one" }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: invoices },
        { provide: RemindersService, useValue: {} },
        { provide: FeaturesService, useValue: {} },
        { provide: AuditService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: any) {
        const req = context.switchToHttp().getRequest();
        req.user = { id: "user-a", workspace_id: "workspace-a", role: req.headers["test-role"] };
        return true;
      } })
      .overrideGuard(FeatureFlagGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());

  it.each(["BILLING", "MANAGER", "ADMIN", "OWNER"])("allows %s to list invoices in its workspace", async role => {
    await request(app.getHttpServer()).get("/invoices").set("test-role", role).expect(200);
    expect(invoices.findAll).toHaveBeenCalledWith("workspace-a", {});
  });
  it.each(["AGENT", "VIEWER"])("denies %s before accessing invoice data", async role => {
    await request(app.getHttpServer()).get("/invoices").set("test-role", role).expect(403);
    expect(invoices.findAll).not.toHaveBeenCalled();
  });
  it("does not expand billing access to administrative approvals", async () => {
    await request(app.getHttpServer()).post("/invoices/11111111-1111-4111-8111-111111111111/approve").set("test-role", "BILLING").expect(403);
    expect(invoices.approveInvoice).not.toHaveBeenCalled();
  });
  it("allows billing to use the scoped client picker", async () => {
    await request(app.getHttpServer()).get("/invoices/contacts?q=Ana").set("test-role", "BILLING").expect(200);
    expect(invoices.findContacts).toHaveBeenCalledWith("workspace-a", { q: "Ana" });
  });
  it.each(["AGENT", "VIEWER"])("denies the client picker to %s", async role => {
    await request(app.getHttpServer()).get("/invoices/contacts").set("test-role", role).expect(403);
    expect(invoices.findContacts).not.toHaveBeenCalled();
  });
});
