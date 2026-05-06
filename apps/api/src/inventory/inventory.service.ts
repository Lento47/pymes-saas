import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async listProducts(workspaceId: string, filters: { search?: string; category_id?: string; low_stock?: boolean; page?: number; limit?: number }) {
    const where: any = { workspace_id: workspaceId };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.low_stock) {
      where.track_inventory = true;
      where.type = 'PRODUCT';
      where.current_stock = { lte: this.prisma.product.fields.min_stock };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.prisma as any).product.findMany({
        where,
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getProduct(workspaceId: string, id: string) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id, workspace_id: workspaceId },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async createProduct(workspaceId: string, dto: CreateProductDto) {
    await this.planLimits.enforceProductCount(workspaceId);

    const existing = await (this.prisma as any).product.findFirst({
      where: { workspace_id: workspaceId, sku: dto.sku },
    });
    if (existing) throw new BadRequestException('Ya existe un producto con ese SKU');

    return (this.prisma as any).product.create({
      data: {
        workspace_id: workspaceId,
        category_id: dto.category_id || null,
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        type: dto.type || 'PRODUCT',
        unit_price: dto.unit_price,
        cost_price: dto.cost_price,
        current_stock: dto.current_stock || 0,
        min_stock: dto.min_stock || 0,
        unit_of_measure: dto.unit_of_measure,
        track_inventory: dto.track_inventory ?? true,
        is_active: dto.is_active ?? true,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async updateProduct(workspaceId: string, id: string, dto: UpdateProductDto) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await (this.prisma as any).product.findFirst({
        where: { workspace_id: workspaceId, sku: dto.sku, NOT: { id } },
      });
      if (existing) throw new BadRequestException('Ya existe otro producto con ese SKU');
    }

    return (this.prisma as any).product.update({
      where: { id },
      data: {
        ...(dto.category_id !== undefined && { category_id: dto.category_id || null }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.unit_price !== undefined && { unit_price: dto.unit_price }),
        ...(dto.cost_price !== undefined && { cost_price: dto.cost_price }),
        ...(dto.min_stock !== undefined && { min_stock: dto.min_stock }),
        ...(dto.unit_of_measure !== undefined && { unit_of_measure: dto.unit_of_measure }),
        ...(dto.track_inventory !== undefined && { track_inventory: dto.track_inventory }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async archiveProduct(workspaceId: string, id: string) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return (this.prisma as any).product.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async adjustStock(workspaceId: string, productId: string, userId: string, quantity: number, reason: string) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id: productId, workspace_id: workspaceId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.track_inventory || product.type === 'SERVICE') {
      throw new BadRequestException('Este producto no tiene control de inventario');
    }

    const previousStock = product.current_stock;
    const newStock = previousStock + quantity;
    if (newStock < 0) throw new BadRequestException('El stock no puede ser negativo');

    await (this.prisma as any).product.update({
      where: { id: productId },
      data: { current_stock: newStock },
    });

    return (this.prisma as any).stockMovement.create({
      data: {
        workspace_id: workspaceId,
        product_id: productId,
        type: quantity > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(quantity),
        previous_stock: previousStock,
        new_stock: newStock,
        reason: reason || 'Ajuste manual',
        reference_type: 'manual',
        user_id: userId,
      },
    });
  }

  async getMovements(workspaceId: string, productId?: string, page = 1, limit = 50) {
    const where: any = { workspace_id: workspaceId };
    if (productId) where.product_id = productId;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.prisma as any).stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).stockMovement.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async listCategories(workspaceId: string) {
    return (this.prisma as any).productCategory.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(workspaceId: string, data: { name: string; description?: string; color?: string }) {
    await this.planLimits.enforceCategoryCount(workspaceId);
    return (this.prisma as any).productCategory.create({
      data: { workspace_id: workspaceId, name: data.name, description: data.description, color: data.color },
    });
  }

  async updateCategory(workspaceId: string, id: string, data: { name?: string; description?: string; color?: string }) {
    return (this.prisma as any).productCategory.update({
      where: { id },
      data: { ...data },
    });
  }

  async deleteCategory(workspaceId: string, id: string) {
    const count = await (this.prisma as any).product.count({
      where: { category_id: id, workspace_id: workspaceId },
    });
    if (count > 0) throw new BadRequestException('No se puede eliminar una categoría con productos');
    return (this.prisma as any).productCategory.delete({ where: { id } });
  }

  async getLowStockProducts(workspaceId: string) {
    return (this.prisma as any).product.findMany({
      where: {
        workspace_id: workspaceId,
        track_inventory: true,
        type: 'PRODUCT',
        is_active: true,
        current_stock: { lte: (this.prisma as any).product.fields.min_stock },
      },
      orderBy: { current_stock: 'asc' },
      take: 5,
      select: { id: true, name: true, sku: true, current_stock: true, min_stock: true, unit_of_measure: true },
    });
  }
}
