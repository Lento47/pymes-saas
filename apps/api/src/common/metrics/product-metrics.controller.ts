import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProductMetricsService } from './product-metrics.service';

@Controller('metrics')
export class ProductMetricsController {
  constructor(private readonly metrics: ProductMetricsService) {}

  /** Anonymous product event — called from frontend (cookie-gated) */
  @Post('event')
  async track(@Body() body: { event: string; category?: string; value?: number; metadata?: Record<string, string> }) {
    await this.metrics.track({
      event: body.event,
      category: body.category,
      value: body.value,
      metadata: body.metadata,
    });
    return { ok: true };
  }

  /** Admin-only: aggregated metrics dashboard */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getAdminMetrics() {
    const [metrics, usage] = await Promise.all([
      this.metrics.getAggregatedMetrics(30),
      this.metrics.getWorkspaceUsageSummary(),
    ]);
    return { metrics, usage };
  }
}
