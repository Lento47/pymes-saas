import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { StorageService } from '../common/storage/storage.service';
import { MessagesService } from '../conversations/messages.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

describe('WhatsAppService — channel resolution', () => {
  let service: WhatsAppService;
  let prisma: any;

  const mockActiveChannel = (
    phoneNumberId: string,
    workspaceId: string,
    configJson: any,
    id: string = 'channel-1',
  ) => ({
    id,
    workspace_id: workspaceId,
    config_json: configJson,
  });

  const mockPrisma = () => ({
    channel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  });

  const mockMessages = () => ({
    receiveProviderInbound: jest.fn(),
    emitAndNotify: jest.fn(),
    triggerAiAnalysis: jest.fn(),
  });

  const mockWebhookEvents = () => ({
    ingest: jest.fn(),
  });

  const mockCrypto = () => ({
    decrypt: jest.fn(),
  });

  const mockStorage = () => ({
    upload: jest.fn(),
    download: jest.fn(),
  });

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: mockCrypto() },
        { provide: StorageService, useValue: mockStorage() },
        { provide: MessagesService, useValue: mockMessages() },
        { provide: WebhookEventsService, useValue: mockWebhookEvents() },
        { provide: require('../gateways/events.gateway').EventsGateway, useValue: { emitToWorkspace: jest.fn(), emitToUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  describe('findActiveWhatsappChannelByPhoneNumberId', () => {
    it('should find channel by JSONB fast path (config_json as object)', async () => {
      const phoneNumberId = '123456789';
      const workspaceId = 'ws-1';
      const channel = mockActiveChannel(phoneNumberId, workspaceId, {
        phone_number_id: phoneNumberId,
        waba_id: 'waba-1',
      });

      prisma.channel.findFirst.mockResolvedValue(channel);

      const result = await service.findActiveWhatsappChannelByPhoneNumberId(
        phoneNumberId,
        workspaceId,
      );

      expect(result).toEqual(channel);
      expect(prisma.channel.findFirst).toHaveBeenCalledWith({
        where: {
          type: 'WHATSAPP',
          status: 'ACTIVE',
          config_json: {
            path: ['phone_number_id'],
            equals: phoneNumberId,
          },
          workspace_id: workspaceId,
        },
        select: { id: true, workspace_id: true, config_json: true },
      });
      // Fast path hit — no fallback needed
      expect(prisma.channel.findMany).not.toHaveBeenCalled();
    });

    it('should fallback to in-memory parsing when config_json is a JSON string', async () => {
      const phoneNumberId = '123456789';
      const workspaceId = 'ws-1';

      // Fast path returns null (JSON path fails on string columns)
      prisma.channel.findFirst.mockResolvedValue(null);

      // Fallback returns channels with string config_json
      const channels = [
        mockActiveChannel('other-id', 'ws-other', { phone_number_id: 'other' }, 'channel-other'),
        mockActiveChannel(phoneNumberId, workspaceId, JSON.stringify({ phone_number_id: phoneNumberId }), 'channel-2'),
      ];
      prisma.channel.findMany.mockResolvedValue(channels);

      const result = await service.findActiveWhatsappChannelByPhoneNumberId(
        phoneNumberId,
        workspaceId,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe('channel-2');
      expect(result!.workspace_id).toBe(workspaceId);
      expect(prisma.channel.findFirst).toHaveBeenCalled();
      expect(prisma.channel.findMany).toHaveBeenCalled();
    });

    it('should return null when no channel matches phone_number_id', async () => {
      const phoneNumberId = 'unknown-id';
      const workspaceId = 'ws-1';

      prisma.channel.findFirst.mockResolvedValue(null);
      prisma.channel.findMany.mockResolvedValue([
        mockActiveChannel('other-id', 'ws-other', { phone_number_id: 'other' }, 'channel-other'),
      ]);

      const result = await service.findActiveWhatsappChannelByPhoneNumberId(
        phoneNumberId,
        workspaceId,
      );

      expect(result).toBeNull();
    });

    it('should scope search by workspaceId on both paths', async () => {
      const phoneNumberId = '123456789';
      const workspaceId = 'ws-1';

      // Fast path misses
      prisma.channel.findFirst.mockResolvedValue(null);

      // DB respects workspace_id filter → returns empty (no channels in ws-1 with that phone_number_id)
      prisma.channel.findMany.mockResolvedValue([]);

      const result = await service.findActiveWhatsappChannelByPhoneNumberId(
        phoneNumberId,
        workspaceId,
      );

      // Should filter by workspaceId on the fallback path too
      expect(prisma.channel.findMany).toHaveBeenCalledWith({
        where: {
          type: 'WHATSAPP',
          status: 'ACTIVE',
          workspace_id: workspaceId,
        },
        select: { id: true, workspace_id: true, config_json: true },
      });
      expect(result).toBeNull();
    });

    it('should work without workspaceId filter', async () => {
      const phoneNumberId = '123456789';

      prisma.channel.findFirst.mockResolvedValue(null);
      prisma.channel.findMany.mockResolvedValue([
        mockActiveChannel(phoneNumberId, 'ws-1', JSON.stringify({ phone_number_id: phoneNumberId }), 'channel-1'),
      ]);

      const result = await service.findActiveWhatsappChannelByPhoneNumberId(
        phoneNumberId,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe('channel-1');
      // No workspace_id in fallback where clause
      expect(prisma.channel.findMany).toHaveBeenCalledWith({
        where: { type: 'WHATSAPP', status: 'ACTIVE' },
        select: { id: true, workspace_id: true, config_json: true },
      });
    });
  });
});
