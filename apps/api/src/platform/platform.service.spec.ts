import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";

import { PlatformService } from "./platform.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { FeaturesService } from "../features/features.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { AuditService } from "../audit/audit.service";

/**
 * `togglePlatformAdmin` is the only write in the API that can hand somebody authority
 * over every other workspace, so its trail is the thing under test here.
 *
 * The mock is hand-rolled per `auth.service.spec.ts` rather than a real database: this
 * service is a handful of Prisma calls and there is nothing here worth a Postgres. The
 * four providers are the service's whole constructor, and only `prisma.user` and
 * `audit` are exercised — the other two are injected because Nest will not compile the
 * module without them, and are asserted to be untouched rather than left silent.
 */

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockFeatures = {
  getEffectiveFeatures: jest.fn(),
};

const mockPlanLimits = {
  getAllPlanLimits: jest.fn(),
};

const ACTOR_ID = "actor-1";
const ACTOR_WORKSPACE_ID = "admin-hub-1";
const TARGET_ID = "target-1";

/** The shape `user.update` returns; only `is_platform_admin` matters to these tests. */
function updatedUser(isPlatformAdmin: boolean) {
  return {
    id: TARGET_ID,
    email: "someone@example.com",
    name: "Someone",
    avatar_url: null,
    status: "ACTIVE",
    is_platform_admin: isPlatformAdmin,
    created_at: new Date("2026-01-01T00:00:00Z"),
    workspace_users: [],
  };
}

describe("PlatformService.togglePlatformAdmin", () => {
  let service: PlatformService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FeaturesService, useValue: mockFeatures },
        { provide: PlanLimitsService, useValue: mockPlanLimits },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PlatformService>(PlatformService);
  });

  it("refuses a user that does not exist, without writing or auditing", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  describe("granting", () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        is_platform_admin: false,
      });
      mockPrisma.user.update.mockResolvedValue(updatedUser(true));
    });

    it("sets the flag", async () => {
      await service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TARGET_ID },
          data: { is_platform_admin: true },
        }),
      );
    });

    it("writes an audit row naming the actor, the target, and the change", async () => {
      await service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID);

      // Exactly one row, and it is the whole point of the method.
      expect(mockAudit.log).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(ACTOR_WORKSPACE_ID, {
        user_id: ACTOR_ID,
        action: "user.grant_admin",
        entity_type: "user",
        entity_id: TARGET_ID,
        before: { is_platform_admin: false },
        after: { is_platform_admin: true },
      });
    });

    it("files the row under the actor's workspace, not the target's", async () => {
      await service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID);

      // `audit_logs.workspace_id` is required and a user may belong to several
      // workspaces, so the actor's is the only workspace the row can honestly claim.
      expect(mockAudit.log.mock.calls[0][0]).toBe(ACTOR_WORKSPACE_ID);
    });
  });

  describe("revoking", () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        is_platform_admin: true,
      });
      mockPrisma.user.update.mockResolvedValue(updatedUser(false));
    });

    it("clears the flag and audits it under a different action", async () => {
      // A distinct action name, not a boolean on the same one: the marketplace spells
      // these `user.grant_admin` / `user.revoke_admin` and one console reads both logs.
      await service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { is_platform_admin: false } }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(ACTOR_WORKSPACE_ID, {
        user_id: ACTOR_ID,
        action: "user.revoke_admin",
        entity_type: "user",
        entity_id: TARGET_ID,
        before: { is_platform_admin: true },
        after: { is_platform_admin: false },
      });
    });
  });

  it("returns the updated user, not the audit result", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TARGET_ID,
      is_platform_admin: false,
    });
    mockPrisma.user.update.mockResolvedValue(updatedUser(true));

    await expect(
      service.togglePlatformAdmin(TARGET_ID, ACTOR_ID, ACTOR_WORKSPACE_ID),
    ).resolves.toMatchObject({ id: TARGET_ID, is_platform_admin: true });
  });
});
