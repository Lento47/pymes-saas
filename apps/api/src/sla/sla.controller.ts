import { Controller, Get, Post, Put, Param, Body, UseGuards } from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { SlaService } from "./sla.service";

@Controller("sla")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  @Get("policies")
  @Roles("OWNER", "ADMIN")
  async getPolicies() {
    return this.sla.getPolicies();
  }

  @Post("policies")
  @Roles("OWNER", "ADMIN")
  async createPolicy(@Body() data: Record<string, any>) {
    return this.sla.upsertPolicy(undefined, data);
  }

  @Put("policies/:id")
  @Roles("OWNER", "ADMIN")
  async updatePolicy(@Param("id", ValidateUUIDPipe) id: string, @Body() data: Record<string, any>) {
    return this.sla.upsertPolicy(id, data);
  }

  @Get("assignment/:workspaceId")
  @Roles("OWNER", "ADMIN")
  async getAssignment(@Param("workspaceId") workspaceId: string) {
    return this.sla.getWorkspaceAssignment(workspaceId);
  }

  @Post("assignment/:workspaceId")
  @Roles("OWNER", "ADMIN")
  async assignPolicy(
    @Param("workspaceId") workspaceId: string,
    @Body()
    data: {
      sla_policy_id: string;
      effective_from?: string;
      effective_to?: string;
      contract_reference?: string;
    },
  ) {
    return this.sla.assignPolicy(workspaceId, data.sla_policy_id, data);
  }
}
