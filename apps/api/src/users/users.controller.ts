import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /** GET /users — todos los miembros del workspace */
  @Get()
  findAll(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  /** GET /users/me — perfil propio */
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.service.findOne(user.workspace_id, user.id);
  }

  /** PATCH /users/me — editar perfil propio */
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.service.updateMe(user, dto);
  }

  /** GET /users/:id — perfil de cualquier miembro del workspace */
  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  /** PATCH /users/:id — ADMIN/OWNER pueden editar a otros */
  @Patch(':id')
  updateById(
    @CurrentUser() user: AuthUser,
    @Param('id', ValidateUUIDPipe) targetId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.updateById(user.workspace_id, user, targetId, dto);
  }
}
