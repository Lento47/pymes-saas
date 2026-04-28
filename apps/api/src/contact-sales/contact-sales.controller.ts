import { Controller, Get, Post, Put, Param, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContactSalesService } from './contact-sales.service';

@Controller('contact-sales')
export class ContactSalesController {
  constructor(private readonly contactSales: ContactSalesService) {}

  @Post()
  async submitInquiry(@Body() data: any) {
    return this.contactSales.submitInquiry(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getInquiries(@Query('status') status?: string) {
    return this.contactSales.getInquiries(status);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contactSales.updateInquiryStatus(id, status);
  }
}
