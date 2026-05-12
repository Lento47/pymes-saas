import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { InviteCodesService } from './invite-codes.service';

@Controller('workspaces/current/invite-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InviteCodesController {
  constructor(private readonly service: InviteCodesService) {}

  @Get()
  @Roles('ADMIN', 'OWNER', 'AGENT')
  list(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Post()
  @Roles('ADMIN', 'OWNER')
  create(
    @CurrentUser('workspace_id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: { role?: string; max_uses?: number; expires_in_days?: number },
  ) {
    return this.service.generate(workspaceId, { ...dto, role: dto.role || 'AGENT' }, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OWNER')
  revoke(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.revoke(workspaceId, id);
  }
}
