/**
 * What a merchant pays for the app, and what that buys.
 *
 * The model in one sentence: **the consumer pays the merchant for products and the
 * courier for delivery, and PymesHub charges the merchant a flat fee for the app.**
 * There is no commission, no per-order fee and no share of anybody's money — the
 * platform never handles a colón of a consumer's payment, which is why there is no
 * gateway here and why `payout` is not this file's business.
 *
 * Two things this module has to get right, because both were wrong once:
 *
 * - **The price is IVA-inclusive.** ₡2,000 and ₡10,000 are what the merchant pays, so
 *   the platform absorbs the 13% and remits it. The net is `price / 1.13` and that
 *   division is load-bearing: at 200 merchants the difference between the two is
 *   ₡2.3M a year of revenue, so it is a function here rather than an arithmetic each
 *   caller rediscovers.
 * - **A price rise must not reach a merchant who already subscribed.** Hence
 *   `priceBookId` on the subscription and `activePriceBook` on the platform: a
 *   subscription locks the book it joined under, and a new book is a new row. That
 *   is the whole mechanism behind "raise the price as the app grows" — it is
 *   enforceable, and no existing merchant's price moves as a side effect.
 *
 * The limits below are the *only* thing that makes the monthly plan worth ₡16,000
 * more per year than the weekly one, so they are not decoration. If nothing enforces
 * them, every merchant picks the cheaper plan and the tier means nothing.
 */

/**
 * What a merchant pays for — the tier, which is only ever "what you get".
 *
 * **The tier is not the billing period.** Those were one thing until this split, and
 * conflating them meant a shop could not have 250 products on an annual invoice, nor 15
 * products billed monthly. `Cadence` is that second axis, below, and limits depend on
 * the tier alone.
 *
 * The four names and their price points are inherited from the retired `apps/api` billing
 * — `Emprende`, `Starter`, `Growth`, `Business` at ₡6 900 / ₡12 900 / ₡29 900 / ₡59 900 —
 * so a merchant who has read one price page has not met a new product when they arrive at
 * this one. Only the *system* is Cloudflare; the vocabulary was already paid for.
 *
 * `FREE` is **permanent**, not a trial: see `subscriptionStatusAt`, which is why it is
 * listed first and why `DEFAULT_PLAN` points at it.
 */
export const PLANS = ["FREE", "EMPRENDE", "STARTER", "GROWTH", "BUSINESS"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * How often a paid merchant is invoiced.
 *
 * Two values and no continuum. **Annual is not a discount bolted onto monthly** — it buys
 * the same tier for a 365-day period, and the limits are identical, because the whole point
 * of the split is that buying a year is not buying more shop. See `PLAN_PERIOD_DAYS` for why
 * the year is 365 and not 360.
 *
 * `FREE` has no cadence. A plan that is never charged has no period, and giving it one is
 * what produced the "maximum of 0 promotions" message and the 90-day expiry — see the
 * docblock on `PLAN_PERIOD_DAYS`.
 */
export const CADENCES = ["MONTHLY", "YEARLY"] as const;
export type Cadence = (typeof CADENCES)[number];

/** The cadences a **paid** plan can be billed on, for pickers and validation. */
export function cadencesFor(plan: Plan): readonly Cadence[] {
	return plan === "FREE" ? [] : CADENCES;
}

/**
 * The order plans are offered in — the cheapest first.
 *
 * Used by the plan picker to render them, and by `upgradeTargets` to say what a
 * merchant can move to. A one-element list is the degenerate case, not an error: with
 * only one plan there is nothing to upgrade to and the call returns nothing.
 */
export const PLAN_ORDER: readonly Plan[] = [
	"FREE",
	"EMPRENDE",
	"STARTER",
	"GROWTH",
	"BUSINESS",
];

/**
 * The plan a business sits on before anyone has chosen one, and after a lapse.
 *
 * **`FREE`, and it has to be.** This is the floor `effectivePlan` sends `PAST_DUE` and
 * `SUSPENDED` merchants to, so before the free tier existed it was `WEEKLY` — a **paid**
 * tier — and a merchant who stopped paying kept 25 products. The floor was an accident of
 * which plan happened to sort first rather than a decision, and it is worth naming here
 * because that is exactly how it will drift back: a new tier inserted above `FREE` must not
 * become this constant.
 */
export const DEFAULT_PLAN: Plan = "FREE";

/**
 * One price, for one (tier, cadence) pair.
 *
 * A flat map rather than columns on `price_book`, because a fifth tier or a third cadence
 * is then an insert instead of a migration, and because six nullable columns make a
 * half-populated book representable — including a `FREE` row with an annual price, which is
 * a price for something nobody is ever charged.
 */
export type PriceBookPrices = Partial<
	Record<Plan, Partial<Record<Cadence, number>>>
>;

/**
 * The launch price book: the four paid tiers, monthly and annual, IVA-inclusive.
 *
 * **Annual is ten months of monthly for every tier** — 16.7% off, one rule, so the pricing
 * page states a single saving instead of three unrelated discounts. The two bottom tiers are
 * the retired `apps/api` figures **raised** (₡6 900→₡10 900, ₡12 900→₡19 900); the top two
 * are unchanged, so `Growth` and `Business` still match what that catalogue quoted and the
 * ladder stays monotonic — the rungs are ₡10 900, ₡19 900, ₡29 900, ₡59 900, which is a
 * tighter spread at the bottom and a wider one at the top than before.
 *
 * `FREE` is **absent from every cadence**, not present at zero. A `FREE` row priced at 0
 * would satisfy `priceMinorFor` and then be charged 0 forever; absence is what makes the
 * free plan's "never charged" property checkable.
 *
 * These numbers are **not** read at runtime — a deployed Worker prices from the
 * `price_book_price` table, so raising a price is an insert and not a release. Keeping them
 * here is for the seed, for tests, and for a client rendering a plan it has not fetched.
 */
export const LAUNCH_PRICE_BOOK: {
	priceBookId: string;
	label: string;
	prices: PriceBookPrices;
} = {
	priceBookId: "launch-2026",
	label: "Launch",
	/**
	 * `FREE` is **absent from every cadence**, not present at zero.
	 *
	 * Annotated rather than left to infer: a literal type would forget the key exists, and
	 * a caller asserting `prices.FREE?.[cadence]` is undefined — which is how "a free shop
	 * is never charged" becomes checkable — could not write that assertion at all.
	 */
	prices: {
		EMPRENDE: { MONTHLY: 1_090_000, YEARLY: 10_900_000 },
		STARTER: { MONTHLY: 1_990_000, YEARLY: 19_900_000 },
		GROWTH: { MONTHLY: 2_990_000, YEARLY: 29_900_000 },
		BUSINESS: { MONTHLY: 5_990_000, YEARLY: 59_900_000 },
	},
};

/**
 * What a plan costs on a cadence, in colones, IVA included.
 *
 * **Throws rather than returning a number it cannot vouch for.** A missing pair is a
 * pricing book that is not populated for the tier being sold, and the two mistakes are
 * both real: returning `0` charges a merchant nothing for a year, and returning `undefined`
 * puts `NaN` into an invoice. A thrown `Error` at the price read fails the request, which
 * is the only outcome that cannot reach a customer.
 *
 * `FREE` has no price in the book, which is the same property stated as a rule.
 */
export function priceMinorFor(
	plan: Plan,
	cadence: Cadence,
	book: { prices: PriceBookPrices },
): number {
	const minor = book.prices[plan]?.[cadence];
	if (typeof minor !== "number") {
		throw new Error(
			`The price book has no ${plan} price on ${cadence}. A price book is a row insert, not a release — insert the pair before selling it.`,
		);
	}
	return minor;
}

/**
 * What the platform actually keeps once the IVA is remitted.
 *
 * Costa Rican IVA is 13%, and a price stated as "₡10,000 with IVA" means ₡10,000
 * reaches the merchant's invoice and ₡1,150.44 of it belongs to the state. Rounded
 * to the colón because the remittance is reconciled in colones, not in fractions of
 * one — the residue is the platform's, and it is smaller than a rounding error at any
 * merchant count worth modelling.
 */
export const IVA_RATE = 0.13;

export function netOfIva(grossMinor: number): number {
	return Math.round(grossMinor / (1 + IVA_RATE));
}

export function ivaOn(grossMinor: number): number {
	return grossMinor - netOfIva(grossMinor);
}

/**
 * What a period is, in days, and therefore what one charge is.
 *
 * **Nested by cadence**, because a tier no longer determines how long a period lasts. The
 * two decisions are independent: an annual `GROWTH` shop and a monthly `GROWTH` shop have
 * identical limits and identical prices-per-day, and differ only in when the money moves.
 *
 * - A **month is thirty days**, not a calendar month. That rejection is unchanged and its
 *   reason is unchanged: a calendar month makes the price depend on which month a merchant
 *   joined, and makes a period end on a different day each time. A flat thirty keeps every
 *   charge the same size, which is what a merchant checking their bank statement relies on.
 * - **A year is 365, not twelve 30-day months.** This is the same principle read the other
 *   way round. Twelve 30-day months is 360 days, so an "annual" plan would silently run five
 *   days short — a merchant who paid for a year and got 360 days is a refund and a bad
 *   review. 365 is a flat period like 30, which is the property being preserved.
 * - **`FREE` is `null`**, not `0`. A plan that is never charged has no period at all, and
 *   this is load-bearing twice over: `0` days would make `isPeriodDue` true forever and the
 *   charge path would bill a free shop on every sweep, and a *number* here would read as
 *   "periods of zero length" in any caller that forgot to special-case it.
 */
export const PLAN_PERIOD_DAYS: Record<
	Plan,
	Record<Cadence, number | null>
> = {
	FREE: { MONTHLY: null, YEARLY: null },
	EMPRENDE: { MONTHLY: 30, YEARLY: 365 },
	STARTER: { MONTHLY: 30, YEARLY: 365 },
	GROWTH: { MONTHLY: 30, YEARLY: 365 },
	BUSINESS: { MONTHLY: 30, YEARLY: 365 },
};

/** The days in one period, or `null` for a plan that is never charged. */
export function periodDaysFor(plan: Plan, cadence: Cadence): number | null {
	return PLAN_PERIOD_DAYS[plan][cadence];
}

/**
 * When a paid period ends.
 *
 * **Throws on `FREE`.** A caller that has not established that the plan is paid is asking a
 * question with no answer, and the two available answers — a period ending now, or an
 * infinite one — both put a free shop one step from being charged. The refusal names the
 * reason so the caller can branch on the plan instead.
 */
export function periodEndFrom(
	start: Date,
	plan: Plan,
	cadence: Cadence,
): Date {
	const days = periodDaysFor(plan, cadence);
	if (days === null) {
		throw new Error(
			`The FREE plan has no period: it is never charged. Branch on the plan before asking when a period ends.`,
		);
	}
	return new Date(start.getTime() + days * 86_400_000);
}

/**
 * Whether a plan may be charged for a second time yet.
 *
 * The comparison is `>=` and not `>`, so a period ends at the instant it begins
 * rather than one millisecond later. A subscription can never be un-chargeable by
 * accident, and the failure this avoids is a merchant whose access quietly stops
 * because two timestamps landed on the same millisecond.
 */
export function isPeriodDue(periodEnd: Date, now: Date): boolean {
	return periodEnd.getTime() <= now.getTime();
}

/**
 * Where a subscription stands.
 *
 * `GRACE` is a distinct state rather than a field on `ACTIVE` because the two answer
 * different questions: `ACTIVE` is "has access now", and grace is "has access, but
 * the money is late". Collapsing them means a lapsed merchant and a current one are
 * the same row with a flag, and every reader has to remember which flag wins.
 *
 * - `ACTIVE` — paid, full plan limits.
 * - `GRACE` — past due, still full limits, warned. The platform has not yet taken
 *   anything away, and the merchant still has customers.
 * - `PAST_DUE` — past `graceDays` with no payment. Degraded to `DEFAULT_PLAN`'s
 *   limits, **still visible in the feed**. A shop that stops paying but keeps its
 *   customers is the state worth avoiding, so taking the storefront down would be
 *   the wrong punishment; taking away the tools is enough.
 * - `SUSPENDED` — past `hiddenAfterDays`. Unlisted. The last resort, and the only
 *   state that removes a business from the marketplace.
 */
export const SUBSCRIPTION_STATUSES = [
	"ACTIVE",
	"GRACE",
	"PAST_DUE",
	"SUSPENDED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * The two windows, in days, that `GRACE` and `SUSPENDED` sit behind.
 *
 * Thirty and ninety. The first is long enough that a merchant who pays late does not
 * lose their storefront — a Costa Rican shop paying a ₡2,000 weekly fee by hand will
 * occasionally be a few days late, and making that punishing would teach people to
 * cancel rather than to pay. The second is long enough to be a real debt and short
 * enough that a merchant who has walked away is not squatting on a listing.
 */
export const GRACE_DAYS = 30;
export const HIDDEN_AFTER_DAYS = 90;

/** What each status means for access, in one table so no two readers disagree. */
export const STATUS_GRANTS_FULL_ACCESS: Record<SubscriptionStatus, boolean> = {
	ACTIVE: true,
	GRACE: true,
	PAST_DUE: false,
	SUSPENDED: false,
};

/** Whether a business in this status still belongs in the customer-facing feed. */
export const STATUS_IS_LISTED: Record<SubscriptionStatus, boolean> = {
	ACTIVE: true,
	GRACE: true,
	PAST_DUE: true,
	SUSPENDED: false,
};

/**
 * What a plan permits, and the ceiling that is a real constraint.
 *
 * A number here is only worth setting if exceeding it either costs the platform
 * something or denies a feature a merchant would pay for. Each of these does one of
 * those, which is the test a proposed limit has to pass:
 *
 * - `locations` / `staffAccounts` / `products` / `optionGroupsPerProduct` /
 *   `optionsPerGroup` / `activePromotions` are counted on the hot paths, so they are
 *   the caps that keep a tenant from growing without limit.
 * - `storageBytes` is money: R2 bills $0.015/GB-month, so a plan with no storage cap
 *   is a plan whose cost the merchant sets.
 * - `analyticsDays` and `auditRetentionDays` are window clamps, and `auditRetentionDays`
 *   is also a deletion schedule — it says how long rows are *kept*, not just how far
 *   back a merchant may ask.
 * - `inventoryTracking` is the one boolean, and it is a real Pro feature: the column
 *   already exists on `product`, so this is a switch rather than a subsystem.
 *
 * `Infinity` is written where a cap would be arbitrary rather than absent, so the
 * shape of the table does not change when a plan gains one.
 */
export interface PlanLimits {
	locations: number;
	staffAccounts: number;
	products: number;
	optionGroupsPerProduct: number;
	optionsPerGroup: number;
	imagesPerProduct: number;
	storageBytes: number;
	activePromotions: number;
	analyticsDays: number;
	auditRetentionDays: number;
	inventoryTracking: boolean;
	/**
	 * Express deliveries a business may **accept** in one week.
	 *
	 * Not a subsidy and not a discount: the customer pays the courier separately and always
	 * did (`plans.ts`'s own model sentence), so this counts **how many express orders the
	 * business may take on**, and nothing about who pays for them. A tier that could raise
	 * this number would not change a colón of anyone's delivery cost — it changes how many
	 * customers the shop can serve at speed.
	 *
	 * **Counted on acceptance, not on placement**, so an order the shop declines costs it
	 * nothing. `Infinity` on `BUSINESS` is the "not a constraint" rung and is written as a
	 * number rather than as an absent cap so the shape of the table does not change when a
	 * tier gains one.
	 *
	 * Weekly, and that is deliberately **not** the billing period: a monthly merchant gets
	 * ten a week, not ten a month divided by four, because a shop that fills its week on
	 * Sunday and its week on Monday is two full weeks of business. The reset is therefore a
	 * rolling window from the last reset rather than a calendar week — see `weekWindowStart`.
	 */
	expressPerWeek: number;
}

const MEGABYTE = 1024 * 1024;

/**
 * What each tier permits.
 *
 * **Limits are a function of the tier and nothing else.** An annual merchant has exactly
 * the numbers a monthly one has, because buying a year is not buying more shop — and that
 * is the invariant the whole tier/cadence split exists to make possible, so it is the first
 * thing to check if a merchant on an annual plan reports a ceiling their monthly neighbour
 * does not hit.
 *
 * The progression, and why each rung is where it is:
 *
 * - **`FREE` — fifteen products.** Not a menu, a business card. Small enough that growing
 *   past it is a real moment, which is the only thing a free tier is for. `activePromotions`
 *   is **zero**, not one: the first promotion is refused, and the refusal says the feature
 *   is unavailable rather than that the maximum is 0. `analyticsDays: 30` because "how did
 *   this week go" is the whole question a brand-new shop can answer.
 * - **`EMPRENDE` — sixty products.** Covers a real sodería, which the docblock above records
 *   as running fifty to a hundred. 600 MB is about 240 phone photos: a cover, a logo and
 *   three pictures per product.
 * - **`STARTER` — 250 products,** where a large pollería (one to three hundred) becomes a
 *   genuine constraint. Inventory tracking arrives here, and it is a switch rather than a
 *   subsystem because the column already exists on `product`.
 * - **`GROWTH` — a second location and five staff.** Everything above is one shop; this is
 *   where two is possible, and `staffAccounts` matters more than `products` because a shop
 *   with a second location and one user cannot run it.
 * - **`BUSINESS` — 1 000 products, five locations, fifteen staff,** and three years of
 *   history so a year-over-year comparison survives. **`storageBytes` stops at 10 GB
 *   because that is D1's documented ceiling** (`schema.ts` notes it in the storage
 *   docblock); a higher number here would be a promise the database cannot keep.
 *
 * `Infinity` is written where a cap would be arbitrary rather than absent, so the shape of
 * the table does not change when a tier gains one.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
	FREE: {
		locations: 1,
		staffAccounts: 1,
		products: 15,
		optionGroupsPerProduct: 1,
		optionsPerGroup: 5,
		imagesPerProduct: 2,
		storageBytes: 150 * MEGABYTE,
		activePromotions: 0,
		analyticsDays: 30,
		auditRetentionDays: 30,
		inventoryTracking: false,
		// Ten a week is about one busy lunch and one busy dinner. Enough that a shop can
		// run a week on it, and small enough that ten express deliveries a week for a year
		// is a real number of customers turning away.
		expressPerWeek: 10,
	},
	EMPRENDE: {
		locations: 1,
		staffAccounts: 2,
		products: 60,
		optionGroupsPerProduct: 2,
		optionsPerGroup: 8,
		imagesPerProduct: 3,
		storageBytes: 600 * MEGABYTE,
		activePromotions: 2,
		analyticsDays: 90,
		auditRetentionDays: 180,
		inventoryTracking: false,
		// Thirty a week: a shop taking express on most days and still short on Sundays.
		expressPerWeek: 30,
	},
	STARTER: {
		locations: 1,
		staffAccounts: 3,
		products: 250,
		optionGroupsPerProduct: 4,
		optionsPerGroup: 12,
		imagesPerProduct: 6,
		storageBytes: 3 * 1024 * MEGABYTE,
		activePromotions: 8,
		analyticsDays: 730,
		auditRetentionDays: 730,
		inventoryTracking: true,
		expressPerWeek: 90,
	},
	GROWTH: {
		locations: 2,
		staffAccounts: 5,
		products: 600,
		optionGroupsPerProduct: 5,
		optionsPerGroup: 16,
		imagesPerProduct: 8,
		storageBytes: 6 * 1024 * MEGABYTE,
		activePromotions: 15,
		analyticsDays: 1095,
		auditRetentionDays: 1095,
		inventoryTracking: true,
		expressPerWeek: 250,
	},
	BUSINESS: {
		locations: 5,
		staffAccounts: 15,
		products: 1000,
		optionGroupsPerProduct: 6,
		optionsPerGroup: 20,
		imagesPerProduct: 10,
		storageBytes: 10 * 1024 * MEGABYTE,
		activePromotions: 25,
		analyticsDays: 1095,
		auditRetentionDays: 1095,
		inventoryTracking: true,
		// Not a constraint. A shop paying for the top tier has bought out of being told no,
		// and a number here would be one that gets raised by a support ticket anyway.
		expressPerWeek: Infinity,
	},
};

/**
 * Seven days, as the express quota's window.
 *
 * **Its own constant, not the billing period.** The cadence is monthly or yearly and the
 * quota is weekly, and deriving one from the other produces either "ten a month divided by
 * four" — which strands a shop on the two busiest days of the week — or a reset that lands
 * mid-service. A merchant reasons in weeks and is billed in months, so both numbers exist and
 * neither is derived from the other.
 */
export const EXPRESS_WINDOW_DAYS = 7;

/** The start of the window containing `at`: `at` floored to a 7-day block from the epoch. */
export function weekWindowStart(at: Date): Date {
	return new Date(
		Math.floor(at.getTime() / (EXPRESS_WINDOW_DAYS * 86_400_000)) *
			EXPRESS_WINDOW_DAYS *
			86_400_000,
	);
}

/**
 * Whether this business may accept one more express order this week.
 *
 * A window **and** a count, rather than a stored counter, for the reason
 * `subscriptionStatusAt` derives its status: a counter is only as good as the process that
 * decrements it, so a shop whose decrement failed would be refused deliveries it had room
 * for. Counting the rows answers the same question whenever it is asked and needs no job.
 *
 * `Infinity` means the cap is not a constraint, so the comparison is `>=` against it and
 * nothing is ever refused — which is why this returns a plain boolean and leaves the
 * message to the caller.
 */
export function canAcceptExpress(
	plan: Plan,
	usedThisWeek: number,
): boolean {
	return usedThisWeek < PLAN_LIMITS[plan].expressPerWeek;
}

/**
 * The limits that are counts, as opposed to the one that is a switch.
 *
 * Separated because "how many" and "whether at all" are different questions, and a
 * function that accepted both would need a comparison that only means something for
 * one of them — `have > limits[key]` on `inventoryTracking` is a boolean compared
 * against a boolean, which typechecks under a cast and is nonsense at runtime.
 */
export type CountablePlanLimit = Exclude<keyof PlanLimits, "inventoryTracking">;

/** The plan that satisfies `need` with the fewest limits left over, or null. */
export function planSatisfying(
	need: Partial<Record<CountablePlanLimit, number>>,
): Plan | null {
	for (const plan of PLAN_ORDER) {
		const limits = PLAN_LIMITS[plan];
		const short = (Object.entries(need) as [CountablePlanLimit, number][]).some(
			([key, value]) => value > limits[key],
		);
		if (!short) return plan;
	}
	return null;
}

/**
 * What a merchant on `current` is told to move to in order to raise `limit`.
 *
 * Returned as the plan *and* the number it allows, so the message can say what they
 * are getting rather than only what they must give up. `null` when even the highest
 * plan does not reach the number — which is a real answer, not a missing one, and
 * the caller has to handle it by saying "contact us" instead of naming a plan that
 * would not help.
 *
 * **A cadence change is never an answer to this question**, and that is the point of the
 * split rather than a limitation of it. Limits depend on the tier alone, so an annual
 * merchant and a monthly one on the same tier hold exactly the same numbers — telling
 * someone at their product ceiling to "go annual" would be selling them nothing. The two
 * upgrades are independent and only one of them can fix a quota.
 *
 * `planSatisfying` answers the same question in the other direction — given a need, which
 * is the cheapest tier that covers it — and the two must agree, which is why both walk
 * `PLAN_ORDER` rather than searching for a maximum.
 */
export function upgradeTarget(
	current: Plan,
	limit: CountablePlanLimit,
	have: number,
): { plan: Plan; allows: number } | null {
	// Only a plan that *raises this merchant's own ceiling* counts. Comparing against
	// what the current plan allows — rather than the limit table in general — is what
	// keeps a merchant on a tier they have outgrown from being told to upgrade: an
	// Emprende shop holding 10 of 60 products has hit nothing, and naming STARTER for it
	// would be selling them a ceiling they do not need.
	if (PLAN_LIMITS[current][limit] > have) return null;

	for (const plan of PLAN_ORDER) {
		if (PLAN_ORDER.indexOf(plan) <= PLAN_ORDER.indexOf(current)) continue;
		if (PLAN_LIMITS[plan][limit] > have) {
			return { plan, allows: PLAN_LIMITS[plan][limit] };
		}
	}
	return null;
}

/**
 * Never gated, on any plan, at any price.
 *
 * Written down as a list because the absence of a limit is invisible in a table full
 * of limits, and these are the ones whose absence would be a bug:
 *
 * - **Taking and fulfilling orders.** A merchant that hits a ceiling mid-service
 *   cannot refuse a customer, and a cap that can do that is not a pricing decision,
 *   it is a way to lose the merchant and the customer in the same moment.
 * - **Shop hours, and pausing a location.** A merchant must always be able to stop
 *   taking work. A closed kitchen is a correct state, not a restricted one.
 * - **Reviews, in both directions.** Their customers write them; the platform is not
 *   selling the merchant the right to be reviewed well.
 * - **Payout visibility, and account deletion.** Somebody deciding to leave must be
 *   able to see the money they are owed and to actually go.
 */
export const NEVER_GATED = [
	"orders:read",
	"orders:advance",
	"products:read",
	"reviews:read",
	"reviews:write",
	"payouts:read",
	"business:delete",
] as const;

export type UngatedCapability = (typeof NEVER_GATED)[number];

/** A capability a plan can withhold, and the limit that governs it. */
export const GATED_CAPABILITIES: Record<string, keyof PlanLimits> = {
	"products:write": "products",
	"business:settings": "locations",
	"staff:manage": "staffAccounts",
	"analytics:read": "analyticsDays",
};

/**
 * The status a subscription is *in* on a given date, derived from its dates.
 *
 * Computed rather than read from a stored column, and that is the whole point: a
 * stored status is only as good as the process that maintains it, so a merchant three
 * weeks into grace whose sweeper has not run would sit in `ACTIVE` forever with nobody
 * chasing the debt. Deriving it from `periodEnd` and `gracedUntil` makes the answer
 * correct whenever it is asked, with no background job to depend on.
 *
 * The arithmetic, in the order the questions are asked:
 *
 * - **No period has started** — a trial, or a row created and never charged.
 *   `ACTIVE`: a merchant nobody has billed yet is not in arrears. `createdAt` is the
 *   fallback, so a row with a null `periodEnd` is current rather than permanently
 *   expired.
 * - **The period has not ended** — `ACTIVE`.
 * - **The period ended and `gracedUntil` has not passed** — `GRACE`. Full access, and
 *   the state a shop paying ₡2,000 by hand lands in most weeks.
 * - **`gracedUntil` passed** — `PAST_DUE` until `HIDDEN_AFTER_DAYS` past the period
 *   end, then `SUSPENDED`. Degraded first, unlisted last.
 *
 * A `gracedUntil` that is null on a row whose period has ended is treated as
 * "grace computed from the period end" rather than "grace already over": a partially
 * written row should cost a shop its grace window, not its storefront.
 */
export function subscriptionStatusAt(
	subscription: {
		plan: Plan;
		periodEnd: Date | null;
		gracedUntil: Date | null;
		createdAt: Date;
	},
	now: Date,
): SubscriptionStatus {
	/**
	 * `FREE` is `ACTIVE`, always, **before any date is read**.
	 *
	 * The free tier is permanent, and the rule that makes that true is that **no arrears
	 * accrue on something that is never charged**. Without this branch the fallback below
	 * turns a free row into a debt: `periodEnd` is `null` forever, so it becomes
	 * `createdAt`, which for a shop signed up 100 days ago is a period that ended before
	 * it began — `GRACE` at 30 days, `PAST_DUE` at 30, and `SUSPENDED` at 90, which is
	 * `STATUS_IS_LISTED: false`. The shop leaves the marketplace with no payment ever
	 * requested, and it reads as "the free tier didn't convert" rather than as a defect.
	 *
	 * The docblock above still claims *"a row with a null `periodEnd` is current rather
	 * than permanently expired"*, and that is only true of rows **under 30 days old**. The
	 * plan is what makes it true of all of them.
	 *
	 * It is here rather than at the call sites because `context.ts` resolves the same
	 * status and the two answers cannot be allowed to disagree.
	 */
	if (subscription.plan === "FREE") return "ACTIVE";

	const periodEnd = subscription.periodEnd ?? subscription.createdAt;
	if (periodEnd.getTime() > now.getTime()) return "ACTIVE";

	const gracedUntil =
		subscription.gracedUntil ??
		new Date(periodEnd.getTime() + GRACE_DAYS * 86_400_000);
	if (now.getTime() < gracedUntil.getTime()) return "GRACE";

	if (now.getTime() - periodEnd.getTime() >= HIDDEN_AFTER_DAYS * 86_400_000) {
		return "SUSPENDED";
	}
	return "PAST_DUE";
}

/**
 * The plan whose limits actually apply, which is not always the plan they paid for.
 *
 * `GRACE` keeps the paid plan — that is the entire purpose of the grace window.
 * `PAST_DUE` falls to `DEFAULT_PLAN`, and **this line is what takes a shop's tools
 * away**. `SUSPENDED` also falls to the floor, though by then it is unlisted anyway.
 */
export function effectivePlan(
	paidPlan: Plan,
	status: SubscriptionStatus,
): Plan {
	return STATUS_GRANTS_FULL_ACCESS[status] ? paidPlan : DEFAULT_PLAN;
}

/** A refusal's words, as keys the three clients resolve in their own language. */
export const QUOTA_KEYS = {
	planRequired: "billing.quota.planRequired",
	upgrade: "billing.quota.upgrade",
	contact: "billing.quota.contact",
} as const;
