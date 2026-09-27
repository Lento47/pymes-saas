/** The first market uses Costa Rica wall time for business reporting. */
export const MARKET_TIME_ZONE = "America/Costa_Rica";
export const MARKET_UTC_OFFSET_MINUTES = -360;

const MARKET_OFFSET_MS = MARKET_UTC_OFFSET_MINUTES * 60_000;

/** The Costa Rica calendar date containing this instant. */
export function marketDayKey(at: Date): string {
	return new Date(at.getTime() + MARKET_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant at which this Costa Rica calendar day began. */
export function startOfMarketDay(at: Date): Date {
	const local = new Date(at.getTime() + MARKET_OFFSET_MS);
	return new Date(
		Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
			MARKET_OFFSET_MS,
	);
}

/** Move by calendar years while keeping Costa Rica wall time; clamp February 29. */
export function shiftMarketYears(at: Date, years: number): Date {
	const local = new Date(at.getTime() + MARKET_OFFSET_MS);
	const year = local.getUTCFullYear() + years;
	const month = local.getUTCMonth();
	const day = Math.min(
		local.getUTCDate(),
		new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
	);
	return new Date(
		Date.UTC(
			year,
			month,
			day,
			local.getUTCHours(),
			local.getUTCMinutes(),
			local.getUTCSeconds(),
			local.getUTCMilliseconds(),
		) - MARKET_OFFSET_MS,
	);
}

/**
 * Move by calendar months while keeping Costa Rica wall time; clamp short months.
 *
 * The twin of `shiftMarketYears` for the analytics window, which offers "last 3 months"
 * beside "last 1 year": `Math.round(30.44 * n)` days would drift across a February and
 * report a window that starts mid-month, and `Date`'s own rollover turns "January 31 minus
 * one month" into March 3 rather than December 31. The month walk clamps instead — the 31st
 * of May minus three months is the 29th of February in a leap year, the last day the target
 * month has, which is the same contract `shiftMarketYears` keeps for February 29.
 *
 * The year carry is `Math.floor(total / 12)` over the summed month index (not a
 * year-by-year loop), so a shift of -14 from January lands on November of the year before
 * rather than somewhere depending on the iteration order; the `%` is rebased with `+ 12`
 * because a negative remainder would name month -1.
 */
export function shiftMarketMonths(at: Date, months: number): Date {
	const local = new Date(at.getTime() + MARKET_OFFSET_MS);
	const total = local.getUTCMonth() + months;
	const year = local.getUTCFullYear() + Math.floor(total / 12);
	const month = ((total % 12) + 12) % 12;
	const day = Math.min(
		local.getUTCDate(),
		new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
	);
	return new Date(
		Date.UTC(
			year,
			month,
			day,
			local.getUTCHours(),
			local.getUTCMinutes(),
			local.getUTCSeconds(),
			local.getUTCMilliseconds(),
		) - MARKET_OFFSET_MS,
	);
}
