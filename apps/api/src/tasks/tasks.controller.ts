import { WorkspaceUserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterTasksDto,
  ) {
    return this.service.findAll(workspaceId, filters);
  }

  /** GET /tasks/overdue — resumen de tareas vencidas */
  @Get('overdue')
  getOverdue(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.getOverdueSummary(workspaceId);
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.create(user.workspace_id, user, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(':id/complete')
  @Roles(WorkspaceUserRole.AGENT)
  complete(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.complete(workspaceId, id);
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.AGENT)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
