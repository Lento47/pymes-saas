import { WorkspaceUserRole } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(
    private readonly service: ContactsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Get()
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterContactsDto,
  ) {
    return this.service.findAll(workspaceId, filters);
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  async create(
    @CurrentUser('workspace_id') workspaceId: string,
    @Body() dto: CreateContactDto,
  ) {
    await this.planLimits.enforceContacts(workspaceId);
    return this.service.create(workspaceId, dto);
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
    @Body() dto: UpdateContactDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
