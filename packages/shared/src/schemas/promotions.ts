/**
 * A shop's own promotions, from the merchant's side.
 *
 * `catalog.ts`'s `promotionCardSchema` is the **advertising** half of the same row: what
 * a browse rail shows a customer who has not typed a code yet, and deliberately without
 * the columns that only mean something to the shop that owns the code. This file is the
 * other half — the row read whole, and the inputs that write it — because the merchant
 * screen cannot draw "3 of 25 used, ends Friday" from a card that was built to answer a
 * different question.
 *
 * The two files share `PROMOTION_KINDS` and `promotionCodeSchema` and nothing else, which
 * is the point: a code's worth is one of three shapes, and how the code is spelled is a
 * rule both ends of the marketplace must agree on. Everything else about a promotion is
 * a column the shop sets and the cart re-reads at redemption.
 *
 * ## The code is stored uppercase, and that is load-bearing
 *
 * `cart.applyPromotionInput` already normalises what a customer types — trim, then upper
 * — and looks the row up with an exact match. So a code stored as the merchant typed it
 * (`save10`) is a code a customer typing `save10` finds and a customer typing `SAVE10`
 * does not, which is a discount that works depending on the shift key. The transform here
 * is the same one, at the other end of the same rule: what is written is what can be read.
 * `promotionCodeSchema` is therefore shared with the cart rather than copied beside it —
 * a disagreement between the code a shop can create and the code a customer can type is
 * exactly the bug `@pymeshub/shared` exists to prevent.
 *
 * ## Value keeps the unit of its own kind
 *
 * `value` is a whole percent for `PERCENT`, minor units for `FIXED`, and ignored for
 * `FREE_DELIVERY` — the column's documented shape (`packages/db/src/schema.ts`), repeated
 * in the refinements below rather than normalised into one unit. Normalising would mean
 * the client multiplying a percent by a subtotal it does not have, and the two kinds would
 * then disagree about what the number on the form means. The form says which unit its
 * field is in; these refinements only refuse a number that does not fit the kind chosen.
 *
 * ## No `isActive` on either input
 *
 * Opening and closing a live code is its own moment — the switch on a row, a decision
 * about customers holding that code right now — and it is `promotions.setActive`, not a
 * field a form can save in passing. Both inputs here write the code's *terms*; whether
 * the code is live is the other procedure's whole job.
 */

import { z } from "zod";
import { PROMOTION_KINDS, type PromotionKind } from "./catalog";
import { currencySchema, imageUrlSchema, moneyMinorSchema } from "./common";

/** A short blurb on the customer card. Counted as whitespace-separated tokens. */
export const PROMOTION_DESCRIPTION_MAX_WORDS = 40;
export const PROMOTION_DESCRIPTION_MAX_CHARS = 280;

export function promotionDescriptionWordCount(text: string): number {
	const trimmed = text.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}

const promotionDescriptionSchema = z
	.string()
	.trim()
	.max(PROMOTION_DESCRIPTION_MAX_CHARS)
	.refine(
		(value) =>
			value === "" ||
			promotionDescriptionWordCount(value) <= PROMOTION_DESCRIPTION_MAX_WORDS,
		{ message: "La descripción no puede superar las 40 palabras" },
	)
	.transform((value) => (value === "" ? null : value))
	.or(z.null())
	.optional();

/**
 * The code a customer types at checkout.
 *
 * The bounds are the cart's, kept identical on purpose: a merchant who could save a code
 * longer than `applyPromotionInput` accepts would be building a discount nobody can type.
 */
export const promotionCodeSchema = z
	.string()
	.trim()
	.min(3)
	.max(40)
	.transform((value) => value.toUpperCase());

/**
 * The three shapes `value` takes, checked against the kind that gives it meaning.
 *
 * `FREE_DELIVERY` accepts anything because the column is ignored — the delivery fee is
 * decided at checkout from the fulfilment mode, so there is no number here to be wrong.
 * A zero is refused for the other two: a code worth nothing is not a promotion, it is a
 * code the cart will apply and the customer will thank nobody for.
 */
function valueFitsKind(kind: PromotionKind, value: number): boolean {
	if (kind === "PERCENT") return value >= 1 && value <= 100;
	if (kind === "FIXED") return value >= 1 && value <= 100_000_000_000;
	return true;
}

/**
 * A window that ends before it starts is a code that can never be used, and the form
 * would have to say so twice — once in the field and once when the customer tries.
 */
function windowIsOrdered(
	startsAt: Date | null | undefined,
	endsAt: Date | null | undefined,
): boolean {
	if (startsAt == null || endsAt == null) return true;
	return endsAt.getTime() > startsAt.getTime();
}

const promotionFields = z.object({
	code: promotionCodeSchema,
	kind: z.enum(PROMOTION_KINDS),
	/**
	 * The discount, in the unit `kind` names. Bounded here as a non-negative integer
	 * only; the per-kind rule is a refinement, because it needs both fields at once.
	 */
	value: z.number().int().min(0).max(100_000_000_000),
	/** The order subtotal a cart must reach. Null is "any order". */
	minOrderMinor: moneyMinorSchema.nullable().optional(),
	/** How many times the code may be redeemed in total. Null is unlimited. */
	maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
	/**
	 * When the code starts and stops working. Null is "now" and "never", the two
	 * halves of an open-ended code — not "the column was left alone", which is what
	 * the same field means on `promotionUpdateInput`.
	 */
	startsAt: z.date().nullable().optional(),
	endsAt: z.date().nullable().optional(),
	/**
	 * The banner picture, as the `/files/:id` `uploads.create` answered. Absent means
	 * "leave it alone" on an update and "the brand fill" on a create; an explicit `null`
	 * on an update is how a shop takes the picture back off.
	 *
	 * The column is the same one `catalog.ts`'s `promotionArtSchema` narrows for the
	 * card, and the two are not merged because this file is what a shop *writes* and that
	 * one is what a customer *sees* — the split every other schema pair in this package
	 * makes.
	 */
	imageUrl: imageUrlSchema.nullable().optional(),
	description: promotionDescriptionSchema,
});

/**
 * What the shop sends to open a code.
 *
 * Built from `promotionFields` rather than a parallel shape, so a column added to the
 * table lands here by default. The two refinements are on this schema and not on
 * `promotionFields` because a refined schema cannot be extended — the reason
 * `productCreateInput` in `catalog.ts` is built the same way.
 */
export const promotionCreateInput = promotionFields
	.refine((promotion) => valueFitsKind(promotion.kind, promotion.value), {
		message: "El descuento no corresponde al tipo elegido",
		path: ["value"],
	})
	.refine(
		(promotion) => windowIsOrdered(promotion.startsAt, promotion.endsAt),
		{
			message: "La fecha de fin debe ser posterior a la de inicio",
			path: ["endsAt"],
		},
	);
export type PromotionCreateInput = z.infer<typeof promotionCreateInput>;

/**
 * Every field optional, and both rules re-applied by hand — `partial()` drops a
 * refinement along with the requirement, and an update that lowers a percent below 1 or
 * slides `endsAt` before `startsAt` is exactly what those rules exist to refuse.
 *
 * The difference from `promotionCreateInput`'s copy: each rule can only fire when the
 * update supplies both of the fields it reads. Changing `kind` without touching `value`
 * must not be refused because the *stored* value does not fit the new kind — a partial
 * update is validated against itself, and the service re-checks the merged result the way
 * `products.update` re-checks the compare-at rule (`assertFitsKind`).
 */
export const promotionUpdateInput = promotionFields
	.partial()
	.refine(
		(promotion) =>
			promotion.kind == null ||
			promotion.value == null ||
			valueFitsKind(promotion.kind, promotion.value),
		{
			message: "El descuento no corresponde al tipo elegido",
			path: ["value"],
		},
	)
	.refine(
		(promotion) => windowIsOrdered(promotion.startsAt, promotion.endsAt),
		{
			message: "La fecha de fin debe ser posterior a la de inicio",
			path: ["endsAt"],
		},
	);
export type PromotionUpdateInput = z.infer<typeof promotionUpdateInput>;

/**
 * One shop's codes. No cursor and no page: a business's promotions are a handful of rows
 * the whole screen draws at once, and a feed input here would be a scroll nobody asked
 * for on a list that does not scroll off the end. `businessId` is the scope key the
 * middleware answers against `membership` — see `routers/promotions.ts`.
 */
export const promotionListInput = z.object({ businessId: z.string() });
export type PromotionListInput = z.infer<typeof promotionListInput>;

/** The one field `promotions.setActive` writes. Separate from `promotionUpdateInput` for the reason in this file's header. */
export const promotionActiveInput = z.object({
	promotionId: z.string(),
	isActive: z.boolean(),
});
export type PromotionActiveInput = z.infer<typeof promotionActiveInput>;

/**
 * A promotion as the shop that owns it sees it: everything `promotionCardSchema` leaves
 * out, because this is the screen that edits those columns and shows what the code has
 * already done.
 *
 * `currency` is here for the reason it is on the card — `value` is money the shop is
 * giving away in the shop's own unit and the row has no currency of its own — and
 * `redemptions` is here because "3 of 25 used" is the number a merchant decides by.
 */
export const promotionDetailSchema = z.object({
	id: z.string(),
	code: z.string(),
	kind: z.enum(PROMOTION_KINDS),
	value: z.number().int(),
	currency: currencySchema,
	/** The banner picture the shop chose, or null for the composed brand fill. */
	imageUrl: imageUrlSchema.nullable(),
	description: z.string().nullable(),
	minOrderMinor: z.number().int().nullable(),
	maxRedemptions: z.number().int().nullable(),
	redemptions: z.number().int(),
	startsAt: z.date().nullable(),
	endsAt: z.date().nullable(),
	isActive: z.boolean(),
});
export type PromotionDetail = z.infer<typeof promotionDetailSchema>;
