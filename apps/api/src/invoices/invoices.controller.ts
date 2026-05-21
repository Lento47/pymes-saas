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
  Logger,
} from "@nestjs/common";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FeatureFlagGuard, RequireFeature } from "../feature-flags/feature-flags.guard";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { FilterInvoicesDto } from "./dto/filter-invoices.dto";
import { SendReminderDto } from "./dto/send-reminder.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { CreateInvoicePaymentDto } from "./dto/create-invoice-payment.dto";
import { InvoicesService } from "./invoices.service";
import { RemindersService } from "./reminders.service";
import { FeaturesService } from "../features/features.service";

@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly remindersService: RemindersService,
    private readonly features: FeaturesService,
  ) {}

  @Get()
  @Roles(WorkspaceUserRole.AGENT)
  findAll(@CurrentUser("workspace_id") workspaceId: string, @Query() filters: FilterInvoicesDto) {
    return this.invoicesService.findAll(workspaceId, filters);
  }

  @Post()
  @Roles(WorkspaceUserRole.AGENT)
  async create(@CurrentUser("workspace_id") workspaceId: string, @Body() dto: CreateInvoiceDto) {
    await this.features.assertEnabled(workspaceId, "billing");
    return this.invoicesService.create(workspaceId, dto);
  }

  @Get("overdue")
  @Roles(WorkspaceUserRole.AGENT)
  detectOverdue(@CurrentUser("workspace_id") workspaceId: string) {
    return this.remindersService.detectOverdue(workspaceId);
  }

  @Get("templates")
  @Roles(WorkspaceUserRole.AGENT)
  getTemplates(@CurrentUser("workspace_id") workspaceId: string) {
    return this.invoicesService.getTemplates(workspaceId);
  }

  @Get("pending-approvals")
  @Roles(WorkspaceUserRole.ADMIN)
  getPendingApprovals(@CurrentUser("workspace_id") workspaceId: string) {
    return this.invoicesService.getPendingApprovals(workspaceId);
  }

  @Get(":id")
  @Roles(WorkspaceUserRole.AGENT)
  findOne(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.findOne(workspaceId, id);
  }

  @Patch(":id")
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(workspaceId, id, dto);
  }

  @Post(":id/paid")
  @Roles(WorkspaceUserRole.AGENT)
  markPaid(@CurrentUser() user: AuthUser, @Param("id", ValidateUUIDPipe) id: string) {
    return this.invoicesService.markPaid(user.workspace_id, user.id, id);
  }

  @Post(":id/payments")
  @Roles(WorkspaceUserRole.AGENT)
  registerPayment(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: CreateInvoicePaymentDto,
  ) {
    return this.invoicesService.registerPayment(user.workspace_id, user.id, id, dto);
  }

  @Post(":id/submit")
  @Roles(WorkspaceUserRole.AGENT)
  @RequireFeature("hacienda")
  submitToHacienda(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.submitToHacienda(workspaceId, id);
  }

  @Get(":id/hacienda-status")
  @Roles(WorkspaceUserRole.AGENT)
  syncHaciendaStatus(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.syncHaciendaStatus(workspaceId, id);
  }

  @Delete(":id")
  @Roles(WorkspaceUserRole.AGENT)
  remove(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.remove(workspaceId, id);
  }

  @Post(":id/reminder")
  @Roles(WorkspaceUserRole.ADMIN)
  @RequireFeature("invoice_reminders")
  generateReminder(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.remindersService.generateReminder(workspaceId, id);
  }

  @Post(":id/reminder/send")
  @Roles(WorkspaceUserRole.ADMIN)
  @RequireFeature("invoice_reminders")
  sendReminder(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: SendReminderDto,
  ) {
    return this.remindersService.sendReminder(user.workspace_id, id, dto, user);
  }

  @Post(":id/credit-note")
  @Roles(WorkspaceUserRole.AGENT)
  @RequireFeature("credit_notes")
  createCreditNote(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.createCreditNote(workspaceId, id, dto);
  }

  @Post(":id/debit-note")
  @Roles(WorkspaceUserRole.AGENT)
  @RequireFeature("credit_notes")
  createDebitNote(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.createDebitNote(workspaceId, id, dto);
  }

  @Post(":id/receiver-message")
  @Roles(WorkspaceUserRole.AGENT)
  createReceiverMessage(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: { number?: string; description?: string; notes?: unknown[] },
  ) {
    return this.invoicesService.createReceiverMessage(workspaceId, id, dto);
  }

  @Post(":id/hacienda-validate")
  @Roles(WorkspaceUserRole.AGENT)
  @RequireFeature("hacienda")
  validateForHacienda(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.validateForHacienda(workspaceId, id);
  }

  @Get(":id/hacienda-error-explain")
  @Roles(WorkspaceUserRole.AGENT)
  explainHaciendaError(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.explainHaciendaError(workspaceId, id);
  }

  @Get(":id/xml-preview")
  @Roles(WorkspaceUserRole.AGENT)
  getXmlPreview(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.invoicesService.getXmlPreview(workspaceId, id);
  }

  @Post(":id/approve")
  @Roles(WorkspaceUserRole.ADMIN)
  approveInvoice(@CurrentUser() user: AuthUser, @Param("id", ValidateUUIDPipe) id: string) {
    return this.invoicesService.approveInvoice(user.workspace_id, user.id, id);
  }

  @Post(":id/reject")
  @Roles(WorkspaceUserRole.ADMIN)
  rejectInvoice(
    @CurrentUser() user: AuthUser,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body("reason") reason: string,
  ) {
    return this.invoicesService.rejectInvoice(user.workspace_id, id, reason);
  }
}
