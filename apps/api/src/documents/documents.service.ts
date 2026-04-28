import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { FilterDocumentsDto } from './dto/filter-documents.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AutomationsService } from '../automations/automations.service';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly automationsService: AutomationsService,
  ) {}

  // ── POST /documents/upload ─────────────────────────────────────────────────

  async upload(
    workspaceId: string,
    user: AuthUser,
    file: Express.Multer.File,
    metadata: { contact_id?: string; conversation_id?: string; task_id?: string },
  ) {
    // Validaciones
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('El archivo supera el límite de 25 MB.');
    }

    // Validar que contact/conversation/task pertenecen al workspace
    if (metadata.contact_id) {
      const c = await this.prisma.contact.findFirst({
        where: { id: metadata.contact_id, workspace_id: workspaceId },
      });
      if (!c) throw new NotFoundException('Contacto no encontrado.');
    }
    if (metadata.conversation_id) {
      const c = await this.prisma.conversation.findFirst({
        where: { id: metadata.conversation_id, workspace_id: workspaceId },
      });
      if (!c) throw new NotFoundException('Conversación no encontrada.');
    }
    if (metadata.task_id) {
      const t = await this.prisma.task.findFirst({
        where: { id: metadata.task_id, workspace_id: workspaceId },
      });
      if (!t) throw new NotFoundException('Tarea no encontrada.');
    }

    // Crear registro en DB con status UPLOADED
    const doc = await this.prisma.document.create({
      data: {
        workspace_id:        workspaceId,
        contact_id:          metadata.contact_id,
        conversation_id:     metadata.conversation_id,
        file_name:           file.originalname,
        mime_type:           file.mimetype,
        storage_key:         'pending', // se actualiza después del upload a S3
        file_size:           file.size,
        status:              'UPLOADED',
        uploaded_by_user_id: user.id,
      },
    });

    // Subir a S3/MinIO
    const key = this.storage.buildKey(workspaceId, doc.id, file.originalname);
    await this.storage.upload(key, file.buffer, file.mimetype);

    // Actualizar storage_key en DB
    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data:  { storage_key: key, status: 'UPLOADED' },
    });

    // TODO: encolar en BullMQ para OCR + clasificación
    // await this.documentQueue.add('process', { documentId: doc.id });

    await this.automationsService.triggerRules(
      workspaceId,
      'DOCUMENT_UPLOADED',
      'document',
      updated.id,
    );

    return updated;
  }

  // ── GET /documents ─────────────────────────────────────────────────────────

  async findAll(workspaceId: string, filters: FilterDocumentsDto) {
    const { status, contact_id, conversation_id, mime_type, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };
    if (status)          where.status          = status;
    if (contact_id)      where.contact_id      = contact_id;
    if (conversation_id) where.conversation_id = conversation_id;
    if (mime_type)       where.mime_type       = { contains: mime_type };
    if (q)               where.file_name       = { contains: q, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true, file_name: true, mime_type: true,
          file_size: true, status: true, created_at: true,
          contact:      { select: { id: true, full_name: true } },
          conversation: { select: { id: true, subject: true } },
          uploaded_by:  { select: { id: true, name: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── GET /documents/:id ─────────────────────────────────────────────────────

  async findOne(workspaceId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        contact:      { select: { id: true, full_name: true } },
        conversation: { select: { id: true, subject: true } },
        uploaded_by:  { select: { id: true, name: true } },
      },
    });

    if (!doc) throw new NotFoundException('Documento no encontrado.');

    // Generar URL de descarga firmada (válida 1 hora)
    const download_url = await this.storage.getPresignedUrl(doc.storage_key, 3600);

    return { ...doc, download_url };
  }

  // ── PATCH /documents/:id ───────────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateDocumentDto) {
    await this.findOne(workspaceId, id);

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.contact_id      !== undefined && { contact_id: dto.contact_id }),
        ...(dto.conversation_id !== undefined && { conversation_id: dto.conversation_id }),
        updated_at: new Date(),
      },
    });
  }

  // ── POST /documents/:id/reprocess ─────────────────────────────────────────

  async reprocess(workspaceId: string, id: string) {
    const doc = await this.findOne(workspaceId, id);

    await this.prisma.document.update({
      where: { id },
      data:  { status: 'PROCESSING', updated_at: new Date() },
    });

    // TODO: re-encolar en BullMQ
    // await this.documentQueue.add('process', { documentId: id, force: true });

    return { message: 'Documento encolado para reprocesamiento.', id };
  }

  // ── DELETE /documents/:id ─────────────────────────────────────────────────

  async remove(workspaceId: string, id: string) {
    const doc = await this.findOne(workspaceId, id);
    await this.storage.delete(doc.storage_key);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Documento eliminado.' };
  }
}
