import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateOrderDto, UpdateOrderDto } from "./dto/create-order.dto";

const ORDER_INCLUDE = {
  contact: { select: { id: true, full_name: true, phone: true } },
  assigned_user: { select: { id: true, name: true } },
  conversation: { select: { id: true, subject: true } },
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(workspaceId: string, filters?: { status?: string; search?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (filters?.status && filters.status !== "ALL") {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    return this.prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { received_at: "desc" },
      take: 100,
    });
  }

  async getById(workspaceId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, workspace_id: workspaceId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Pedido no encontrado.");
    return order;
  }

  async create(workspaceId: string, dto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        workspace_id: workspaceId,
        title: dto.title,
        description: dto.description,
        contact_id: dto.contact_id ?? null,
        conversation_id: dto.conversation_id ?? null,
        assigned_user_id: dto.assigned_user_id ?? null,
        amount: dto.amount ?? null,
        currency: dto.currency ?? "CRC",
        notes: dto.notes ?? null,
        status: "RECEIVED",
        received_at: new Date(),
      },
      include: ORDER_INCLUDE,
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.getById(workspaceId, id);

    const data: any = { ...dto };
    delete data.status; // status changes go through transition methods

    return this.prisma.order.update({
      where: { id },
      data,
      include: ORDER_INCLUDE,
    });
  }

  // ── Status transitions ────────────────────────────────────────────────────

  async markProcessing(workspaceId: string, id: string) {
    const order = await this.getById(workspaceId, id);
    if (order.status !== "RECEIVED") {
      throw new BadRequestException(
        `Solo pedidos RECEIVED pueden pasar a PROCESSING. Actual: ${order.status}`,
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: "PROCESSING" },
      include: ORDER_INCLUDE,
    });
  }

  async markCompleted(workspaceId: string, id: string) {
    const order = await this.getById(workspaceId, id);
    if (order.status !== "PROCESSING") {
      throw new BadRequestException(
        `Solo pedidos PROCESSING pueden completarse. Actual: ${order.status}`,
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: "COMPLETED", completed_at: new Date() },
      include: ORDER_INCLUDE,
    });
  }

  async markCancelled(workspaceId: string, id: string, reason?: string) {
    const order = await this.getById(workspaceId, id);
    if (order.status === "COMPLETED") {
      throw new BadRequestException("No se puede cancelar un pedido ya completado.");
    }
    return this.prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancellation_reason: reason || null,
      },
      include: ORDER_INCLUDE,
    });
  }

  async reopen(workspaceId: string, id: string) {
    const order = await this.getById(workspaceId, id);
    if (order.status !== "CANCELLED") {
      throw new BadRequestException(
        `Solo pedidos CANCELLED pueden reabrirse. Actual: ${order.status}`,
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: {
        status: "RECEIVED",
        cancelled_at: null,
        cancellation_reason: null,
        completed_at: null,
        received_at: new Date(),
      },
      include: ORDER_INCLUDE,
    });
  }

  // ── Dashboard stats ───────────────────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [byStatus, revenue, recentOrders] = await Promise.all([
      // Count by status
      this.prisma.order.groupBy({
        by: ["status"],
        where: { workspace_id: workspaceId },
        _count: { id: true },
      }),
      // Revenue this month (completed orders)
      this.prisma.order.aggregate({
        where: {
          workspace_id: workspaceId,
          status: "COMPLETED",
          completed_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      // 5 most recent
      this.prisma.order.findMany({
        where: { workspace_id: workspaceId },
        include: {
          contact: { select: { id: true, full_name: true } },
        },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) {
      statusCounts[s.status] = s._count.id;
    }

    return {
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      byStatus: {
        received: statusCounts["RECEIVED"] || 0,
        processing: statusCounts["PROCESSING"] || 0,
        completed: statusCounts["COMPLETED"] || 0,
        cancelled: statusCounts["CANCELLED"] || 0,
      },
      revenueThisMonth: Number(revenue._sum.amount ?? 0),
      recentOrders,
    };
  }
}
