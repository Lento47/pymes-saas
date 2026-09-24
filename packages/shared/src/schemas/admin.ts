/**
 * The platform operator's surface — the third persona, and the only one that reads
 * across tenants.
 *
 * Two rules hold everywhere in this file:
 *
 * - **Every mutation writes an audit entry**, with the actor, the target, the before
 *   and after values and a reason. A suspension nobody can explain six months later
 *   is a suspension that gets reverted by whoever shouts loudest.
 * - **Admins read, they rarely write.** Nothing here lets an operator edit a
 *   business's products, price an order, or move money. Those are the business's
 *   calls; the operator's powers are visibility, suspension and refunds of last
 *   resort, and each of the three is a separate, logged action.
 */

import { z } from "zod";
import { BUSINESS_STATUSES } from "./business";
import { currencySchema, shortText } from "./common";

export const ADMIN_ACTIONS = [
	"business.suspend",
	"business.reactivate",
	"business.verify",
	"business.delete",
	"user.suspend",
	"user.reactivate",
	"user.grant_admin",
	"user.revoke_admin",
	"order.cancel",
	"order.refund",
	"product.unpublish",
	"payout.mark_paid",
	"category.create",
	"category.update",
	"category.delete",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];
export const adminActionSchema = z.enum(ADMIN_ACTIONS);

export const auditLogEntrySchema = z.object({
	id: z.string(),
	actorId: z.string(),
	actorName: z.string().nullable(),
	action: adminActionSchema,
	targetType: z.string(),
	targetId: z.string(),
	/** What it said before and after. Free-form because the targets differ; rendered as a diff. */
	before: z.unknown().nullable(),
	after: z.unknown().nullable(),
	reason: z.string().nullable(),
	createdAt: z.date(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

/**
 * A reason is required for every action that removes something from a real person:
 * their storefront, their account, or their money. The other actions may be silent.
 */
export const REASON_REQUIRED_ACTIONS: readonly AdminAction[] = [
	"business.suspend",
	"business.delete",
	"user.suspend",
	"order.cancel",
	"payout.mark_paid",
];

export const adminListInput = z.object({
	search: z.string().trim().max(120).optional(),
	status: z.array(z.enum(BUSINESS_STATUSES)).max(4).optional(),
	from: z.date().optional(),
	to: z.date().optional(),
	sort: z.enum(["newest", "name", "orders", "revenue"]).default("newest"),
	direction: z.enum(["asc", "desc"]).default("desc"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});
export type AdminListInput = z.infer<typeof adminListInput>;

export const adminBusinessRowSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	city: z.string(),
	status: z.enum(BUSINESS_STATUSES),
	isVerified: z.boolean(),
	currency: currencySchema,
	ownerName: z.string().nullable(),
	ownerEmail: z.string().nullable(),
	productCount: z.number().int().min(0),
	orderCount: z.number().int().min(0),
	/** Minor units, in the business's own currency — never summed across currencies. */
	grossVolumeMinor: z.number().int(),
	createdAt: z.date(),
	suspendedReason: z.string().nullable(),
});
export type AdminBusinessRow = z.infer<typeof adminBusinessRowSchema>;

export const adminUserRowSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	phone: z.string().nullable(),
	isAdmin: z.boolean(),
	isSuspended: z.boolean(),
	businessRoles: z.array(
		z.object({
			businessId: z.string(),
			businessName: z.string(),
			role: z.string(),
		}),
	),
	orderCount: z.number().int().min(0),
	createdAt: z.date(),
});
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminOrderRowSchema = z.object({
	id: z.string(),
	reference: z.string(),
	status: z.string(),
	businessName: z.string(),
	customerName: z.string(),
	totalMinor: z.number().int(),
	currency: currencySchema,
	paymentStatus: z.string(),
	placedAt: z.date(),
});
export type AdminOrderRow = z.infer<typeof adminOrderRowSchema>;

/**
 * Platform metrics. Money is grouped by currency and never added across them —
 * "₡4 200 000 + $1 300" has no answer, and the dashboard that renders one is the
 * dashboard an operator makes a decision on.
 */
export const adminMetricsSchema = z.object({
	businesses: z.object({
		total: z.number().int(),
		active: z.number().int(),
		suspended: z.number().int(),
		pendingVerification: z.number().int(),
	}),
	users: z.object({
		total: z.number().int(),
		admins: z.number().int(),
		suspended: z.number().int(),
	}),
	orders: z.object({
		total: z.number().int(),
		today: z.number().int(),
		active: z.number().int(),
		cancelledRate: z.number().min(0).max(1),
	}),
	volumeByCurrency: z.array(
		z.object({
			currency: currencySchema,
			grossMinor: z.number().int(),
			orderCount: z.number().int(),
		}),
	),
	/** New businesses per day, for the growth line. Dates are UTC days. */
	signupsSeries: z.array(
		z.object({ day: z.string(), count: z.number().int() }),
	),
	generatedAt: z.date(),
});
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;

export const adminActionInput = z.object({
	targetId: z.string(),
	reason: z.string().trim().max(500).optional(),
});
export type AdminActionInput = z.infer<typeof adminActionInput>;

export const adminCategoryInput = z.object({
	id: z.string().optional(),
	/** Spanish — the locale the marketplace opens in. */
	name: shortText(80),
	/**
	 * The English name. Absent and `null` are different facts, for the same reason `parentId`
	 * below says so: absent is "the form carried no English name", which leaves an existing
	 * one where it is, and `null` is the operator clearing it. `name_en` is nullable on the
	 * table, so a category may genuinely have one name and not the other.
	 */
	nameEn: z.string().trim().max(80).nullable().optional(),
	slug: z.string().trim().max(80).optional(),
	iconName: z.string().trim().max(60).optional(),
	/**
	 * Absent is not the same as `null` here. Absent is "the form carried no parent", which
	 * leaves an existing one where it is; `null` is the operator asking for this category to
	 * sit at the top level. Collapsing the two would detach a child every time someone
	 * corrected its name.
	 */
	parentId: z.string().nullable().optional(),
	sortOrder: z.number().int().min(0).max(999).default(0),
});
export type AdminCategoryInput = z.infer<typeof adminCategoryInput>;

/** A payout run. Recording that it happened is the point; moving the money is not this system's job yet. */
export const payoutSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	currency: currencySchema,
	amountMinor: z.number().int(),
	orderCount: z.number().int(),
	periodStart: z.date(),
	periodEnd: z.date(),
	status: z.enum(["PENDING", "PAID", "FAILED"]),
	paidAt: z.date().nullable(),
	method: z.string().nullable(),
	reference: z.string().nullable(),
});
export type Payout = z.infer<typeof payoutSchema>;
