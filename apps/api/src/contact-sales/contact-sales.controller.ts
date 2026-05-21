import { Controller, Get, Post, Put, Param, Body, UseGuards, Query } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Throttle } from "@nestjs/throttler";
import { ThrottlerGuard } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ContactSalesService } from "./contact-sales.service";

@Controller("contact-sales")
export class ContactSalesController {
  constructor(private readonly contactSales: ContactSalesService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3600_000 } })
  async submitInquiry(@Body() data: Record<string, any>) {
    return this.contactSales.submitInquiry(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  async getInquiries(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("status") status?: string,
  ) {
    return this.contactSales.getInquiries(workspaceId, status);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  async updateStatus(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.contactSales.updateInquiryStatus(workspaceId, id, status);
  }
}
