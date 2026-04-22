import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly deptService: DepartmentsService) {}

  /** GET /departments — list all departments in workspace */
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.deptService.findAll(user.workspace_id);
  }

  /** GET /departments/:id */
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deptService.findOne(user.workspace_id, id);
  }

  /** POST /departments — ADMIN+ only */
  @Post()
  @Roles('ADMIN', 'OWNER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.deptService.create(user.workspace_id, dto);
  }

  /** PATCH /departments/:id — ADMIN+ only */
  @Patch(':id')
  @Roles('ADMIN', 'OWNER')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.deptService.update(user.workspace_id, id, dto);
  }

  /** DELETE /departments/:id — OWNER only */
  @Delete(':id')
  @Roles('OWNER')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deptService.remove(user.workspace_id, id);
  }

  // ── Members ───────────────────────────────────────────────────────────────

  /** GET /departments/:id/members */
  @Get(':id/members')
  getMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deptService.getMembers(user.workspace_id, id);
  }

  /** POST /departments/:id/members — ADMIN+ only */
  @Post(':id/members')
  @Roles('ADMIN', 'OWNER')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.deptService.addMember(user.workspace_id, id, dto);
  }

  /** DELETE /departments/:id/members/:userId — ADMIN+ only */
  @Delete(':id/members/:userId')
  @Roles('ADMIN', 'OWNER')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.deptService.removeMember(user.workspace_id, id, userId);
  }
}
