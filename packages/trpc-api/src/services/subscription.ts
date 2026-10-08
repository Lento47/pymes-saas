import {
	business as businessTable,
	type Db,
	priceBook as priceBookTable,
	priceBookPrice as priceBookPriceTable,
	subscription as subscriptionTable,
} from "@pymeshub/db";
// `PlanOption` and `Subscription` are wire shapes, so they come from the barrel; the
// arithmetic and the plan table come from the subpath, which imports no zod. This
// module is on the request path and the barrel evaluates every schema in the package.
import type { PlanOption, Subscription } from "@pymeshub/shared";
import { newId } from "@pymeshub/shared/ids";
import { CURRENCIES, type Currency } from "@pymeshub/shared/money";
import {
	cadencesFor,
	type Cadence,
	effectivePlan,
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	ivaOn,
	netOfIva,
	periodDaysFor,
	PLAN_LIMITS,
	PLAN_ORDER,
	type Plan,
	type PriceBookPrices,
	priceMinorFor,
	STATUS_IS_LISTED,
	type SubscriptionStatus,
	subscriptionStatusAt,
} from "@pymeshub/shared/plans";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";

import { ValidationError } from "../errors";
import { auditStatement, requireReason } from "./audit";
import {
	type BusinessContext,
	batchOf,
	orNotFound,
	type UserContext,
} from "./helpers";

/**
 * Charging, and the price book that makes raising it survivable.
 *
 * The business in one paragraph: **the consumer pays the merchant for products and the
 * courier for delivery; the platform charges the merchant a flat fee for the app and
 * takes no share of any sale.** That is why there is no settlement code here at all —
 * no gross, no commission, no payout run. The `payout` table that modelled a 10% cut
 * is deleted, and `plan-limits.ts` is the only other thing in the codebase that knows
 * what a merchant paid for.
 *
 * Three rules this module exists to enforce, each of which is a way to charge a
 * merchant something they did not agree to:
 *
 * 1. **A subscription is priced at the moment a period begins**, and `priceMinor` is
 *    a copy from then on. A price rise inserts a `price_book` row and nobody already
 *    subscribed notices — which is the whole mechanism behind "raise the price as the
 *    app grows".
 * 2. **A period is seven or thirty days and not a calendar month.** A merchant's
 *    invoice is the same amount every time, and the period end is a date they can be
 *    told without arithmetic.
 * 3. **The status is derived, never trusted.** `subscriptionStatusAt` recomputes it
 *    from `periodEnd` and `gracedUntil` on every read, so a merchant's access does not
 *    depend on a sweeper having run.
 */

const DAY_MS = 86_400_000;

export { DAY_MS };

/**
 * The price book in force at an instant: the latest one already effective.
 *
 * A date and not an `active` flag, so a price for March can be staged in February and
 * the switch is a comparison. D1 has no partial index, and the ordering is on a
 * timestamp with `id` breaking a tie — two books dated the same day must resolve to
 * the same one on every call, or a merchant's price depends on row order.
 */
export async function activePriceBook(db: Db, at: Date) {
	const rows = await db
		.select()
		.from(priceBookTable)
		.where(lte(priceBookTable.effectiveFrom, at))
		.orderBy(desc(priceBookTable.effectiveFrom), desc(priceBookTable.id))
		.limit(1);
	return orNotFound(rows[0]);
}

/**
 * The current book **with its prices**, as the shape `priceMinorFor` reads.
 *
 * Two reads rather than one join: the book row and its price pairs. A join would multiply
 * the book row across every pair before the "latest by `effectiveFrom`" ordering picked
 * one — the same trap `admin.businesses`' docblock names for its counts.
 *
 * The pairs come back keyed by tier and cadence, so `priceMinorFor` can **throw** on a
 * missing pair rather than the charge path inventing a number.
 */
export async function activePriceBookWithPrices(
	db: Db,
	at: Date,
): Promise<{ id: string; label: string; prices: PriceBookPrices }> {
	// Sequential, not `Promise.all`: the second read needs the book's id, so the "two
	// independent reads" shape the docblock describes is not the one the code can have.
	const book = await activePriceBook(db, at);
	const rows = await db
		.select({
			plan: priceBookPriceTable.plan,
			cadence: priceBookPriceTable.cadence,
			minor: priceBookPriceTable.minor,
		})
		.from(priceBookPriceTable)
		.where(eq(priceBookPriceTable.priceBookId, book.id));

	const prices: PriceBookPrices = {};
	for (const row of rows) {
		const forPlan: Partial<Record<Cadence, number>> = prices[row.plan] ?? {};
		forPlan[row.cadence] = row.minor;
		prices[row.plan] = forPlan;
	}

	return { id: book.id, label: book.label, prices };
}

/**
 * A subscription as the merchant sees it.
 *
 * `daysUntilDue` is what a dashboard actually renders, and it is computed here rather
 * than left to three clients to each round differently. It is `null` rather than zero
 * for a row with no period — a trial has no due date, and showing "0 days until due"
 * for it would tell a merchant to pay for something that has not been asked of them.
 */
export async function current(
	ctx: UserContext,
	businessId: string,
	now: Date,
): Promise<Subscription | null> {
	const rows = await dbSubscription(ctx.db, businessId);
	if (rows.length === 0) return null;
	// `orNotFound` rather than `rows[0]`: `length > 0` above already narrowed this,
	// and the helper is the one that produces the message if that ever stops holding.
	return shapeSubscription(orNotFound(rows[0]), now);
}

async function dbSubscription(db: Db, businessId: string) {
	return db
		.select({
			id: subscriptionTable.id,
			businessId: subscriptionTable.businessId,
			plan: subscriptionTable.plan,
			// Selected for the wire only. It changes nothing a limit reads — limits follow
			// the tier alone — so unlike `plan` it is **not** denormalised onto `business`.
			cadence: subscriptionTable.cadence,
			status: subscriptionTable.status,
			/**
			 * Selected but not put on the wire: `priceBookId` is a foreign key, and the
			 * label a merchant or an invoice shows is `priceBookLabel` below. It is read
			 * here because `changePlan` needs it to know which book a mid-period
			 * subscription is still priced under.
			 */
			priceBookId: subscriptionTable.priceBookId,
			priceMinor: subscriptionTable.priceMinor,
			periodStart: subscriptionTable.periodStart,
			periodEnd: subscriptionTable.periodEnd,
			gracedUntil: subscriptionTable.gracedUntil,
			lastPaidAt: subscriptionTable.lastPaidAt,
			createdAt: subscriptionTable.createdAt,
			priceBookLabel: priceBookTable.label,
			currency: businessTable.currency,
		})
		.from(subscriptionTable)
		.innerJoin(
			priceBookTable,
			eq(priceBookTable.id, subscriptionTable.priceBookId),
		)
		.innerJoin(
			businessTable,
			eq(businessTable.id, subscriptionTable.businessId),
		)
		.where(eq(subscriptionTable.businessId, businessId))
		.limit(1);
}

/** The row as the wire shape. The IVA split happens here and nowhere else. */
function shapeSubscription(
	row: {
		id: string;
		businessId: string;
		plan: Plan;
		cadence: Cadence | null;
		status: SubscriptionStatus;
		priceMinor: number | null;
		periodStart: Date | null;
		periodEnd: Date | null;
		gracedUntil: Date | null;
		lastPaidAt: Date | null;
		createdAt: Date;
		priceBookLabel: string;
		currency: string;
	},
	now: Date,
): Subscription {
	// Recomputed rather than read: the stored `status` is whatever last wrote the row,
	// and the derived one is correct for this instant.
	const status = subscriptionStatusAt(row, now);
	const daysUntilDue =
		row.periodEnd === null
			? null
			: Math.ceil((row.periodEnd.getTime() - now.getTime()) / DAY_MS);

	return {
		id: row.id,
		businessId: row.businessId,
		plan: row.plan,
		cadence: row.cadence,
		status,
		priceMinor: row.priceMinor,
		netMinor: row.priceMinor === null ? null : netOf(row.priceMinor),
		ivaMinor: row.priceMinor === null ? null : ivaOf(row.priceMinor),
		currency: currencyOf(row.currency),
		periodStart: row.periodStart,
		periodEnd: row.periodEnd,
		gracedUntil:
			status === "GRACE" || status === "PAST_DUE" ? row.gracedUntil : null,
		daysUntilDue,
		lastPaidAt: row.lastPaidAt,
		listed: STATUS_IS_LISTED[status],
		priceBookLabel: row.priceBookLabel,
	};
}

function currencyOf(value: string): Currency {
	const currency = CURRENCIES.find((candidate) => candidate === value);
	if (!currency)
		throw new ValidationError("La moneda del negocio no es válida");
	return currency;
}

function netOf(gross: number): number {
	return netOfIva(gross);
}
function ivaOf(gross: number): number {
	return ivaOn(gross);
}

/**
 * Putting a merchant on a plan, and what it costs.
 *
 * The two plans are read as `planOptions` so the picker and the charge cannot
 * disagree — the numbers a merchant is shown to choose are the numbers written to
 * `priceMinor`.
 */
export async function planOptions(ctx: BusinessContext): Promise<PlanOption[]> {
	// The prices are a **child table** now, so the book is read as one row plus its pairs
	// rather than as two columns on the book itself.
	const book = await activePriceBookWithPrices(ctx.db, new Date());
	const currentPlan = effectivePlan(ctx.businessPlan, ctx.subscriptionStatus);
	const currentCadence = ctx.subscriptionCadence ?? null;

	/**
	 * One entry per **(tier, cadence)** pair, not per tier.
	 *
	 * `FREE` contributes a single entry with a zero price and no period, because a picker
	 * that omits the free plan cannot answer "what does this cost me" — the answer is
	 * nothing, and that is the answer a merchant needs before they will pay anything.
	 * `isFree` is what tells the client to render it as a button that subscribes rather
	 * than a price with a checkout.
	 *
	 * Every paid pair is priced from the same read as the charge, so the number a merchant
	 * is shown to choose is the number written to `priceMinor`. A pair the book does not
	 * carry is **skipped rather than defaulted to zero**: a tier whose annual price has not
	 * been inserted yet must not be offered as free.
	 */
	const options: PlanOption[] = [];

	for (const plan of PLAN_ORDER) {
		const limits = {
			locations: PLAN_LIMITS[plan].locations,
			staffAccounts: PLAN_LIMITS[plan].staffAccounts,
			products: PLAN_LIMITS[plan].products,
			optionGroupsPerProduct: PLAN_LIMITS[plan].optionGroupsPerProduct,
			optionsPerGroup: PLAN_LIMITS[plan].optionsPerGroup,
			imagesPerProduct: PLAN_LIMITS[plan].imagesPerProduct,
			storageBytes: PLAN_LIMITS[plan].storageBytes,
			activePromotions: PLAN_LIMITS[plan].activePromotions,
			analyticsDays: PLAN_LIMITS[plan].analyticsDays,
			inventoryTracking: PLAN_LIMITS[plan].inventoryTracking,
		};
		const isCurrent = plan === currentPlan;
		const isCeiling = !hasAnyHeadroomAbove(plan);

		if (plan === "FREE") {
			options.push({
				plan,
				cadence: null,
				isFree: true,
				priceMinor: 0,
				netMinor: 0,
				ivaMinor: 0,
				periodDays: null,
				limits,
				isCurrent,
				isCeiling,
			});
			continue;
		}

		for (const cadence of cadencesFor(plan)) {
			const minor = book.prices[plan]?.[cadence];
			if (typeof minor !== "number") continue;
			options.push({
				plan,
				cadence,
				isFree: false,
				priceMinor: minor,
				netMinor: netOfIva(minor),
				ivaMinor: ivaOf(minor),
				periodDays: periodDaysFor(plan, cadence),
				limits,
				isCurrent: isCurrent && currentCadence === cadence,
				isCeiling,
			});
		}
	}

	return options;
}

function hasAnyHeadroomAbove(plan: Plan): boolean {
	const index = PLAN_ORDER.indexOf(plan);
	return PLAN_ORDER.slice(index + 1).some((higher) => {
		const a = PLAN_LIMITS[plan];
		const b = PLAN_LIMITS[higher];
		return (Object.keys(a) as (keyof typeof a)[]).some((key) => {
			const left = a[key];
			const right = b[key];
			return typeof left === "number" && typeof right === "number"
				? right > left
				: right !== left;
		});
	});
}

/**
 * Changing a merchant's plan.
 *
 * Two cases, and the difference is whether they have been charged yet:
 *
 * - **Never charged** (no period, or a `priceMinor` of null) — the new plan and the
 *   current price book are written together, and `periodStart` is set. This is a
 *   signup, not a change.
 * - **Mid-period** — the plan moves **now** and the new price is captured from the
 *   next period, so a merchant who upgrades on day 29 of a month is not charged a
 *   second time four weeks early. `priceMinor` keeps the figure they are currently
 *   paying until their period ends.
 *
 * `business.plan` is written in the **same batch** as the subscription. That is the
 * only thing keeping the denormalised copy honest, and it is why this is a batch
 * rather than two awaited writes: a crash between them leaves a merchant whose limits
 * and whose record disagree, and the direction of that disagreement is "more access
 * than they paid for".
 */
export async function changePlan(
	ctx: BusinessContext,
	plan: Plan,
	cadence: Cadence | null,
	now: Date,
): Promise<Subscription> {
	const db = ctx.db;
	const existing = await dbSubscription(db, ctx.membership.businessId);
	const book = await activePriceBookWithPrices(db, now);

	/**
	 * `FREE` is priced at nothing and has no period, and it is the one plan a merchant can
	 * move to that involves no money at all.
	 *
	 * Everything downstream reads `cadence` rather than re-deriving it from the plan, so
	 * `FREE` is not special-cased in five places — it is just a plan with no cadence, and
	 * `periodDaysFor` already returns `null` for it.
	 */
	const price = plan === "FREE" ? null : priceMinorFor(plan, cadence ?? "MONTHLY", book);

	/**
	 * Rewrite the denormalised pair on `business`, from the status as of `now`.
	 *
	 * `business.plan` and `business.listed` are both derived from this row, and both are
	 * read on paths that do not join the subscription — the feed filter runs on every
	 * card. Writing them in the same batch as the subscription is what keeps them true,
	 * and the direction of the failure matters: a crash between two awaited writes leaves
	 * a merchant whose limits and whose record disagree, and the disagreement that costs
	 * the platform money is "more access than they paid for".
	 *
	 * `effectivePlan` and not `paidPlan`, so a shop changing plans while `PAST_DUE` is
	 * written the floor plan it is actually being held to rather than the one it bought.
	 */
	const syncBusiness = (paidPlan: Plan, status: SubscriptionStatus) =>
		db
			.update(businessTable)
			.set({
				plan: effectivePlan(paidPlan, status),
				listed: STATUS_IS_LISTED[status],
			})
			.where(eq(businessTable.id, ctx.membership.businessId));

	if (existing.length === 0) {
		// No subscription row: sign them up. The floor plan is what they get for free,
		// so a signup is never a downgrade past it.
		const id = newId("subscription");
		// **A free signup has no period at all** — not a zero-length one. `periodStart` and
		// `periodEnd` stay null, which is what `subscriptionStatusAt` reads to know nothing
		// was ever charged, and what `PLAN_PERIOD_DAYS`'s `null` exists to express.
		const periodDays = periodDaysFor(plan, cadence ?? "MONTHLY");
		await db.batch(
			batchOf([
				db.insert(subscriptionTable).values({
					id,
					businessId: ctx.membership.businessId,
					plan,
					cadence,
					priceBookId: book.id,
					priceMinor: price,
					status: "ACTIVE",
					periodStart: periodDays === null ? null : now,
					periodEnd:
						periodDays === null
							? null
							: new Date(now.getTime() + periodDays * DAY_MS),
					gracedUntil: null,
					lastPaidAt: null,
					createdAt: now,
					updatedAt: now,
				}),
				syncBusiness(plan, "ACTIVE"),
			]),
		);
		const created = await dbSubscription(db, ctx.membership.businessId);
		return shapeSubscription(orNotFound(created[0]), now);
	}

	const row = orNotFound(existing[0]);
	const charged = row.priceMinor !== null;
	const periodEnd = row.periodEnd;

	/**
	 * A change with nothing to settle either way is not a change.
	 *
	 * Both axes, because with two of them "same plan" is no longer sufficient: a merchant
	 * moving from monthly to annual **is** changing something, and one moving from monthly
	 * to monthly is not. `charged` is what separates them — a `FREE` row is never charged,
	 * so re-selecting `FREE` on it is the no-op.
	 */
	const samePosition = row.plan === plan && row.cadence === cadence;
	if (samePosition && charged) {
		return shapeSubscription(row, now);
	}

	// Mid-period upgrade: the new limits apply now, the new price at the next period.
	// `priceMinor` is left alone deliberately — see the docblock.
	const periodEnded =
		periodEnd !== null && periodEnd.getTime() <= now.getTime();
	const nextPrice = charged && !periodEnded ? row.priceMinor : price;
	// The cadence moves **with the plan, immediately** even mid-period: it says when the
	// *next* invoice falls, and holding the old one while the new price is already captured
	// would show a merchant "next charge in 30 days" on a plan billed yearly.
	const nextPeriodDays = periodDaysFor(plan, cadence ?? "MONTHLY");

	await db.batch(
		batchOf([
			db
				.update(subscriptionTable)
				.set({
					plan,
					cadence,
					priceMinor: nextPrice,
					priceBookId: periodEnded ? book.id : row.priceBookId,
					updatedAt: now,
				})
				.where(eq(subscriptionTable.id, row.id)),
			syncBusiness(plan, subscriptionStatusAt(row, now)),
		]),
	);
	// A move to `FREE` clears the period rather than leaving a stale one behind, so the
	// row's dates cannot describe a period the merchant was never charged for.
	if (nextPeriodDays === null && !periodEnded) {
		await db
			.update(subscriptionTable)
			.set({ periodStart: null, periodEnd: null, gracedUntil: null })
			.where(eq(subscriptionTable.id, row.id));
	}

	const updated = await dbSubscription(db, ctx.membership.businessId);
	return shapeSubscription(orNotFound(updated[0]), now);
}

/**
 * The one place a lapsed shop's denormalised `plan` and `listed` come back into line.
 *
 * `subscriptionStatusAt` is computed on read, so a merchant's *access* is correct the
 * instant their period ends, with no cron involved. But `business.plan` and
 * `business.listed` are materialised, and nothing writes them unless somebody touches
 * the subscription — so a shop that stops paying and is then never edited again would
 * keep the plan it bought and stay in the feed forever.
 *
 * That is the gap this closes, and the cron in `wrangler.toml` runs every minute for
 * exactly this call. It is cheap: one indexed range scan over `periodEnd`, and only
 * rows whose derived status has actually moved are written.
 */
/**
 * Takes a `Db` and a clock, not a context, because **the cron has no caller**.
 *
 * Taking a `UserContext` would mean the scheduled handler fabricating an identity for
 * itself, and an audit trail that records a sweep as though a person did it. A
 * function that writes `business.plan` for every merchant should say plainly that no
 * user is involved.
 */
export async function sweepLapsed(db: Db, now: Date): Promise<number> {
	// Only rows that *could* have moved: a period ending in the future is current, and a
	// row past the hidden window has nothing left to change.
	const hiddenFloor = new Date(
		now.getTime() - (GRACE_DAYS + HIDDEN_AFTER_DAYS + 1) * DAY_MS,
	);
	const rows = await db
		.select({
			id: subscriptionTable.id,
			businessId: subscriptionTable.businessId,
			plan: subscriptionTable.plan,
			status: subscriptionTable.status,
			periodStart: subscriptionTable.periodStart,
			periodEnd: subscriptionTable.periodEnd,
			gracedUntil: subscriptionTable.gracedUntil,
			createdAt: subscriptionTable.createdAt,
			businessPlan: businessTable.plan,
			listed: businessTable.listed,
		})
		.from(subscriptionTable)
		.innerJoin(
			businessTable,
			eq(businessTable.id, subscriptionTable.businessId),
		)
		.where(
			and(
				isNotNull(subscriptionTable.periodEnd),
				lte(subscriptionTable.periodEnd, now),
				gte(subscriptionTable.periodEnd, hiddenFloor),
			),
		);

	const drifted = rows.filter((row) => {
		const status = subscriptionStatusAt(row, now);
		return (
			effectivePlan(row.plan, status) !== row.businessPlan ||
			STATUS_IS_LISTED[status] !== row.listed
		);
	});
	if (drifted.length === 0) return 0;

	// One `case` over the ids rather than a statement per shop: a sweep that fires every
	// minute must not cost one round trip per drifted row, and a merchant base of a
	// thousand lapsing at once is 1,000 statements inside a single cron invocation.
	await db.run(sql`
		update business
		set
			plan = case id ${sql.join(
				drifted.map(
					(row) =>
						sql`when ${row.businessId} then ${effectivePlan(row.plan, subscriptionStatusAt(row, now))}`,
				),
				sql` `,
			)} else plan end,
			listed = case id ${sql.join(
				drifted.map(
					(row) =>
						sql`when ${row.businessId} then ${STATUS_IS_LISTED[subscriptionStatusAt(row, now)] ? 1 : 0}`,
				),
				sql` `,
			)} else listed end
		where id in ${drifted.map((row) => row.businessId)}
	`);

	return drifted.length;
}

/**
 * Recording that money arrived, and starting the next period.
 *
 * Called by an operator with a bank reference, because **there is no gateway in this
 * business**: the platform never touches a consumer's payment, and a merchant paying
 * ₡2,000 a week pays it the way they pay rent. Automated collection would mean a
 * card-on-file flow nobody asked for, and the domain here is a shop that settles
 * weekly.
 *
 * **The amount is checked against the invoice in one direction only.** An overpayment is
 * recorded and audited: a merchant who sends ₡11,000 against a ₡10,000 invoice has
 * overpaid, and that is a conversation for the operator rather than an error to refuse at
 * the door. An **under**payment is refused, because this function grants a whole new period
 * — a shop that pays ₡1 against a ₡2,000 invoice would walk away current, and the arrears
 * beside it would read zero because arrears is derived from `periodEnd`, which this
 * function resets.
 *
 * That direction is not a detail. The check used to fire on *any* mismatch and so could
 * never be reached in practice: `recordSubscriptionPayment` passed
 * `amountMinor: row.priceMinor ?? 0` instead of the operator's figure, which made the
 * comparison `x !== x`. The guard existed, said something sensible, and was dead.
 *
 * The new period is priced from the price book **in force now**, which is the one
 * place a price rise reaches an existing merchant: at their next renewal, not
 * mid-period and not retroactively.
 */
export async function recordPayment(
	ctx: UserContext,
	input: {
		subscriptionId: string;
		amountMinor: number;
		reference: string;
		reason?: string;
	},
	now: Date,
): Promise<Subscription> {
	const db = ctx.db;
	const rows = await db
		.select()
		.from(subscriptionTable)
		.where(eq(subscriptionTable.id, input.subscriptionId))
		.limit(1);
	const row = orNotFound(rows[0]);

	if (row.priceMinor !== null && input.amountMinor < row.priceMinor) {
		// Naming the difference here is the point: this is the number the operator is
		// being asked to reconcile, and it is a shortfall rather than a rounding error.
		throw new ValidationError(
			"El monto recibido es menor que la factura del periodo.",
			{
				field: "amountMinor",
				invoiced: row.priceMinor,
				received: input.amountMinor,
				difference: input.amountMinor - row.priceMinor,
			},
		);
	}

	const book = await activePriceBook(db, now);
	const price = priceMinorFor(row.plan, book);

	await db
		.update(subscriptionTable)
		.set({
			priceBookId: book.id,
			priceMinor: price,
			status: "ACTIVE",
			periodStart: now,
			periodEnd: new Date(now.getTime() + PLAN_PERIOD_DAYS[row.plan] * DAY_MS),
			gracedUntil: null,
			lastPaidAt: now,
			updatedAt: now,
		})
		.where(eq(subscriptionTable.id, row.id));

	const after = await dbSubscription(db, row.businessId);
	return shapeSubscription(orNotFound(after[0]), now);
}

/** The current price, and the next one staged — what an operator needs to see to raise it. */
export async function priceBooks(ctx: UserContext, now: Date) {
	const rows = await ctx.db
		.select()
		.from(priceBookTable)
		.orderBy(desc(priceBookTable.effectiveFrom));
	return rows.map((book) => ({
		...book,
		isCurrent: book.effectiveFrom.getTime() <= now.getTime(),
		/** True for a book dated in the future: staged, not yet charging anybody. */
		isStaged: book.effectiveFrom.getTime() > now.getTime(),
	}));
}

/**
 * Staging a price rise.
 *
 * Refuses a date in the past, and that refusal is the design working rather than a
 * validation nicety: a book dated last week would reprice everyone who joined since,
 * which is the one outcome the whole `priceMinor`-is-a-copy design exists to prevent.
 *
 * **The audit row is in the same `batch` as the insert**, and that is the point of this
 * function having changed. It used to be a bare `insert` followed by a `select`, with no
 * record of who staged the rise or why — even though `subscription.create_price_book` is
 * in `ADMIN_ACTIONS` and in `REASON_REQUIRED_ACTIONS`. Raising the price is the most
 * consequential act on this console, and it was the only one that left no trace. One
 * `db.batch` is the only atomic unit D1 offers, so the book and the account of it land
 * together or not at all.
 */
export async function createPriceBook(
	ctx: UserContext,
	input: {
		label: string;
		weeklyMinor: number;
		monthlyMinor: number;
		effectiveFrom: Date;
		reason: string;
	},
	now: Date,
) {
	const reason = requireReason("subscription.create_price_book", input.reason);

	if (input.effectiveFrom.getTime() < now.getTime()) {
		throw new ValidationError(
			"La vigencia no puede ser pasada: cambiaría el precio a negocios que ya se suscribieron.",
			{ field: "effectiveFrom" },
		);
	}
	const id = newId("priceBook");
	await ctx.db.batch([
		ctx.db.insert(priceBookTable).values({
			id,
			label: input.label,
			weeklyMinor: input.weeklyMinor,
			monthlyMinor: input.monthlyMinor,
			effectiveFrom: input.effectiveFrom,
			createdAt: now,
		}),
		auditStatement(ctx, {
			action: "subscription.create_price_book",
			targetType: "price_book",
			targetId: id,
			before: null,
			after: {
				label: input.label,
				weeklyMinor: input.weeklyMinor,
				monthlyMinor: input.monthlyMinor,
				effectiveFrom: input.effectiveFrom.toISOString(),
			},
			reason,
			now,
		}),
	]);
	return orNotFound(
		(
			await ctx.db
				.select()
				.from(priceBookTable)
				.where(eq(priceBookTable.id, id))
				.limit(1)
		)[0],
	);
}

/** Re-exported so a router can answer "is this shop still findable" without a second import. */
export { isListed as shopIsListed } from "./plan-limits";
