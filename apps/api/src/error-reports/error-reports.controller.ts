import { WorkspaceUserRole } from "@prisma/client";
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { ErrorReportsService } from "./error-reports.service";
import { CreateErrorReportDto } from "./dto/create-error-report.dto";
import { FilterErrorReportsDto } from "./dto/filter-error-reports.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("error-reports")
export class ErrorReportsController {
  constructor(private readonly service: ErrorReportsService) {}

  @Post("client")
  @UseGuards(JwtAuthGuard)
  reportClientError(@Body() dto: CreateErrorReportDto) {
    return this.service.createClientReport(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(WorkspaceUserRole.ADMIN)
  findAll(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query() filters: FilterErrorReportsDto,
  ) {
    return this.service.findAll(workspaceId, filters);
  }
}
