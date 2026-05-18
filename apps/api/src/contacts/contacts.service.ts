import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parseJsonValue, stringifyJson } from '../common/prisma/json';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  // ── GET /contacts ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string, filters: FilterContactsDto) {
    const { q, type, tag, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { workspace_id: workspaceId };

    if (type) where.type = type;

    if (q) {
      where.OR = [
        { full_name: { contains: q } },
        { company_name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { external_ref: { contains: q } },
      ];
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
          identification_type: true,
          identification_number: true,
          tax_email: true,
          province: true,
          canton: true,
          district: true,
          address_detail: true,
          foreign_identification: true,
          receptor_validation_json: true,
          external_ref: true,
          tags_json: true,
          last_interaction_at: true,
          created_at: true,
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    const normalizedData = data
      .map((contact) => ({
        ...contact,
        tags_json: parseJsonValue<string[]>(contact.tags_json, []),
      }))
      .filter((contact) => !tag || contact.tags_json.includes(tag));

    return {
      data: normalizedData,
      meta: {
        total: tag ? normalizedData.length : total,
        page,
        limit,
        pages: Math.ceil((tag ? normalizedData.length : total) / limit),
      },
    };
  }

  // ── POST /contacts ─────────────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateContactDto) {
    await this.planLimits.checkContactLimit(workspaceId);

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
        type:          (dto.type ?? 'CUSTOMER') as any,
        full_name:     dto.full_name,
        company_name:  dto.company_name,
        email:         dto.email,
        phone:         dto.phone,
        identification_type: dto.identification_type,
        identification_number: dto.identification_number,
        tax_email: dto.tax_email,
        province: dto.province,
        canton: dto.canton,
        district: dto.district,
        address_detail: dto.address_detail,
        foreign_identification: dto.foreign_identification,
        external_ref:  dto.external_ref,
        tags_json:     stringifyJson(dto.tags ?? []),
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
        ...(dto.identification_type !== undefined && { identification_type: dto.identification_type }),
        ...(dto.identification_number !== undefined && { identification_number: dto.identification_number }),
        ...(dto.tax_email !== undefined && { tax_email: dto.tax_email }),
        ...(dto.province !== undefined && { province: dto.province }),
        ...(dto.canton !== undefined && { canton: dto.canton }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.address_detail !== undefined && { address_detail: dto.address_detail }),
        ...(dto.foreign_identification !== undefined && { foreign_identification: dto.foreign_identification }),
        ...(dto.external_ref !== undefined && { external_ref: dto.external_ref }),
        ...(dto.tags         !== undefined && { tags_json: stringifyJson(dto.tags) }),
        updated_at: new Date(),
      } as any,
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
