import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { DemoDataService } from '../demo/demo-data.service';

const JWT_SECRET = 'test-secret';

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

describe('AuthService', () => {
  let service: AuthService;
  let refreshTokenService: RefreshTokenService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } }),
      ],
      providers: [
        AuthService,
        RefreshTokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DemoDataService, useValue: mockDemoData },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
  });

  describe('login', () => {
    const password = 'password123';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(password, 12);
    });

    it('returns tokens and user on valid credentials', async () => {
      const user = { id: 'u1', email: 'test@example.com', name: 'Test', avatar_url: null, status: 'ACTIVE', password_hash: passwordHash };
      const workspace = { id: 'w1', name: 'Acme', slug: 'acme', plan: 'FREE' };
      const membership = { workspace_id: 'w1', user_id: 'u1', role: 'OWNER', is_owner: true };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(membership);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: user.email, password }, 'acme');

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe(user.email);
      expect(result.user.role).toBe('OWNER');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'x@x.com', password }, 'acme'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const user = { id: 'u1', email: 'test@example.com', status: 'ACTIVE', password_hash: passwordHash };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login({ email: user.email, password: 'wrongpassword' }, 'acme'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      const user = { id: 'u1', email: 'test@example.com', status: 'INACTIVE', password_hash: passwordHash };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login({ email: user.email, password }, 'acme'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when workspace not found', async () => {
      const user = { id: 'u1', email: 'test@example.com', status: 'ACTIVE', password_hash: passwordHash };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: user.email, password }, 'nonexistent'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no membership', async () => {
      const user = { id: 'u1', email: 'test@example.com', status: 'ACTIVE', password_hash: passwordHash };
      const workspace = { id: 'w1', slug: 'acme' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: user.email, password }, 'acme'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('creates user and workspace for new registration', async () => {
      const dto = { email: 'new@example.com', name: 'New User', password: 'password123' };
      const user = { id: 'u2', email: dto.email, name: dto.name, avatar_url: null };
      const workspace = { id: 'w2', name: `${dto.name}'s Workspace`, slug: 'new-123', plan: 'FREE' };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe(dto.email);
      expect(result.user.role).toBe('OWNER');
      expect(result.user.workspace.slug).toBe(workspace.slug);
      expect((result as any).workspace.slug).toBe(workspace.slug);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workspace.create).toHaveBeenCalledTimes(1);
    });

    it('allows public registration with non-pymeshub email domains', async () => {
      const dto = { email: 'owner@customer-company.com', name: 'Customer Owner', password: 'password123' };
      const user = { id: 'u-public', email: dto.email, name: dto.name, avatar_url: null };
      const workspace = { id: 'w-public', name: `${dto.name}'s Workspace`, slug: 'customer-123', plan: 'FREE' };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await expect(service.register(dto)).resolves.toEqual({
        access_token: expect.any(String),
        refresh_token: expect.anything(),
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

    it('throws ConflictException when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'existing@example.com' });

      await expect(service.register({ email: 'existing@example.com', name: 'X', password: 'pass1234' }))
        .rejects.toThrow(ConflictException);
    });

    it('accepts invite token by activating invited user instead of creating a workspace', async () => {
      const inviteToken = (service as any).jwtService.sign({
        type: 'workspace-invite',
        email: 'invited@example.com',
        workspace_id: 'w1',
        workspace_slug: 'acme',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u3',
        email: 'invited@example.com',
        name: 'invited',
        status: 'INVITED',
      });
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Acme',
        slug: 'acme',
        plan: 'FREE',
      });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({
        workspace_id: 'w1',
        user_id: 'u3',
        role: 'AGENT',
        is_owner: false,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u3',
        email: 'invited@example.com',
        name: 'Invited User',
        avatar_url: null,
        status: 'ACTIVE',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'ignored@example.com',
        name: 'Invited User',
        password: 'password123',
        invite_token: inviteToken,
      });

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.workspace.create).not.toHaveBeenCalled();
    });
  });
});
