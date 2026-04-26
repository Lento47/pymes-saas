import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('portal')
  async getPortalLink(@CurrentUser('workspace_id') workspaceId: string) {
    const sub = await this.prisma.workspaceSubscription.findFirst({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
      select: { provider_customer_id: true },
    });
    // When Paddle billing is active, generate a portal URL here.
    // For now return null so the frontend shows the button as disabled.
    return { url: null, customer_id: sub?.provider_customer_id ?? null };
  }
}
