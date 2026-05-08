import { WorkspaceUserRole } from '@prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ValidateUUIDPipe } from '../common/pipes/validate-uuid.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { FilterDocumentsDto } from './dto/filter-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /**
   * POST /documents/upload
   * multipart/form-data:
   *   - file: el archivo
   *   - contact_id?: string (opcional)
   *   - conversation_id?: string (opcional)
   *   - task_id?: string (opcional)
   */
  @Post('upload')
  @Roles(WorkspaceUserRole.AGENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // buffer en memoria → luego a S3
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('contact_id')      contact_id?: string,
    @Body('conversation_id') conversation_id?: string,
    @Body('task_id')         task_id?: string,
  ) {
    return this.planLimits
      .enforceDocuments(user.workspace_id, file?.size ?? 0)
      .then(() =>
        this.service.upload(
          user.workspace_id,
          user,
          file,
          { contact_id, conversation_id, task_id },
        )
      );
  }

  // ── Attachments (inbox media) ─────────────────────────────────────────

  @Post('upload-attachment')
  @Roles(WorkspaceUserRole.AGENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max for WhatsApp/Email attachments
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.service.uploadAttachment(user.workspace_id, user.id, file);
  }

  @Get()
  findAll(
    @CurrentUser('workspace_id') workspaceId: string,
    @Query() filters: FilterDocumentsDto,
  ) {
    return this.service.findAll(workspaceId, filters);
  }

  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  @Roles(WorkspaceUserRole.AGENT)
  update(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Post(':id/reprocess')
  @Roles(WorkspaceUserRole.ADMIN)
  reprocess(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.reprocess(workspaceId, id);
  }

  @Delete(':id')
  @Roles(WorkspaceUserRole.ADMIN)
  remove(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id', ValidateUUIDPipe) id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
