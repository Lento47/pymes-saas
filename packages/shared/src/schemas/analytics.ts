/**
 * What a business sees about itself, over a window it chooses.
 *
 * Two rules shape the whole file:
 *
 * - **One currency, because one business has one.** A business is priced in the
 *   currency it was created with, so its own dashboard may add its own amounts —
 *   unlike `admin.metrics`, which reads across tenants and therefore has to group by
 *   currency before it sums anything.
 * - **Every figure is a count, a stored amount or a direct duration.** Nothing here
 *   is a projection or a conversion, because a dashboard that invents a number is a
 *   dashboard an owner makes a decision on. Sales count completed orders, when cash
 *   and SINPE orders become paid; orders still in flight remain in order counts.
 */

import { z } from "zod";
import { currencySchema } from "./common";

export const businessAnalyticsSchema = z.object({
	from: z.date(),
	to: z.date(),
	currency: currencySchema,
	sales: z.object({
		/**
		 * Full totals of orders marked REFUNDED. Refunds have no amount of their own in
		 * the order model, so partial refunds cannot be represented here yet.
		 */
		refunds_minor: z.number().int().min(0),
		/** Stored checkout discounts on completed orders. */
		discounts_minor: z.number().int().min(0),
	}),
	orders: z.object({
		total: z.number().int().min(0),
		accepted: z.number().int().min(0),
		completed: z.number().int().min(0),
		cancelled: z.number().int().min(0),
		active: z.number().int().min(0),
	}),
	revenue: z.object({
		/** Completed order totals, before any recorded refund. */
		grossMinor: z.number().int(),
		/** Operational net sales: gross less recorded full-order refunds, never negative. */
		netMinor: z.number().int(),
	}),
	operations: z.object({
		/** Placement to acceptance, averaged over accepted orders. */
		avg_accept_seconds: z.number().int().min(0).nullable(),
		/** Acceptance to ready, averaged over ready orders. */
		avg_preparation_seconds: z.number().int().min(0).nullable(),
	}),
	/**
	 * Integer minor units, or null over a window with no completed orders. Null rather than
	 * zero: "₡0 average" reads as a collapse, and the truth is that nothing happened.
	 */
	averageOrderMinor: z.number().int().nullable(),
	customers: z.object({
		/** Distinct customers with a completed order in the window. */
		total: z.number().int().min(0),
		/** Those with more than one — the number an owner actually acts on. */
		repeat: z.number().int().min(0),
	}),
	/** Newest first is the wrong shape for a chart; the API returns them oldest first. */
	ordersByDay: z.array(
		z.object({
			/**
			 * The bucket key in Costa Rica wall time, at the granularity the read asked
			 * for: `YYYY-MM-DD HH:00` hourly, `YYYY-MM-DD` daily (the default every
			 * caller that does not ask receives), `YYYY-MM` monthly.
			 */
			day: z.string(),
			orderCount: z.number().int().min(0),
			revenueMinor: z.number().int(),
		}),
	),
	/** By units sold, which is what a menu is reordered on. Empty days are omitted. */
	topProducts: z.array(
		z.object({
			productId: z.string(),
			name: z.string(),
			quantity: z.number().int().min(0),
			revenueMinor: z.number().int(),
		}),
	),
});
export type BusinessAnalytics = z.infer<typeof businessAnalyticsSchema>;
