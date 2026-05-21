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
} from "@nestjs/common";
import { WorkspaceUserRole } from "@prisma/client";
import { ValidateUUIDPipe } from "../common/pipes/validate-uuid.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { InventoryService } from "./inventory.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("products")
  listProducts(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("search") search?: string,
    @Query("category_id") categoryId?: string,
    @Query("low_stock") lowStock?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.inventory.listProducts(workspaceId, {
      search,
      category_id: categoryId,
      low_stock: lowStock === "true",
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    });
  }

  @Get("products/low-stock")
  getLowStock(@CurrentUser("workspace_id") workspaceId: string) {
    return this.inventory.getLowStockProducts(workspaceId);
  }

  @Get("products/:id")
  getProduct(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.inventory.getProduct(workspaceId, id);
  }

  @Post("products")
  @Roles(WorkspaceUserRole.ADMIN)
  createProduct(@CurrentUser("workspace_id") workspaceId: string, @Body() dto: CreateProductDto) {
    return this.inventory.createProduct(workspaceId, dto);
  }

  @Patch("products/:id")
  @Roles(WorkspaceUserRole.ADMIN)
  updateProduct(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.inventory.updateProduct(workspaceId, id, dto);
  }

  @Delete("products/:id")
  @Roles(WorkspaceUserRole.ADMIN)
  archiveProduct(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.inventory.archiveProduct(workspaceId, id);
  }

  @Post("products/:id/adjust-stock")
  @Roles(WorkspaceUserRole.ADMIN)
  adjustStock(
    @CurrentUser("workspace_id") workspaceId: string,
    @CurrentUser("id") userId: string,
    @Param("id", ValidateUUIDPipe) productId: string,
    @Body() body: { quantity: number; reason?: string },
  ) {
    return this.inventory.adjustStock(
      workspaceId,
      productId,
      userId,
      body.quantity,
      body.reason || "",
    );
  }

  @Get("movements")
  getMovements(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("product_id") productId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.inventory.getMovements(
      workspaceId,
      productId,
      page ? +page : 1,
      limit ? +limit : 50,
    );
  }

  @Get("categories")
  listCategories(@CurrentUser("workspace_id") workspaceId: string) {
    return this.inventory.listCategories(workspaceId);
  }

  @Post("categories")
  @Roles(WorkspaceUserRole.ADMIN)
  createCategory(
    @CurrentUser("workspace_id") workspaceId: string,
    @Body() body: { name: string; description?: string; color?: string },
  ) {
    return this.inventory.createCategory(workspaceId, body);
  }

  @Patch("categories/:id")
  @Roles(WorkspaceUserRole.ADMIN)
  updateCategory(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
    @Body() body: { name?: string; description?: string; color?: string },
  ) {
    return this.inventory.updateCategory(workspaceId, id, body);
  }

  @Delete("categories/:id")
  @Roles(WorkspaceUserRole.ADMIN)
  deleteCategory(
    @CurrentUser("workspace_id") workspaceId: string,
    @Param("id", ValidateUUIDPipe) id: string,
  ) {
    return this.inventory.deleteCategory(workspaceId, id);
  }
}
