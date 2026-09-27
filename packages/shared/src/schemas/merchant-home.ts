import { z } from "zod";

import { businessSettingsSchema } from "./business";
import { productCardSchema } from "./catalog";
import { merchantLocationSchema } from "./location";
import { operationalPulseSchema, orderSummarySchema } from "./order";

export const MERCHANT_ALERT_TYPES = [
	"new_order",
	"order_delay",
	"inventory_low",
	"inventory_zero",
	"store_offline",
	"payment_issue",
	"settlement_issue",
	"catalog_issue",
] as const;
export type MerchantAlertType = (typeof MERCHANT_ALERT_TYPES)[number];

export const MERCHANT_ALERT_SEVERITIES = [
	"critical",
	"warning",
	"info",
] as const;
export type MerchantAlertSeverity =
	(typeof MERCHANT_ALERT_SEVERITIES)[number];

export const MERCHANT_ALERT_ACTIONS = [
	"open_orders",
	"open_catalog",
	"open_inventory",
	"open_settings",
	"open_payouts",
	"retry_payment",
	"contact_support",
] as const;
export type MerchantAlertAction = (typeof MERCHANT_ALERT_ACTIONS)[number];

export const merchantAlertSchema = z.object({
	id: z.string().min(1),
	type: z.enum(MERCHANT_ALERT_TYPES),
	severity: z.enum(MERCHANT_ALERT_SEVERITIES),
	entityId: z.string().optional(),
	title: z.string().min(1),
	description: z.string().optional(),
	action: z.enum(MERCHANT_ALERT_ACTIONS).optional(),
	createdAt: z.date(),
});
export type MerchantAlert = z.infer<typeof merchantAlertSchema>;

/** One branch-scoped read for the merchant's first screen. */
export const merchantHomeSchema = z.object({
	/** Shop settings and currency, shared by every branch. */
	location: businessSettingsSchema,
	selectedLocation: merchantLocationSchema,
	pulse: operationalPulseSchema,
	attention: z.array(merchantAlertSchema),
	insights: z.object({
		estimatedMarginPercent: z.number().min(0).max(100).nullable(),
		topProduct: z.string().nullable(),
		averagePreparationMinutes: z.number().min(0).nullable(),
		projectedPayoutMinor: z.number().int().min(0).nullable(),
	}),
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
