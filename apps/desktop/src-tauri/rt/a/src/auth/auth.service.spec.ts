import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../common/prisma/prisma.service';

const JWT_SECRET = 'test-secret';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
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
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workspace.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'existing@example.com' });

      await expect(service.register({ email: 'existing@example.com', name: 'X', password: 'pass1234' }))
        .rejects.toThrow(ConflictException);
    });
  });
});
