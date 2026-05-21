import { WorkspaceUserRole } from "@prisma/client";
import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { SummariesService } from "./summaries.service";
import { FilterSummariesDto } from "./dto/filter-summaries.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("summaries")
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Get("daily")
  @Roles(WorkspaceUserRole.AGENT, WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  findAll(@CurrentUser() user: Record<string, any>, @Query() filters: FilterSummariesDto) {
    return this.summariesService.findAll(user.workspace_id, filters);
  }

  @Get("daily/:date")
  findByDate(
    @CurrentUser() user: Record<string, any>,
    @Param("date") date: string,
  ) {
    // Handle 'today' as a special value (sent by the frontend for /daily/today)
    const resolved = date === "today"
      ? new Date().toISOString().split("T")[0]
      : date;
    return this.summariesService.findByDate(user.workspace_id, resolved);
  }

  @Post("generate")
  generate(@CurrentUser() user: Record<string, any>) {
    return this.summariesService.generate(user.workspace_id);
  }
}
