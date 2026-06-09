import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { WorkspaceUserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsAppRateLimiter } from './whatsapp-rate-limiter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('whatsapp/health')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsAppHealthController {
  private readonly logger = new Logger(WhatsAppHealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: WhatsAppRateLimiter,
  ) {}

  /**
   * GET /whatsapp/health
   * Returns channel health per workspace:
   * - Active channels count
   * - Webhook delivery status
   * - Rate limit usage
   * - Recent error messages
   */
  @Get()
  @Roles(WorkspaceUserRole.ADMIN)
  async getHealth(
    @CurrentUser() user: AuthUser,
    @Query('phone_number_id') phoneNumberId?: string,
  ) {
    const workspaceId = user.workspace_id;

    // Active WhatsApp channels
    const channels = await this.prisma.channel.findMany({
      where: { workspace_id: workspaceId, type: 'WHATSAPP' },
      select: { id: true, name: true, status: true, config_json: true },
    });

    // Recent messages with delivery issues (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedMessages = await this.prisma.message.findMany({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: oneDayAgo },
        delivery_status: { in: ['FAILED', 'DISPATCH_FAILED'] },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        external_message_id: true,
        delivery_status: true,
        delivery_error: true,
        created_at: true,
      },
    });

    // Delivery stats (last 24h)
    const deliveryStats = await this.prisma.message.groupBy({
      by: ['delivery_status'],
      where: {
        workspace_id: workspaceId,
        created_at: { gte: oneDayAgo },
        provider: 'whatsapp',
      },
      _count: true,
    });

    // Rate limit usage
    const rateLimitUsage = phoneNumberId
      ? this.rateLimiter.getCurrentUsage(phoneNumberId)
      : this.rateLimiter.getAllUsage();

    // Webhook events count (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const webhookCount = await this.prisma.message.count({
      where: {
        workspace_id: workspaceId,
        created_at: { gte: oneHourAgo },
        provider: 'whatsapp',
        direction: 'INBOUND',
      },
    });

    return {
      channels: channels.map((ch) => {
        const cfg = ch.config_json as Record<string, string | undefined>;
        return {
          id: ch.id,
          name: ch.name,
          status: ch.status,
          phoneNumberId: cfg?.phone_number_id ?? null,
          displayPhoneNumber: cfg?.display_phone_number ?? cfg?.phone_number_id ?? null,
        };
      }),
      delivery: {
        stats: Object.fromEntries(
          deliveryStats.map((s) => [s.delivery_status, s._count]),
        ),
        recentFailures: failedMessages.map((m) => ({
          id: m.id,
          wamid: m.external_message_id,
          status: m.delivery_status,
          error: m.delivery_error?.slice(0, 120),
          at: m.created_at,
        })),
      },
      rateLimit: rateLimitUsage,
      webhookVolume: {
        lastHour: webhookCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /whatsapp/health/rate-limits
   * Real-time rate limit status for all phone numbers in workspace
   */
  @Get('rate-limits')
  @Roles(WorkspaceUserRole.ADMIN)
  getRateLimits() {
    return {
      windows: this.rateLimiter.getAllUsage(),
      defaultMaxPerSecond: 80,
      timestamp: new Date().toISOString(),
    };
  }
}
