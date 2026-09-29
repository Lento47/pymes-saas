import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { AdminAuthService } from "./admin-auth.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { RefreshTokenService } from "./refresh-token.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

const SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

/**
 * `JwtStrategy`'s constructor calls `validateJwtSecret()`, which reads `JWT_SECRET` and
 * refuses anything under 32 characters. The module has to be compiled before any test
 * runs, so the variable is set at import time rather than in a `beforeEach` — this is the
 * same reason `auth.service.spec.ts` registers a real `JwtModule` instead of a stub.
 */
process.env.JWT_SECRET = SECRET;

/**
 * The bootstrap code, and the one property that makes it safe to put in a URL.
 *
 * The admin login redirects back to the browser with `?code=…` instead of the tokens
 * themselves. That code is signed with the same secret as a session token and carries a
 * real `sub` + `workspace_id`, so the only thing standing between a code scraped from an
 * access log and a valid session is `JwtStrategy.validate` refusing a token that carries
 * a `typ`. These tests are that refusal.
 */
describe("JwtStrategy — token kind", () => {
  let strategy: JwtStrategy;

  const findUnique = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: { workspaceUser: { findUnique } } },
      ],
    }).compile();

    // `JwtStrategy` builds a passport `Strategy` in its constructor, which needs
    // `JWT_SECRET` — set at the top of this file.
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it("rejects a bootstrap token before it touches the database", async () => {
    // The assertion that matters: `findUnique` is never called, so a leaked code cannot
    // even resolve the membership it names.
    await expect(
      strategy.validate({ sub: "u1", workspace_id: "w1", typ: "admin_bootstrap" } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it("accepts a token with no typ, which is every normal access token", async () => {
    findUnique.mockResolvedValue({
      user: { id: "u1", email: "a@b.c", name: "A", status: "ACTIVE", is_platform_admin: false },
      workspace_id: "w1",
      role: "OWNER",
      is_owner: true,
    });

    const user = await strategy.validate({
      sub: "u1",
      email: "a@b.c",
      workspace_id: "w1",
      role: "OWNER",
      is_platform_admin: false,
    } as never);

    expect(user).toMatchObject({ id: "u1", workspace_id: "w1", role: "OWNER" });
  });
});

describe("AdminAuthService.exchangeBootstrapCode", () => {
  let service: AdminAuthService;
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  const findUnique = jest.fn();
  const createRefresh = jest.fn();

  const ADMIN_USER = {
    id: "u1",
    email: "boss@pymeshub.lat",
    name: "Boss",
    avatar_url: null,
    status: "ACTIVE",
    is_platform_admin: true,
    workspace_users: [
      {
        role: "OWNER",
        is_owner: true,
        workspace: { id: "w1", name: "Admin Hub", slug: "admin-1", plan: "BUSINESS_PLUS" },
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jwt = {
      // The real signing shape: `typ` is what the exchange stamps, and the access token
      // is what it mints in return. Asserted separately below.
      sign: jest.fn((payload: unknown, options?: unknown) =>
        options ? `bootstrap.${(payload as { typ: string }).typ}` : "access.jwt",
      ),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: JwtService, useValue: jwt },
        { provide: RefreshTokenService, useValue: { create: createRefresh } },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  it("rejects a code whose signature does not verify", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await expect(service.exchangeBootstrapCode("nope")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(createRefresh).not.toHaveBeenCalled();
  });

  it("rejects an ordinary access token presented as a code", async () => {
    // The inverse attack: a valid session token is a valid signature, so only the `typ`
    // check stands between it and a second session.
    jwt.verify.mockReturnValue({
      sub: "u1",
      workspace_id: "w1",
      email: "boss@pymeshub.lat",
      role: "OWNER",
      is_platform_admin: true,
    });

    await expect(service.exchangeBootstrapCode("access.jwt")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(createRefresh).not.toHaveBeenCalled();
  });

  it("rejects a code for somebody who is no longer an admin", async () => {
    jwt.verify.mockReturnValue({ sub: "u1", workspace_id: "w1", typ: "admin_bootstrap" });
    findUnique.mockResolvedValue({ ...ADMIN_USER, is_platform_admin: false });

    await expect(service.exchangeBootstrapCode("code")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(createRefresh).not.toHaveBeenCalled();
  });

  it("rejects a code for a suspended account", async () => {
    jwt.verify.mockReturnValue({ sub: "u1", workspace_id: "w1", typ: "admin_bootstrap" });
    findUnique.mockResolvedValue({ ...ADMIN_USER, status: "BANNED" });

    await expect(service.exchangeBootstrapCode("code")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("returns a session for a valid code, and mints a token with no typ", async () => {
    jwt.verify.mockReturnValue({ sub: "u1", workspace_id: "w1", typ: "admin_bootstrap" });
    findUnique.mockResolvedValue(ADMIN_USER);
    createRefresh.mockResolvedValue("refresh-1");

    const session = await service.exchangeBootstrapCode("code");

    expect(session.access_token).toBe("access.jwt");
    expect(session.refresh_token).toBe("refresh-1");
    expect(session.user.workspace.slug).toBe("admin-1");

    // The access token must be redeemable by `JwtStrategy`, which means it must NOT
    // carry a `typ` — that is the whole distinction between the two token kinds.
    const [payload] = jwt.sign.mock.calls[0];
    expect(payload).not.toHaveProperty("typ");
  });

  it("looks the membership up by the workspace named in the code", async () => {
    jwt.verify.mockReturnValue({ sub: "u1", workspace_id: "w9", typ: "admin_bootstrap" });
    findUnique.mockResolvedValue(ADMIN_USER);
    createRefresh.mockResolvedValue("refresh-1");

    await service.exchangeBootstrapCode("code");

    // A code naming one workspace must not mint a session against another.
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        include: expect.objectContaining({
          workspace_users: expect.objectContaining({ where: { workspace_id: "w9" } }),
        }),
      }),
    );
  });
});

describe("AdminAuthService.handleCallback", () => {
  it("stamps a short expiry and a typ on the code it returns", () => {
    // Reads the source rather than driving a full Auth0 exchange, which would need the
    // provider mocked at the fetch layer. The two facts that matter are both literal:
    // the code is signed with `typ`, and it is signed with an expiry.
    const source = require("node:fs").readFileSync(
      require.resolve("./admin-auth.service.ts"),
      "utf-8",
    ) as string;

    expect(source).toContain('typ: "admin_bootstrap"');
    expect(source).toContain("expiresIn: BOOTSTRAP_TTL_SECONDS");
  });
});
