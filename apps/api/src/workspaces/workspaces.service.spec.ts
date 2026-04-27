import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AiService } from '../ai/ai.service';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

const ownerUser: AuthUser = { id: 'u1', email: 'owner@test.com', name: 'Owner', workspace_id: 'w1', role: 'OWNER', is_owner: true, is_platform_admin: false };
const agentUser: AuthUser = { id: 'u2', email: 'agent@test.com', name: 'Agent', workspace_id: 'w1', role: 'AGENT', is_owner: false, is_platform_admin: false };

const mockPrisma = {
  workspace: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  workspaceUser: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  channel: {
    findFirst: jest.fn(),
  },
  contact: { count: jest.fn() },
  conversation: { count: jest.fn() },
  task: { count: jest.fn() },
  document: { count: jest.fn(), aggregate: jest.fn() },
  invoice: { aggregate: jest.fn() },
  automationRule: { count: jest.fn() },
  message: { count: jest.fn() },
};

const mockCrypto = { encrypt: jest.fn((v: string) => `enc:${v}`), decrypt: jest.fn() };
const mockAiService = { getWorkspaceConfig: jest.fn(), getDefaultModel: jest.fn(), testConnection: jest.fn() };
const mockEmailService = { sendOutbound: jest.fn() };
const mockEventsGateway = { emitToWorkspace: jest.fn(), emitToUser: jest.fn() };
const mockPlanLimits = { checkUserLimit: jest.fn(), enforceMembers: jest.fn(), getUpgradePlan: jest.fn(), getLimits: jest.fn(), isPlanAtLeast: jest.fn(), enforcePlanTier: jest.fn() };

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: AiService, useValue: mockAiService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: require('../gateways/events.gateway').EventsGateway, useValue: mockEventsGateway },
        { provide: require('../common/plan-limits/plan-limits.service').PlanLimitsService, useValue: mockPlanLimits },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  describe('getCurrent', () => {
    it('returns workspace with serialized settings', async () => {
      const workspace = { id: 'w1', name: 'Acme', slug: 'acme', settings_json: { ai_message_finance_opt_in: true }, workspace_tax_profile: null };
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue(workspace);

      const result = await service.getCurrent('w1');

      expect(result.ai_message_finance_opt_in).toBe(true);
      expect(result.name).toBe('Acme');
    });
  });

  describe('getStats', () => {
    it('returns aggregated stats for workspace', async () => {
      mockPrisma.contact.count.mockResolvedValue(10);
      mockPrisma.conversation.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      mockPrisma.task.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
      mockPrisma.document.count.mockResolvedValue(4);
      mockPrisma.document.aggregate.mockResolvedValue({ _sum: { file_size: 1024 } });
      mockPrisma.automationRule.count.mockResolvedValue(2);
      mockPrisma.workspaceUser.count.mockResolvedValue(3);
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
      mockPrisma.message.count.mockResolvedValue(5);

      const result = await service.getStats('w1');

      expect(result.contacts).toBe(10);
      expect(result.activeConversations).toBe(2);
      expect(result.pendingTasks).toBe(3);
      expect(result.documentStorageBytes).toBe(1024);
    });
  });

  describe('inviteUser', () => {
    it('throws ForbiddenException when agent tries to invite', async () => {
      await expect(service.inviteUser('w1', agentUser, { email: 'new@test.com', role: 'AGENT' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when inviting with OWNER role', async () => {
      await expect(service.inviteUser('w1', ownerUser, { email: 'new@test.com', role: 'OWNER' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when user is already a member', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u3', email: 'existing@test.com' });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({ id: 'wu1' });

      await expect(service.inviteUser('w1', ownerUser, { email: 'existing@test.com', role: 'AGENT' }))
        .rejects.toThrow(ConflictException);
    });

    it('creates new user and membership when email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u4', email: 'brand-new@test.com' });
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceUser.create.mockResolvedValue({ id: 'wu2' });
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ id: 'w1', name: 'Acme', slug: 'acme' });
      mockPrisma.channel.findFirst.mockResolvedValue(null);

      const result = await service.inviteUser('w1', ownerUser, { email: 'brand-new@test.com', role: 'AGENT' });

      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workspaceUser.create).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('brand-new@test.com');
      expect(result.invite_links.desktop).toContain('pymeshub://accept-invite?token=');
      expect(result.invite_links.browser).toContain('https://app.pymeshub.lat/#/accept-invite?token=');
    });
  });

  describe('removeMember', () => {
    it('throws BadRequestException when removing self', async () => {
      await expect(service.removeMember('w1', ownerUser, ownerUser.id))
        .rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when agent tries to remove member', async () => {
      await expect(service.removeMember('w1', agentUser, 'u3'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when member does not exist', async () => {
      mockPrisma.workspaceUser.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('w1', ownerUser, 'u999'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when removing the owner', async () => {
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({ id: 'wu1', is_owner: true });

      await expect(service.removeMember('w1', ownerUser, 'u2'))
        .rejects.toThrow(ForbiddenException);
    });

    it('removes member successfully', async () => {
      mockPrisma.workspaceUser.findUnique.mockResolvedValue({ id: 'wu3', is_owner: false });
      mockPrisma.workspaceUser.delete.mockResolvedValue({});

      const result = await service.removeMember('w1', ownerUser, 'u3');

      expect(mockPrisma.workspaceUser.delete).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('removido');
    });
  });
});
