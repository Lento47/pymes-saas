import {
	orderItem as orderItemTable,
	order as orderTable,
	product as productTable,
} from "@pymeshub/db";
import {
	type MerchantHome,
	orderListInput,
	productListInput,
} from "@pymeshub/shared";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import * as businesses from "./businesses";
import type { BusinessContext } from "./helpers";
import * as locations from "./locations";
import * as orders from "./orders";
import * as products from "./products";

/** A single branch-scoped first read for the merchant app. */
export async function home(
	ctx: BusinessContext,
	locationId: string,
): Promise<MerchantHome> {
	const businessId = ctx.membership.businessId;
	const selectedLocation = await locations.status(ctx, locationId);
	const [
		location,
		pulse,
		queue,
		preview,
		counts,
		outOfStockProducts,
		pendingOrders,
	] = await Promise.all([
		businesses.settings(ctx, { businessId }),
		orders.stats(ctx, { businessId, locationId }),
		orders.queue(
			ctx,
			orderListInput.parse({
				role: "BUSINESS",
				businessId,
				locationId,
				activeOnly: true,
				limit: 5,
			}),
		),
		products.list(
			ctx,
			productListInput.parse({
				businessId,
				status: ["ACTIVE"],
				sort: "newest",
				limit: 3,
			}),
		),
		ctx.db
			.select({
				active: sql<number>`coalesce(sum(case when ${productTable.status} = 'ACTIVE' then 1 else 0 end), 0)`,
				draft: sql<number>`coalesce(sum(case when ${productTable.status} = 'DRAFT' then 1 else 0 end), 0)`,
				outOfStock: sql<number>`coalesce(sum(case when ${productTable.status} = 'ACTIVE' and ${productTable.trackInventory} = 1 and ${productTable.stockQuantity} = 0 then 1 else 0 end), 0)`,
			})
			.from(productTable)
			.where(
				and(
					eq(productTable.businessId, businessId),
					isNull(productTable.archivedAt),
				),
			),
		ctx.db
			.select({
				id: productTable.id,
				name: productTable.name,
				updatedAt: productTable.updatedAt,
			})
			.from(productTable)
			.where(
				and(
					eq(productTable.businessId, businessId),
					eq(productTable.status, "ACTIVE"),
					eq(productTable.trackInventory, true),
					lte(productTable.stockQuantity, 0),
					isNull(productTable.archivedAt),
				),
			)
			.orderBy(productTable.id),
		ctx.db
			.select({
				id: orderTable.id,
				reference: orderTable.reference,
				placedAt: orderTable.placedAt,
			})
			.from(orderTable)
			.where(
				and(
					eq(orderTable.businessId, businessId),
					eq(orderTable.locationId, locationId),
					eq(orderTable.status, "PENDING"),
				),
			)
			.orderBy(orderTable.placedAt, orderTable.id),
	]);

	const productCounts = counts[0];
	const outOfStock = Number(productCounts?.outOfStock ?? 0);
	const topProductRows = await ctx.db
		.select({
			name: orderItemTable.nameSnapshot,
			prepTimeMinutes: productTable.prepTimeMinutes,
			quantity: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)`,
		})
		.from(orderItemTable)
		.innerJoin(orderTable, eq(orderItemTable.orderId, orderTable.id))
		.leftJoin(productTable, eq(orderItemTable.productId, productTable.id))
		.where(
			and(
				eq(orderTable.businessId, businessId),
				eq(orderTable.locationId, locationId),
				gte(orderTable.placedAt, pulse.period.from),
				lte(orderTable.placedAt, pulse.period.to),
			),
		)
		.groupBy(orderItemTable.nameSnapshot, productTable.prepTimeMinutes)
		.orderBy(desc(sql`quantity`), orderItemTable.nameSnapshot)
		.limit(1);

	return {
		location,
		selectedLocation,
		pulse,
		attention: [
			...pendingOrders.map((order) => ({
				id: `alert:new_order:${order.id}`,
				type: "new_order" as const,
				severity: "warning" as const,
				entityId: order.id,
				title: `Nuevo pedido ${order.reference}`,
				action: "open_orders" as const,
				createdAt: order.placedAt,
			})),
			// Inventory is shared by the whole shop until stock is stored per branch.
			...outOfStockProducts.map((product) => ({
				id: `alert:inventory_zero:${product.id}`,
				type: "inventory_zero" as const,
				severity: "critical" as const,
				entityId: product.id,
				title: `Producto agotado: ${product.name}`,
				action: "open_inventory" as const,
				createdAt: product.updatedAt,
			})),
		],
		insights: {
			estimatedMarginPercent: null,
			topProduct: topProductRows[0]?.name ?? null,
			averagePreparationMinutes: Math.max(
				0,
				Number(topProductRows[0]?.prepTimeMinutes ?? location.prepTimeMinutes),
			),
			projectedPayoutMinor: Math.max(0, pulse.merchantNetSalesMinor),
		},
		orders: queue.items,
		catalog: {
			active: Number(productCounts?.active ?? 0),
			draft: Number(productCounts?.draft ?? 0),
			outOfStock,
			products: preview.items,
		},
	};
}
