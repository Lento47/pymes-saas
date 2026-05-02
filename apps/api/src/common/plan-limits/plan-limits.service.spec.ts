import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlanLimitsService, QuotaExceededError, PLAN_LIMITS, PLAN_ORDER, PlanLimitEvaluation } from './plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

const mockPrisma = {
  workspace: {
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
  },
  workspaceUser: { count: jest.fn() },
  automationRule: { count: jest.fn() },
  contact: { count: jest.fn() },
  document: { count: jest.fn(), aggregate: jest.fn() },
  invoice: { count: jest.fn() },
  workspaceEnterpriseConfig: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

const mockI18n = {
  t: jest.fn().mockReturnValue(''),
};

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<PlanLimitsService>(PlanLimitsService);
  });

  // ─── Plan limits constants ──────────────────────────────────────────────

  describe('PLAN_LIMITS', () => {
    it('STARTER has correct limits per spec', () => {
      expect(PLAN_LIMITS['STARTER']).toEqual({
        users: 1,
        automations: 15,
        contacts: 500,
        documents: 500,
        invoices_per_month: 100,
        storage_bytes: 5 * 1024 * 1024 * 1024,
        locations: 1,
        invite_codes: 10,
        products: 300,
        product_categories: 20,
        diagnostics_per_day: 10,
      });
    });

    it('GROWTH has correct limits per spec', () => {
      expect(PLAN_LIMITS['GROWTH']).toEqual({
        users: 5,
        automations: 25,
        contacts: 2_500,
        documents: 500,
        invoices_per_month: 500,
        storage_bytes: 10 * 1024 * 1024 * 1024,
        locations: 1,
        invite_codes: 50,
        products: 1500,
        product_categories: 50,
        diagnostics_per_day: 30,
      });
    });

    it('BUSINESS has correct limits per spec', () => {
      expect(PLAN_LIMITS['BUSINESS']).toEqual({
        users: 15,
        automations: 100,
        contacts: 15_000,
        documents: 5_000,
        invoices_per_month: 2_000,
        storage_bytes: 50 * 1024 * 1024 * 1024,
        locations: 3,
        invite_codes: 200,
        products: 10000,
        product_categories: 200,
        diagnostics_per_day: 100,
      });
    });

    it('BUSINESS_PLUS has custom limits', () => {
      const limits = PLAN_LIMITS['BUSINESS_PLUS'];
      for (const key of Object.keys(limits)) {
        expect(limits[key]).toBe('custom');
      }
    });

    it('ENTERPRISE maps to Business limits (backward compat)', () => {
      expect(PLAN_LIMITS['ENTERPRISE'].users).toBe(15);
    });
  });

  // ─── Plan ordering ─────────────────────────────────────────────────────

  describe('PLAN_ORDER', () => {
    it('has correct hierarchy', () => {
      expect(PLAN_ORDER).toEqual([
        'FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS',
      ]);
    });
  });

  // ─── getUpgradePlan ────────────────────────────────────────────────────

  describe('getUpgradePlan', () => {
    it('FREE → STARTER', () => {
      expect(service.getUpgradePlan('FREE')).toBe('STARTER');
    });

    it('STARTER → GROWTH', () => {
      expect(service.getUpgradePlan('STARTER')).toBe('GROWTH');
    });

    it('GROWTH → BUSINESS', () => {
      expect(service.getUpgradePlan('GROWTH')).toBe('BUSINESS');
    });

    it('BUSINESS → BUSINESS_PLUS', () => {
      expect(service.getUpgradePlan('BUSINESS')).toBe('BUSINESS_PLUS');
    });

    it('BUSINESS_PLUS → BUSINESS_PLUS (no higher)', () => {
      expect(service.getUpgradePlan('BUSINESS_PLUS')).toBe('BUSINESS_PLUS');
    });

    it('ENTERPRISE legacy → BUSINESS_PLUS', () => {
      expect(service.getUpgradePlan('ENTERPRISE')).toBe('BUSINESS_PLUS');
    });
  });

  // ─── getLimits ─────────────────────────────────────────────────────────

  describe('getLimits', () => {
    it('returns FREE limits for unknown plan', () => {
      const limits = service.getLimits('FAKE_PLAN');
      expect(limits.users).toBe(PLAN_LIMITS['FREE'].users);
    });

    it('returns BUSINESS_PLUS limits with custom', () => {
      const limits = service.getLimits('BUSINESS_PLUS');
      expect(limits.users).toBe('custom');
    });
  });

  // ─── checkUserLimit ────────────────────────────────────────────────────

  describe('checkUserLimit', () => {
    it('throws QuotaExceededError when STARTER user limit exceeded', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.workspaceUser.count.mockResolvedValue(1); // 1 user = at limit

      await expect(service.checkUserLimit('ws1')).rejects.toThrow(QuotaExceededError);
    });

    it('allows when under limit', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.workspaceUser.count.mockResolvedValue(0);

      await expect(service.checkUserLimit('ws1')).resolves.toBeUndefined();
    });

    it('always allows BUSINESS_PLUS (custom)', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'BUSINESS_PLUS' });

      await expect(service.checkUserLimit('ws1')).resolves.toBeUndefined();
    });
  });

  // ─── checkAutomationLimit ──────────────────────────────────────────────

  describe('checkAutomationLimit', () => {
    it('throws QuotaExceededError when STARTER automation limit exceeded', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.automationRule.count.mockResolvedValue(15); // 15 = at limit

      await expect(service.checkAutomationLimit('ws1')).rejects.toThrow(QuotaExceededError);
    });

    it('allows when under limit', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.automationRule.count.mockResolvedValue(3);

      await expect(service.checkAutomationLimit('ws1')).resolves.toBeUndefined();
    });

    it('always allows BUSINESS_PLUS (custom)', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'BUSINESS_PLUS' });

      await expect(service.checkAutomationLimit('ws1')).resolves.toBeUndefined();
    });
  });

  // ─── checkContactLimit ─────────────────────────────────────────────────

  describe('checkContactLimit', () => {
    it('throws QuotaExceededError when STARTER contact limit exceeded', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.contact.count.mockResolvedValue(500);

      await expect(service.checkContactLimit('ws1')).rejects.toThrow(QuotaExceededError);
    });
  });

  // ─── checkInvoiceLimit ─────────────────────────────────────────────────

  describe('checkInvoiceLimit', () => {
    it('throws QuotaExceededError when STARTER invoice limit exceeded', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.invoice.count.mockResolvedValue(100);

      await expect(service.checkInvoiceLimit('ws1')).rejects.toThrow(QuotaExceededError);
    });
  });

  // ─── evaluatePlanLimit ─────────────────────────────────────────────────

  describe('evaluatePlanLimit', () => {
    it('returns allowed:true for BUSINESS_PLUS custom limits', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'BUSINESS_PLUS' });

      const result = await service.evaluatePlanLimit('ws1', 'users', 999);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe('custom');
    });

    it('returns allowed:false when STARTER user limit would be exceeded', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      mockPrisma.workspaceUser.count.mockResolvedValue(1); // at limit of 1

      const result = await service.evaluatePlanLimit('ws1', 'users', 1);
      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.upgradeTarget).toBe('GROWTH');
      expect(result.message).toBeDefined();
    });

    it('returns allowed:true when within limit', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'GROWTH' });
      mockPrisma.workspaceUser.count.mockResolvedValue(2); // 5 limit, 2 current

      const result = await service.evaluatePlanLimit('ws1', 'users', 2); // 2+2=4 < 5
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  // ─── isPlanAtLeast ─────────────────────────────────────────────────────

  describe('isPlanAtLeast', () => {
    it('GROWTH >= STARTER is true', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'GROWTH' });
      await expect(service.isPlanAtLeast('ws1', 'STARTER')).resolves.toBe(true);
    });

    it('STARTER >= BUSINESS is false', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'STARTER' });
      await expect(service.isPlanAtLeast('ws1', 'BUSINESS')).resolves.toBe(false);
    });

    it('ENTERPRISE legacy >= BUSINESS is true', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'ENTERPRISE' });
      await expect(service.isPlanAtLeast('ws1', 'BUSINESS')).resolves.toBe(true);
    });
  });

  // ─── enforcePlanTier ───────────────────────────────────────────────────

  describe('enforcePlanTier', () => {
    it('throws when plan is too low', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'FREE' });
      await expect(service.enforcePlanTier('ws1', 'BUSINESS', 'SSO'))
        .rejects.toThrow(ForbiddenException);
    });

    it('does not throw when plan is sufficient', async () => {
      mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ plan: 'BUSINESS' });
      await expect(service.enforcePlanTier('ws1', 'GROWTH', 'WhatsApp'))
        .resolves.toBeUndefined();
    });
  });
});
