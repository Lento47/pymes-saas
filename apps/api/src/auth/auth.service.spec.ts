import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { RefreshTokenService } from "./refresh-token.service";
import { PrismaService } from "../common/prisma/prisma.service";
import { DemoDataService } from "../demo/demo-data.service";

const JWT_SECRET = "test-secret";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  workspaceUser: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockDemoData = {
  populateDemoWorkspace: jest.fn().mockResolvedValue(undefined),
};

describe("AuthService", () => {
  let service: AuthService;
  let refreshTokenService: RefreshTokenService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: "15m" } })],
      providers: [
        AuthService,
        RefreshTokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DemoDataService, useValue: mockDemoData },
        /*
         * `AuthService` reads `RESEND_API_KEY` and `APP_URL` for the verification
         * and password-reset emails (`auth.service.ts:318,324,346,352`). The module
         * could not be compiled without it, which failed every case in the file
         * rather than the email ones. A stub that answers `get` is enough: nothing in
         * this suite sends mail, and returning `undefined` for the API key means the
         * senders take their no-mailer branch rather than reaching a network.
         */
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
  });

  describe("login", () => {
    const password = "password123";
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(password, 12);
    });

    it("returns tokens and user on valid credentials", async () => {
      const user = {
        id: "u1",
        email: "test@example.com",
        name: "Test",
        avatar_url: null,
        status: "ACTIVE",
        password_hash: passwordHash,
        // `login` refuses an unverified address (`auth.service.ts:59`). A fixture
        // without this is a row that cannot complete the action under test, so the
        // flag is what makes "valid credentials" mean what the case name says.
        email_verified: true,
      };
      const workspace = { id: "w1", name: "Acme", slug: "acme", plan: "FREE" };
      const membership = { workspace_id: "w1", user_id: "u1", role: "OWNER", is_owner: true };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(membership);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: user.email, password }, "acme");

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe(user.email);
      expect(result.user.role).toBe("OWNER");
    });

    it("throws UnauthorizedException when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: "x@x.com", password }, "acme")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException on wrong password", async () => {
      const user = {
        id: "u1",
        email: "test@example.com",
        status: "ACTIVE",
        password_hash: passwordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: "wrongpassword" }, "acme"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when user is inactive", async () => {
      const user = {
        id: "u1",
        email: "test@example.com",
        status: "INACTIVE",
        password_hash: passwordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login({ email: user.email, password }, "acme")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when workspace not found", async () => {
      const user = {
        id: "u1",
        email: "test@example.com",
        status: "ACTIVE",
        password_hash: passwordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: user.email, password }, "nonexistent")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when user has no membership", async () => {
      const user = {
        id: "u1",
        email: "test@example.com",
        status: "ACTIVE",
        password_hash: passwordHash,
      };
      const workspace = { id: "w1", slug: "acme" };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: user.email, password }, "acme")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("register", () => {
    it("creates user and workspace for new registration", async () => {
      const dto = { email: "new@example.com", name: "New User", password: "password123", terms_accepted: true, age_confirmed: true };
      const user = { id: "u2", email: dto.email, name: dto.name, avatar_url: null };
      const workspace = {
        id: "w2",
        name: `${dto.name}'s Workspace`,
        slug: "new-123",
        plan: "FREE",
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe(dto.email);
      expect(result.user.role).toBe("OWNER");
      expect(result.user.workspace.slug).toBe(workspace.slug);
      expect((result as any).workspace.slug).toBe(workspace.slug);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workspace.create).toHaveBeenCalledTimes(1);
    });

    it("allows public registration with non-PymesHub email domains", async () => {
      const dto = {
        email: "owner@customer-company.com",
        name: "Customer Owner",
        password: "password123",
        terms_accepted: true,
        age_confirmed: true,
      };
      const user = { id: "u-public", email: dto.email, name: dto.name, avatar_url: null };
      const workspace = {
        id: "w-public",
        name: `${dto.name}'s Workspace`,
        slug: "customer-123",
        plan: "FREE",
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await expect(service.register(dto)).resolves.toEqual({
        access_token: expect.any(String),
        refresh_token: expect.anything(),
        // A new account starts unverified — `register` writes
        // `email_verified: false` and hands back that flag, so the response shape
        // the client reads has to include it even when the case is about the email
        // domain being accepted.
        email_verified: false,
        user: expect.objectContaining({
          email: dto.email,
          workspace: expect.objectContaining({ slug: workspace.slug }),
        }),
        workspace: expect.objectContaining({ slug: workspace.slug }),
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: dto.email }),
        }),
      );
    });

    it("throws ConflictException when email is already registered", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "existing@example.com" });

      await expect(
        service.register({ email: "existing@example.com", name: "X", password: "pass1234", terms_accepted: true, age_confirmed: true }),
      ).rejects.toThrow(ConflictException);
    });

    /*
     * The refusal half of the age gate, and it lives here rather than in the DTO
     * spec because `@IsBoolean()` accepts `false` — it is a well-formed boolean
     * carrying a refusal, so the validator passes it and this is the layer that
     * reads it. Both refusals are asserted, and each is checked to have happened
     * *before* any write, because a gate that creates the account and then complains
     * is not a gate.
     */

    it("refuses a registration that does not assert the reader is an adult", async () => {
      await expect(
        service.register({
          email: "young@example.com",
          name: "Too Young",
          password: "password123",
          terms_accepted: true,
          age_confirmed: false,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("refuses a registration whose adult assertion is missing entirely", async () => {
      // What a client older than the field, or a hand-rolled request, actually sends.
      await expect(
        service.register({
          email: "absent@example.com",
          name: "No Assertion",
          password: "password123",
          terms_accepted: true,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("refuses a registration that does not accept the terms", async () => {
      await expect(
        service.register({
          email: "noterms@example.com",
          name: "No Terms",
          password: "password123",
          terms_accepted: false,
          age_confirmed: true,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("records both assertions on the created user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "u9", email: "both@example.com", name: "Both" });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue({ id: "w9", name: "W", slug: "w-9", plan: "FREE" });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: "both@example.com",
        name: "Both",
        password: "password123",
        terms_accepted: true,
        age_confirmed: true,
      });

      /*
       * The same instant for both, not two `new Date()` calls. They are asserted in
       * one breath by one reader on one form, and two timestamps a few hundred
       * microseconds apart would make the pair look like two separate events —
       * which is the wrong shape for evidence about a single act of agreement.
       */
      const { data } = mockPrisma.user.create.mock.calls[0][0];
      expect(data.terms_accepted_at).toBeInstanceOf(Date);
      expect(data.age_confirmed_at).toEqual(data.terms_accepted_at);
    });

    it("accepts invite token by activating invited user instead of creating a workspace", async () => {
      const inviteToken = (service as any).jwtService.sign({
        type: "workspace-invite",
        email: "invited@example.com",
        workspace_id: "w1",
        workspace_slug: "acme",
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u3",
        email: "invited@example.com",
        name: "invited",
        status: "INVITED",
      });
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "w1",
        name: "Acme",
        slug: "acme",
        plan: "FREE",
      });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({
        workspace_id: "w1",
        user_id: "u3",
        role: "AGENT",
        is_owner: false,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: "u3",
        email: "invited@example.com",
        name: "Invited User",
        avatar_url: null,
        status: "ACTIVE",
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: "ignored@example.com",
        name: "Invited User",
        password: "password123",
        invite_token: inviteToken,
        terms_accepted: true,
        age_confirmed: true,
      });

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.workspace.create).not.toHaveBeenCalled();
    });
  });
});
