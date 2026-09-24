import type { MessageKey } from "@pymeshub/i18n";
import type { PromotionCard } from "@pymeshub/shared";

/**
 * A promotion's kind, in the customer's words.
 *
 * `promotionCardSchema.kind` is `PERCENT | FIXED | FREE_DELIVERY` and `value` is in the
 * kind's own unit — a whole percent, an amount of money in the *shop's* currency, or
 * nothing at all (`FREE_DELIVERY` ignores the column, which is the schema's documented
 * shape and why that sentence has no `{value}` slot). So the sentence that names the offer
 * is the kind's own, and this is the one map from one to the other.
 *
 * A `Record` over the union and not an if-chain, for the reason `MOVE_LABELS` and
 * `SORT_LABELS` are: a fourth member of `PROMOTION_KINDS` in
 * `packages/shared/src/schemas/catalog.ts` becomes a **compile error here** rather than a
 * card that renders a raw `kind` at a customer. The keys are a closed set too —
 * `MessageKey` is `keyof typeof es`, so a name nobody has written fails the build instead of
 * falling back to Spanish at runtime.
 *
 * It lives in `lib/` rather than inside a component because it is domain vocabulary, not
 * drawing: `./promo-hero`'s banner reads it, and `./promotion-card` / `./promotion-rail` —
 * the coupon rail it used to be shared with — were deleted when the feed's rail became that
 * one banner. `./coupon-strip` is **not** a reader and must not become one: its threshold
 * sentence is `cart.minOrderMissing`, which is copy about the customer's own basket rather
 * than about a code. `lib/api-error.ts` keeps the same kind of map (a failure code to its
 * message key) for the same reason: one table, read wherever the fact is drawn.
 */
export const PROMOTION_LABELS: Record<PromotionCard["kind"], MessageKey> = {
	PERCENT: "home.promotion.percent",
	FIXED: "home.promotion.fixed",
	FREE_DELIVERY: "home.promotion.freeDelivery",
};
