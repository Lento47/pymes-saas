import {
	type CountablePlanLimit,
	effectivePlan,
	PLAN_LIMITS,
	type Plan,
	QUOTA_KEYS,
	STATUS_IS_LISTED,
	upgradeTarget,
} from "@pymeshub/shared";
import { ForbiddenError } from "../errors";
import type { BusinessContext } from "./helpers";

/**
 * The three questions a service asks about a merchant's plan, and the one place they
 * are answered.
 *
 * Everything here is a **read**. Nothing in this module charges anybody, writes a
 * `subscription`, or moves a status — that is `subscription.ts`. The split is what
 * lets a dozen create paths enforce limits without any of them knowing how billing
 * works: a service that wants to know "may this shop have a fortieth product" asks
 * that, and gets either `undefined` or a `DomainError` carrying the plan to move to.
 *
 * The three:
 *
 * 1. **May this grow past what it has?** `checkCount` — every create path calls it.
 * 2. **Is this feature on?** `checkFeature` — today, inventory tracking.
 * 3. **How far back may they look?** `clampAnalyticsWindow` — a clamp, not a refusal.
 *
 * The status arithmetic (`subscriptionStatusAt`) and the plan fallback
 * (`effectivePlan`) live in `@pymeshub/shared/plans` rather than here, because
 * `context.ts` needs the first one to resolve a context and importing this file from
 * there would be a cycle. Neither touches a binding, so neither needs a database to
 * be testable — and a lapse rule that can only be tested through a Worker is a lapse
 * rule that does not get tested.
 *
 * **What is deliberately not gated**, in `NEVER_GATED` in shared: taking orders,
 * fulfilling them, shop hours, pausing a location, reviews, seeing payouts, and
 * deleting the account. A merchant must always be able to stop taking work and to
 * leave, and no cap may refuse an order a customer is already waiting on.
 */

const DAY_MS = 86_400_000;

/**
 * The refusal for a merchant at their limit.
 *
 * A `ForbiddenError` subclass, and the distinction from a plain refusal is the
 * message and the payload: this is not "you may not", it is "you have reached what
 * ₡10,000 buys" — and it carries the plan that would lift it.
 *
 * `upgradeTo` is null in two cases that must read differently to the merchant, and the
 * `messageKey` is how they do. Null because no plan reaches the number is
 * `billing.quota.contact`, never `billing.quota.upgrade`: naming a plan that would not
 * help is a worse answer than saying to get in touch. (The "current plan already
 * permits it" case cannot reach here — `upgradeTarget` returns null for it, and
 * `checkCount` only calls `upgradeTarget` once it has established the cap is
 * exceeded.)
 */
export class QuotaExceededError extends ForbiddenError {
	readonly resourceType: string;
	readonly current: number;
	readonly limit: number;
	readonly plan: Plan;
	readonly limitName: CountablePlanLimit;
	readonly upgradeTo: Plan | null;

	constructor(input: {
		resourceType: string;
		current: number;
		limit: number;
		plan: Plan;
		limitName: CountablePlanLimit;
		upgradeTo: Plan | null;
	}) {
		super(
			input.upgradeTo === null
				? `Tu plan ${input.plan} permite un máximo de ${input.limit} ${input.resourceType}. Comunícate con nosotros para ampliarlo.`
				: `Tu plan ${input.plan} permite un máximo de ${input.limit} ${input.resourceType}. Actualiza a ${input.upgradeTo} para agregar más.`,
			{
				details: {
					error: "QUOTA_EXCEEDED",
					resourceType: input.resourceType,
					limit: input.limitName,
					current: input.current,
					max: input.limit,
					plan: input.plan,
					upgradeTo: input.upgradeTo,
					messageKey:
						input.upgradeTo === null ? QUOTA_KEYS.contact : QUOTA_KEYS.upgrade,
					// The two things a client can offer, so the refusal is actionable
					// without the client having to invent its own copy.
					helpActions: [
						{
							type: "upgrade",
							label: "Subir de plan",
							plan: input.upgradeTo,
						},
						{
							type: "delete",
							label: `Eliminar ${input.resourceType} que ya no uses`,
							resourceType: input.resourceType,
						},
					],
				},
			},
		);
		this.name = "QuotaExceededError";
		this.resourceType = input.resourceType;
		this.current = input.current;
		this.limit = input.limit;
		this.plan = input.plan;
		this.limitName = input.limitName;
		this.upgradeTo = input.upgradeTo;
	}
}

/**
 * May this shop add one more of a countable thing?
 *
 * The count is **passed in** rather than read here, and that is deliberate. Every
 * call site is a create path that has already selected the rows it needs — a product
 * list, a staff list, a promotion list — so counting again would be a query whose
 * answer the caller is already holding. The signature is the reminder that the number
 * must be the real one: a create path that passes `0` passes this check forever.
 *
 * `>=` and not `>`: a shop holding exactly 25 of 25 products cannot add a
 * twenty-sixth, and the error reports `current: 25, max: 25` rather than claiming
 * they are one over.
 */
export function checkCount(input: {
	ctx: BusinessContext;
	limitName: CountablePlanLimit;
	resourceType: string;
	current: number;
}): void {
	const plan = effectivePlan(
		input.ctx.businessPlan,
		input.ctx.subscriptionStatus,
	);
	const cap = PLAN_LIMITS[plan][input.limitName];
	if (input.current < cap) return;

	throw new QuotaExceededError({
		resourceType: input.resourceType,
		current: input.current,
		limit: cap,
		plan,
		limitName: input.limitName,
		upgradeTo:
			upgradeTarget(plan, input.limitName, input.current)?.plan ?? null,
	});
}

/**
 * Is this feature switched on for this shop?
 *
 * Separate from `checkCount` because there is nothing to count: a shop either tracks
 * inventory or it does not. `inventoryTracking` is the only such feature today, and
 * the column it governs already exists on `product` — so this gates a flag rather
 * than building a subsystem.
 */
export function checkFeature(
	ctx: BusinessContext,
	feature: "inventoryTracking",
): void {
	const plan = effectivePlan(ctx.businessPlan, ctx.subscriptionStatus);
	if (PLAN_LIMITS[plan][feature]) return;

	// The upgrade is offered on the dimension the feature is *about* rather than on
	// `products`, because "you have too many products" is a false reason for a shop
	// with eleven of them. `products` is the widest countable limit, so it is the
	// closest honest proxy for "you are on the cheaper plan".
	const target = upgradeTarget(plan, "products", PLAN_LIMITS[plan].products);
	throw new QuotaExceededError({
		resourceType: "control de inventario",
		current: 0,
		limit: 0,
		plan,
		limitName: "products",
		upgradeTo: target?.plan ?? null,
	});
}

/**
 * The furthest back a merchant may read their own numbers.
 *
 * A clamp rather than a refusal, and deliberately: a dashboard that silently rendered
 * "the last 90 days" when you asked for a year is wrong in a way the merchant cannot
 * see. 730 days on the monthly plan is two years, which is what makes a
 * year-over-year comparison possible — the reason it is not 365.
 */
export function clampAnalyticsWindow(
	ctx: BusinessContext,
	from: Date,
	now: Date,
): Date {
	const plan = effectivePlan(ctx.businessPlan, ctx.subscriptionStatus);
	const earliest = new Date(
		now.getTime() - PLAN_LIMITS[plan].analyticsDays * DAY_MS,
	);
	return from.getTime() < earliest.getTime() ? earliest : from;
}

/**
 * Whether a business belongs in the customer-facing feed.
 *
 * The one place `STATUS_IS_LISTED` is consulted, so "which statuses are searchable"
 * has exactly one answer in the codebase. A suspended shop is **unlisted, not
 * deleted**: its orders, reviews and payout history stay, because a merchant who
 * walked away still has customers who wrote about the food.
 *
 * Takes the *derived* status rather than reading the row, so a caller that already
 * computed it — to render a banner — and one that did not cannot disagree.
 */
export function isListed(
	status: import("@pymeshub/shared").SubscriptionStatus,
) {
	return STATUS_IS_LISTED[status];
}
