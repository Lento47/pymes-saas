import { order as orderTable, product as productTable } from "@pymeshub/db";
import {
	type MerchantHome,
	orderListInput,
	productListInput,
} from "@pymeshub/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
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
	const [location, pulse, queue, preview, counts, pending] = await Promise.all([
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
			.select({ count: sql<number>`count(*)` })
			.from(orderTable)
			.where(
				and(
					eq(orderTable.businessId, businessId),
					eq(orderTable.locationId, locationId),
					eq(orderTable.status, "PENDING"),
				),
			),
	]);

	const pendingCount = Number(pending[0]?.count ?? 0);
	const productCounts = counts[0];
	const outOfStock = Number(productCounts?.outOfStock ?? 0);

	return {
		location,
		selectedLocation,
		pulse,
		attention: [
			...(pendingCount > 0
				? [
						{
							type: "new_order" as const,
							severity: "high" as const,
							count: pendingCount,
							action: { type: "OPEN_ORDERS" as const },
						},
					]
				: []),
			// Inventory is shared by the whole shop until stock is stored per branch.
			...(outOfStock > 0
				? [
						{
							type: "inventory_zero" as const,
							severity: "medium" as const,
							count: outOfStock,
							action: { type: "OPEN_CATALOG" as const },
						},
					]
				: []),
		],
		orders: queue.items,
		catalog: {
			active: Number(productCounts?.active ?? 0),
			draft: Number(productCounts?.draft ?? 0),
			outOfStock,
			products: preview.items,
		},
	};
}
