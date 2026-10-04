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
import { PRODUCT_STATUSES, PROMOTION_KINDS } from "./catalog";
import { currencySchema, imageUrlSchema, shortText } from "./common";
import {
	COURIER_INVITE_STATUSES,
	COURIER_VERIFICATION_STATUSES,
	courierProfileSchema,
} from "./courier";

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
	/**
	 * Was `payout.mark_paid`. Recording that a merchant paid is still an audited act —
	 * it is money — so the action survives under a name that matches the model. There
	 * is no `payout.*` action left because there is no payout: the consumer pays the
	 * merchant and the courier, and the platform invoices a flat subscription.
	 */
	"subscription.record_payment",
	"subscription.create_price_book",
	"category.create",
	"category.update",
	"category.delete",
	"courier.verify",
	"courier.reject",
	/**
	 * Answering a merchant's support ticket, and closing one. Audited rather than left as
	 * conversation: a `support.reply` row is the record of what PymesHub told a shop and
	 * when, which outlives the ticket row and is what makes a disputed answer checkable
	 * later. The other support acts — a merchant raising a ticket, a merchant replying, a
	 * merchant marking a question `WAITING` — are not in this set on purpose: they are the
	 * merchant's own words on their own thread, and an operator did not perform them.
	 */
	"support.reply",
	"support.resolve",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];
export const adminActionSchema = z.enum(ADMIN_ACTIONS);

export const auditLogEntrySchema = z.object({
	id: z.string(),
	actorId: z.string(),
	actorName: z.string().nullable(),
	action: z.string(),
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
	/**
	 * Taking the platform flag back is a removal, and it is the **only** sanctioned way to
	 * demote somebody now that `revokeAdmin` exists — so a demotion with no recorded
	 * justification would be a permanent hole in the audit trail rather than a gap.
	 *
	 * The opposite act is deliberately not here. `user.grant_admin` requires no reason and
	 * `user.reactivate` requires none, because both *add* access: making an operator justify
	 * a promotion or a reinstatement punishes the correction and excuses the original.
	 */
	"user.revoke_admin",
	"order.cancel",
	"product.unpublish",
	"subscription.record_payment",
	/**
	 * A price rise changes what every future merchant pays, so it carries a reason the
	 * same way removing a storefront does. Without one, "why is everyone being charged
	 * ₡20,000" has no answer in the audit log, which is the only place it can be
	 * answered from.
	 */
	"subscription.create_price_book",
	"courier.reject",
	/**
	 * A category is the marketplace's first tile for a whole sector, and deleting one
	 * removes it from the navigation every customer sees. It is here because the console
	 * was already asking an operator to type a reason, discarding it, and writing the audit
	 * row with `reason: null` — a field collected for the record and dropped before it
	 * reached it. With this entry the dialog the operator already sees is the one the
	 * policy asks for, rather than a coincidence.
	 */
	"category.delete",
];

/**
 * The shortest reason that still says anything.
 *
 * `REASON_REQUIRED_ACTIONS` decides *whether* a reason is required; this decides how long
 * one has to be. It sits beside the list rather than in each schema's `min(8)` because a
 * console field enforcing a different number than the API refuses is a field that either
 * blocks a valid reason or accepts one the server discards — which is the
 * `REASON_REQUIRED` drift in `apps/web/client/src/lib/admin.ts` all over again, one
 * number smaller. Eight characters is roughly the shortest thing that is a clause rather
 * than a word, and the reason is read by whoever has to justify this in six months.
 */
export const REASON_MIN_LENGTH = 8;

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

export const adminCourierListInput = z.object({
	search: z.string().trim().max(120).optional(),
	status: z.enum(COURIER_VERIFICATION_STATUSES).optional(),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(25),
});
export type AdminCourierListInput = z.infer<typeof adminCourierListInput>;

export const adminCourierRowSchema = courierProfileSchema.extend({
	userName: z.string(),
	userEmail: z.string(),
	reviewedAt: z.date().nullable(),
	reviewedByUserId: z.string().nullable(),
});
export type AdminCourierRow = z.infer<typeof adminCourierRowSchema>;

export const adminCourierDecisionInput = z.object({
	profileId: z.string(),
	decision: z.enum(["VERIFIED", "REJECTED"]),
	reason: z.string().trim().max(500).optional(),
});
export type AdminCourierDecisionInput = z.infer<
	typeof adminCourierDecisionInput
>;

export const adminCourierInviteRowSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	courierUserId: z.string(),
	courierName: z.string(),
	profileId: z.string(),
	status: z.enum(COURIER_INVITE_STATUSES),
	createdAt: z.date(),
	expiresAt: z.date(),
	respondedAt: z.date().nullable(),
});
export type AdminCourierInviteRow = z.infer<typeof adminCourierInviteRowSchema>;

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
 * One business, with the two things its row cannot carry.
 *
 * A separate schema rather than `adminBusinessRowSchema.extend(...)` because this is a
 * different answer, not a richer one: `admin.business` returns the row **plus** its ten
 * most recent orders and the twenty-five audit entries that touched it, so the row schema
 * is the `business` key of this object and nothing else.
 *
 * It is here, in shared, rather than declared in the console because a composite built in
 * `apps/web` out of shared schemas cannot type-check there — two zod copies in the graph,
 * which `apps/web/client/src/lib/admin.ts` documents at length.
 *
 * **Declared after `adminOrderRowSchema` on purpose.** It reads three schemas, and zod
 * evaluates a shape when the schema is constructed rather than when it is parsed, so a
 * declaration placed next to `adminBusinessRowSchema` would reference `adminOrderRowSchema`
 * inside its temporal dead zone. That is a `ReferenceError` at import time, not a type
 * error — the failure would surface as the console failing to load, not as a build.
 *
 * The reason this exists at all: the console parsed this envelope *as* `adminBusinessRowSchema`,
 * which is a plain `z.object` and therefore strips what it does not know and throws on
 * what it requires. Every "Ver ficha" on the platform raised a `ZodError` and rendered its
 * error state. `packages/trpc-api/test/admin-contract.test.ts` now pins the service's real
 * return value against this schema.
 */
export const adminBusinessDetailSchema = z.object({
	business: adminBusinessRowSchema,
	recentOrders: z.array(adminOrderRowSchema),
	auditLog: z.array(auditLogEntrySchema),
});
export type AdminBusinessDetail = z.infer<typeof adminBusinessDetailSchema>;

/**
 * One person, with everything the console needs to answer "what is wrong with this account".
 *
 * The same envelope shape as `adminBusinessDetailSchema`, and for the same reason: the
 * service returns `{ user, courierProfile, recentOrders, auditLog }`, so the row schema is
 * the `user` key of this object and nothing else. Parsing it as a bare row throws.
 *
 * `courierProfile` is nullable and deliberately **not** optional: a person with no courier
 * profile is a normal state — most customers never become one — so the answer is `null`
 * rather than an absent key, and the console can tell "not a courier" from "the API forgot".
 *
 * A courier's audit trail is folded into `auditLog` rather than nested, because the console
 * shows one list and the service already merges and sorts the two by `createdAt`.
 */
export const adminUserDetailSchema = z.object({
	user: adminUserRowSchema,
	courierProfile: adminCourierRowSchema.nullable(),
	recentOrders: z.array(adminOrderRowSchema),
	auditLog: z.array(auditLogEntrySchema),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminProductRowSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	categoryId: z.string().nullable(),
	categoryName: z.string().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	imageUrl: z.string().nullable(),
	sku: z.string().nullable(),
	priceMinor: z.number().int(),
	currency: currencySchema,
	status: z.enum(PRODUCT_STATUSES),
	isFeatured: z.boolean(),
	ratingAvg: z.number(),
	ratingCount: z.number().int().min(0),
	soldCount: z.number().int().min(0),
	stockQuantity: z.number().int().min(0),
	trackInventory: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type AdminProductRow = z.infer<typeof adminProductRowSchema>;

export const adminPromotionRowSchema = z.object({
	id: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	code: z.string(),
	kind: z.enum(PROMOTION_KINDS),
	value: z.number().int(),
	currency: currencySchema,
	isActive: z.boolean(),
	minOrderMinor: z.number().int().nullable(),
	maxRedemptions: z.number().int().nullable(),
	redemptions: z.number().int().min(0),
	startsAt: z.date().nullable(),
	endsAt: z.date().nullable(),
});
export type AdminPromotionRow = z.infer<typeof adminPromotionRowSchema>;

export const adminReviewRowSchema = z.object({
	id: z.string(),
	orderId: z.string(),
	orderReference: z.string(),
	businessId: z.string(),
	businessName: z.string(),
	customerId: z.string(),
	customerName: z.string(),
	productId: z.string().nullable(),
	productName: z.string().nullable(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().nullable(),
	replyText: z.string().nullable(),
	createdAt: z.date(),
});
export type AdminReviewRow = z.infer<typeof adminReviewRowSchema>;

/**
 * How deep each approval queue is, across every tenant.
 *
 * Both numbers already exist inside `adminMetricsSchema`; this makes them **standalone**,
 * because they are read for two different reasons and the second one is not a dashboard.
 *
 * The console's queue badge is the reason. It used to read `pendingVerification` out of
 * `admin.metrics` — which refetches every 30 seconds and returns ~30 rows of KPIs to learn
 * one integer — and to ask `courierProfiles({ status: "PENDING", limit: 1 })` for the other,
 * reading `.total` off a one-row page. That is two requests for two numbers, one of them
 * wasteful and one of them indirect, and the badge is the first thing on the console that
 * has to be right: it is how an operator knows whether anything is waiting.
 *
 * **The two predicates must match the ones their lists use**, or the badge and the list
 * disagree and one of them is a lie. `pendingVerification` is `is_verified = 0 and status <>
 * 'SUSPENDED'`, taken from `metrics`; `pendingCouriers` is `verification_status = 'PENDING'`
 * **inner-joined to `user`**, taken from `courierProfiles` — a profile whose user row is
 * missing is absent from that list, so counting it here would make the badge higher than the
 * list it sends you to.
 *
 * No input: this is a fixed pair of counts, and an input that could filter them is an input
 * with nothing to filter *for* — a queue's depth is the whole number or it is not a number.
 */
export const adminApprovalCountsSchema = z.object({
	/** Shops that asked to be seen and have not been answered. */
	pendingVerification: z.number().int().nonnegative(),
	/** Courier profiles awaiting review. */
	pendingCouriers: z.number().int().nonnegative(),
});
export type AdminApprovalCounts = z.infer<typeof adminApprovalCountsSchema>;

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
	/**
	 * The category's photograph, and the third absent-vs-`null` field on this input.
	 *
	 * `image_url` has been a column since `0006_category_taxonomy.sql` and `categoryOf` has
	 * carried it onto the wire since the mapper was written, and **nothing could write it**:
	 * this input had no key for it, so `saveCategory` had nothing to persist and the web
	 * console's `CategoryDialog` had nothing to send. The column was a promise with no
	 * writer behind it, and `components/category-rail.tsx` has been branching on
	 * `imageUrl` ever since — drawing a glyph for all 241 rows because every one of them
	 * was null.
	 *
	 * Same convention as `nameEn` and `parentId`, for the same reason: absent is "the form
	 * carried no image", which must leave an existing photo where it is, and `null` is the
	 * operator deliberately clearing it back to the glyph. Collapsing them would strip the
	 * photograph off every category each time somebody corrected a name — the photo is on
	 * the row and not in the form, so a name edit that omitted it would look like a clear.
	 *
	 * Root-relative `/files/:id` from `uploads.create`, or an `https://` URL. Both go
	 * through `imageUrlSchema`, which `components/image.tsx` resolves the same way, so the
	 * two are interchangeable here and a category photo can be uploaded or linked.
	 */
	imageUrl: imageUrlSchema.nullable().optional(),
	sortOrder: z.number().int().min(0).max(999).default(0),
});
export type AdminCategoryInput = z.infer<typeof adminCategoryInput>;

/**
 * Deleting a category, and the reason it was deleted.
 *
 * A separate input from `adminCategoryInput` rather than a flag on it, because the two do
 * not overlap: this one carries nothing editable, since there is nothing left to edit. It
 * exists because a category deletion was the one audited action with **no way to say why**
 * — `deleteCategory` took `{ id }`, so the console's `ActionButton` collected a reason the
 * callback threw away and the audit row was written with `reason: null`.
 *
 * `reason` is required here because `category.delete` is in `REASON_REQUIRED_ACTIONS`, and
 * the console's reason dialog is driven by that one list: this schema and that list have to
 * agree, or the field is asked for and never stored.
 */
export const adminDeleteCategoryInput = z.object({
	id: z.string(),
	reason: z.string().trim().min(REASON_MIN_LENGTH).max(500),
});
export type AdminDeleteCategoryInput = z.infer<typeof adminDeleteCategoryInput>;

// `payoutSchema` stood here and described a run of settled commission — a gross, a
// platform fee, a net, and an order count. That was the wrong business: the consumer
// pays the merchant for products and the courier for delivery, and the platform
// invoices a flat subscription for the app. There is no gross to settle and no share
// to compute, so the whole shape is gone rather than renamed.
//
// Its replacements are two files, because the two audiences ask different questions:
//   - `schemas/subscription.ts` — what a merchant is told about their own billing.
//   - `schemas/admin-subscription.ts` — what an operator is told, including arrears.
