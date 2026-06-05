import { WorkspaceUserRole } from "@prisma/client";
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
} from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { ContactsService } from "./contacts.service";
import { ContactMetricsService, ContactMetrics, ExtractedData } from "./contact-metrics.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { FilterContactsDto } from "./dto/filter-contacts.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";
import { FeaturesService } from "../features/features.service";
import { AuditService } from "../audit/audit.service";

@Controller("contacts")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(
    private readonly service: ContactsService,
    private readonly metricsService: ContactMetricsService,
    private readonly planLimits: PlanLimitsService,
    private readonly features: FeaturesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@CurrentUser("workspace_id") workspaceId: string, @Query() filters: FilterContactsDto) {
    return this.service.findAll(workspaceId, filters);
  }

  @Post()
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.AGENT)
  async create(@CurrentUser("workspace_id") workspaceId: string, @Body() dto: CreateContactDto) {
    await this.features.assertEnabled(workspaceId, "contacts");
    return this.service.create(workspaceId, dto);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    const contact = await this.service.findOne(user.workspace_id, id);
    this.audit.log(user.workspace_id, {
      user_id: user.id,
      action: "contact.viewed",
      entity_type: "Contact",
      entity_id: id,
    }).catch(() => undefined);
    return contact;
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(":id")
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }

  @Get(":id/metrics")
  getMetrics(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ): Promise<ContactMetrics> {
    return this.metricsService.getMetrics(workspaceId, id);
  }

  @Post(":id/extract")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.AGENT)
  extractData(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ): Promise<ExtractedData> {
    return this.metricsService.extractData(workspaceId, id);
  }
}
