import { z } from "zod";

import { businessSettingsSchema } from "./business";
import { productCardSchema } from "./catalog";
import { merchantLocationSchema } from "./location";
import { orderStatsSchema, orderSummarySchema } from "./order";

/** One branch-scoped read for the merchant's first screen. */
export const merchantHomeSchema = z.object({
	/** Shop settings and currency, shared by every branch. */
	location: businessSettingsSchema,
	selectedLocation: merchantLocationSchema,
	pulse: orderStatsSchema,
	attention: z.array(
		z.object({
			type: z.enum(["new_order", "inventory_zero"]),
			severity: z.enum(["high", "medium"]),
			count: z.number().int().min(1),
			action: z.object({ type: z.enum(["OPEN_ORDERS", "OPEN_CATALOG"]) }),
		}),
	),
	orders: z.array(orderSummarySchema),
	/** Products and inventory remain shared across every branch of the shop. */
	catalog: z.object({
		active: z.number().int().min(0),
		draft: z.number().int().min(0),
		outOfStock: z.number().int().min(0),
		products: z.array(productCardSchema),
	}),
});
export type MerchantHome = z.infer<typeof merchantHomeSchema>;
