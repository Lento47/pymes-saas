import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { FilterAutomationsDto } from './dto/filter-automations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automations')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Get()
  @Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
  findAll(
    @CurrentUser() user: any,
    @Query() filters: FilterAutomationsDto,
  ) {
    return this.automationsService.findAll(user.workspace_id, filters);
  }

  @Post()
  @Roles('ADMIN', 'OWNER')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateAutomationDto,
  ) {
    await this.planLimits.enforceAutomations(user.workspace_id);
    return this.automationsService.create(user.workspace_id, user.id, dto);
  }

  @Get(':id')
  @Roles('VIEWER', 'AGENT', 'ADMIN', 'OWNER')
  findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.automationsService.findOne(user.workspace_id, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OWNER')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(user.workspace_id, id, dto);
  }

  @Post(':id/toggle')
  @Roles('ADMIN', 'OWNER')
  toggle(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.automationsService.toggle(user.workspace_id, id);
  }

  @Get(':id/executions')
  @Roles('AGENT', 'ADMIN', 'OWNER')
  getExecutions(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.automationsService.getExecutions(
      user.workspace_id,
      id,
      page,
      limit,
    );
  }
  @Delete(':id')
  @Roles('ADMIN', 'OWNER')
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.automationsService.remove(user.workspace_id, id);
  }
}


