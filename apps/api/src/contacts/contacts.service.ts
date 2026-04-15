import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /contacts ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string, filters: FilterContactsDto) {
    const { q, type, tag, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };

    if (type) where.type = type;

    if (q) {
      where.OR = [
        { full_name:    { contains: q, mode: 'insensitive' } },
        { company_name: { contains: q, mode: 'insensitive' } },
        { email:        { contains: q, mode: 'insensitive' } },
        { phone:        { contains: q, mode: 'insensitive' } },
        { external_ref: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (tag) {
      // Filtra sobre el array JSON de tags
      where.tags_json = { array_contains: tag };
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { last_interaction_at: 'desc' },
        select: {
          id: true,
          type: true,
          full_name: true,
          company_name: true,
          email: true,
          phone: true,
          external_ref: true,
          tags_json: true,
          last_interaction_at: true,
          created_at: true,
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ── POST /contacts ─────────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateContactDto) {
    // Evitar duplicados por email dentro del mismo workspace
    if (dto.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { workspace_id: workspaceId, email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un contacto con el email ${dto.email} en este workspace.`,
        );
      }
    }

    return this.prisma.contact.create({
      data: {
        workspace_id:  workspaceId,
        type:          dto.type ?? 'CUSTOMER',
        full_name:     dto.full_name,
        company_name:  dto.company_name,
        email:         dto.email,
        phone:         dto.phone,
        external_ref:  dto.external_ref,
        tags_json:     dto.tags ?? [],
      },
    });
  }

  // ── GET /contacts/:id ──────────────────────────────────────────────────────

  async findOne(workspaceId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        conversations: {
          select: {
            id: true, subject: true, status: true,
            priority: true, last_message_at: true,
          },
          orderBy: { last_message_at: 'desc' },
          take: 10,
        },
        tasks: {
          select: {
            id: true, title: true, status: true, priority: true, due_at: true,
          },
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { due_at: 'asc' },
          take: 10,
        },
        documents: {
          select: {
            id: true, file_name: true, mime_type: true,
            status: true, created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!contact) throw new NotFoundException('Contacto no encontrado.');
    return contact;
  }

  // ── PATCH /contacts/:id ────────────────────────────────────────────────────

  async update(workspaceId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(workspaceId, id); // valida existencia

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.type         && { type: dto.type }),
        ...(dto.full_name    && { full_name: dto.full_name }),
        ...(dto.company_name !== undefined && { company_name: dto.company_name }),
        ...(dto.email        !== undefined && { email: dto.email }),
        ...(dto.phone        !== undefined && { phone: dto.phone }),
        ...(dto.external_ref !== undefined && { external_ref: dto.external_ref }),
        ...(dto.tags         !== undefined && { tags_json: dto.tags }),
        updated_at: new Date(),
      },
    });
  }

  // ── DELETE /contacts/:id ───────────────────────────────────────────────────
  // Soft-delete: no borramos, desasociamos del workspace (o puedes marcar con status)

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id); // valida existencia
    await this.prisma.contact.delete({ where: { id } });
    return { message: 'Contacto eliminado.' };
  }

  // ── Helper interno — actualizar last_interaction_at ────────────────────────

  async touchInteraction(contactId: string) {
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { last_interaction_at: new Date() },
    });
  }
}
