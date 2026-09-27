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

/** The two ways to pay. Not a continuum: a merchant picks one and is on it. */
export const PLANS = ["WEEKLY", "MONTHLY"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * The order plans are offered in — the cheapest first.
 *
 * Used by the plan picker to render them, and by `upgradeTargets` to say what a
 * merchant can move to. A one-element list is the degenerate case, not an error: with
 * only one plan there is nothing to upgrade to and the call returns nothing.
 */
export const PLAN_ORDER: readonly Plan[] = ["WEEKLY", "MONTHLY"];

/** The plan a business sits on before anyone has chosen one, and after a lapse. */
export const DEFAULT_PLAN: Plan = "WEEKLY";

/**
 * The launch price book: ₡2,000 a week, ₡10,000 a month, both IVA-inclusive.
 *
 * These are the numbers the seed and a fresh install run on. They are **not** read at
 * runtime — a deployed Worker prices from the `price_book` table, so raising the
 * price is a row insert and not a release. Keeping them here is for the seed, for
 * tests, and for a client rendering a plan it has not fetched.
 */
export const LAUNCH_PRICE_BOOK = {
	priceBookId: "launch-2026",
	label: "Launch",
	weeklyMinor: 2_000,
	monthlyMinor: 10_000,
} as const;

/** What a plan costs, in colones, IVA included. */
export function priceMinorFor(
	plan: Plan,
	book: {
		weeklyMinor: number;
		monthlyMinor: number;
	},
): number {
	return plan === "WEEKLY" ? book.weeklyMinor : book.monthlyMinor;
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
 * A week is seven days and a month is thirty: not a calendar month, which would make
 * the price depend on which month a merchant joined and make a period end on a
 * different day each time. A flat thirty keeps every charge the same size, which is
 * the property a merchant checking their bank statement is actually relying on.
 */
export const PLAN_PERIOD_DAYS: Record<Plan, number> = {
	WEEKLY: 7,
	MONTHLY: 30,
};

export function periodEndFrom(start: Date, plan: Plan): Date {
	return new Date(start.getTime() + PLAN_PERIOD_DAYS[plan] * 86_400_000);
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
}

const MEGABYTE = 1024 * 1024;

/**
 * The weekly plan: enough to run a kitchen, not enough to run a business.
 *
 * Twenty-five products is a menu that has not finished being digitised; two hundred
 * and fifty megabytes is about a hundred phone photos, which is a logo, a cover and
 * one picture per item. One promotion, ninety days of history.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
	WEEKLY: {
		locations: 1,
		staffAccounts: 1,
		products: 25,
		optionGroupsPerProduct: 2,
		optionsPerGroup: 6,
		imagesPerProduct: 2,
		storageBytes: 250 * MEGABYTE,
		activePromotions: 1,
		analyticsDays: 90,
		auditRetentionDays: 90,
		inventoryTracking: false,
	},
	/**
	 * The monthly plan: a shop that has outgrown the weekly one.
	 *
	 * A hundred and fifty products clears a real Costa Rican menu — a sodería runs
	 * fifty to a hundred, a large pollería one to three hundred — and becomes a
	 * genuine constraint past two hundred and fifty. Two gigabytes at an average of
	 * one megabyte a photo is about five images per product across the catalogue with
	 * room to spare, and it costs the platform $0.03 a month, so the cap is set where
	 * it becomes an abuse boundary rather than where it becomes expensive.
	 */
	MONTHLY: {
		locations: 1,
		staffAccounts: 3,
		products: 150,
		optionGroupsPerProduct: 3,
		optionsPerGroup: 10,
		imagesPerProduct: 5,
		storageBytes: 2 * 1024 * MEGABYTE,
		activePromotions: 5,
		analyticsDays: 730,
		auditRetentionDays: 730,
		inventoryTracking: true,
	},
};

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
 */
export function upgradeTarget(
	current: Plan,
	limit: CountablePlanLimit,
	have: number,
): { plan: Plan; allows: number } | null {
	// Only a plan that *raises this merchant's own ceiling* counts. Comparing against
	// what the current plan allows — rather than the limit table in general — is what
	// keeps a merchant on a plan they have outgrown from being told to upgrade: a
	// weekly shop holding 10 of 25 products has hit nothing, and naming MONTHLY for it
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
		periodEnd: Date | null;
		gracedUntil: Date | null;
		createdAt: Date;
	},
	now: Date,
): SubscriptionStatus {
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
