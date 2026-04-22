import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('AGENT' as any)
  @RequirePermission('can_view_audit_log')
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterAuditDto,
  ) {
    return this.auditService.findAll(workspaceId, filters);
  }
}
