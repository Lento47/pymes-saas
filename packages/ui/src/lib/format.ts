/**
 * Formatting shared by every surface.
 *
 * Two conventions hold the whole file together, and both come from the market
 * this product is built for rather than from the browser's default:
 *
 * - **`es-CR` is the default locale**, not `undefined`. `undefined` resolves to
 *   the *runtime's* locale, which on a server is whatever the container was
 *   built with and on a phone is whatever the person set — so the same order
 *   total rendered `₡1 500` in the browser and `CRC 1500.00` in the HTML we
 *   shipped to Google. A default that is written down is the only one that can
 *   be tested.
 * - **Money is an integer in the currency's minor unit, and the formatter is
 *   `@pymeshub/shared/money`.** The function that used to live here divided by
 *   100, which is right for USD and wrong by two orders of magnitude for the
 *   colon. See `adrs/0001-cloudflare-multi-client-marketplace.md`, "Money, and
 *   the bug the design example would have shipped". Nothing in this file does
 *   its own arithmetic on an amount.
 *
 * `relativeTimeFromIso` was defined in `code-security/cs-ui` and imported across
 * module boundaries by People. It is deliberately NOT merged with the
 * epoch-milliseconds `relativeTime` in `apps/app/lib/format-date`: they take
 * different inputs and disagree on the empty case ("—" vs "Never"), so folding
 * them together would silently change copy in one module or the other. Both
 * names are kept so the difference is visible at the call site.
 */

import {
	type Currency,
	currencyExponent,
	formatMoney as formatMoneyMinor,
	isCurrency,
} from "@pymeshub/shared/money";

/** The market. Everything below defaults to it, and every caller may override. */
export const DEFAULT_LOCALE = "es-CR";
export const DEFAULT_CURRENCY: Currency = "CRC";

/**
 * A currency code from the wire is a `string`; the formatter only accepts the
 * fifteen the platform knows. Unknown codes used to be silently rendered as USD,
 * which is how a typo in a business's currency column became a wrong price on a
 * real order. Now an unrecognised code falls back to the market default, and the
 * casing is normalised first because `"usd"` and `"USD"` are the same currency
 * and only one of them is in the union.
 */
function resolveCurrency(currency: string | null | undefined): Currency {
	if (!currency) return DEFAULT_CURRENCY;
	const upper = currency.toUpperCase();
	return isCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

/**
 * Render minor units as display text: `formatMoney(1500, "CRC")` → `"₡1 500"`,
 * `formatMoney(1500, "USD")` → `"$15.00"`.
 *
 * The exponent is the currency's, never a constant — CRC has no minor unit, so
 * the amount is *not* divided by 100. The signature is a thin superset of the
 * one this file used to export, because ~15 call sites still pass cents and a
 * currency code and none of them should have to change to get correct colones.
 */
export function formatMoney(
	amountMinor: number,
	currency: string = DEFAULT_CURRENCY,
	options: { locale?: string; signed?: boolean } = {},
): string {
	return formatMoneyMinor(amountMinor, resolveCurrency(currency), {
		locale: options.locale ?? DEFAULT_LOCALE,
		signed: options.signed,
	});
}

/**
 * `"₡128K"` — a headline where the exact amount is noise.
 *
 * Deliberately separate from `formatMoney`: a figure read at a glance wants
 * three characters, and a figure about to be acted on wants all of them.
 * Rounding a row in a table would be a bug; rounding a KPI is the point.
 */
export function formatMoneyCompact(
	amountMinor: number,
	currency: string = DEFAULT_CURRENCY,
	options: { locale?: string } = {},
): string {
	const resolved = resolveCurrency(currency);
	const exponent = currencyExponent(resolved);
	const major = amountMinor / 10 ** exponent;

	return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
		style: "currency",
		currency: resolved,
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(major);
}

/**
 * A 0–1 rate as a percentage. `rate` is a fraction: `0.13` is Costa Rica's IVA.
 */
export function formatPercent(
	rate: number,
	options: { locale?: string; maximumFractionDigits?: number } = {},
): string {
	return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
		style: "percent",
		maximumFractionDigits: options.maximumFractionDigits ?? 0,
	}).format(rate);
}

/**
 * `4.7` — a 0–5 rating as it is both drawn and spoken: one decimal, or none.
 *
 * A review average arrives from D1 as a raw `avg()` over a `real` column, so it is
 * `4.666666666666667` and not the one decimal the star row prints beside the stars. The
 * accessible sentence names that same number, and a sentence reading "4.666666666666667
 * de 5" is one nobody would have written — so the rounding lives here, once, rather than
 * in each of the six call sites that build a label.
 *
 * `5` and not `5.0`: both locales write a whole number without a decimal, and "5.0 de 5"
 * reads as a measurement rather than as five out of five stars. The clamp mirrors the star
 * row's own, so the number a screen reader hears cannot disagree with the number drawn.
 */
export function formatRating(value: number): string {
	if (!Number.isFinite(value)) return "0";
	const clamped = Math.min(5, Math.max(0, value));
	return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);
}

const dayFormat = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const shortDayFormat = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
	month: "short",
	day: "numeric",
});

const relativeFormat = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
	numeric: "auto",
	style: "short",
});

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * `2026-07-31` — a day on a calendar, which is not an instant.
 *
 * These three go through the date's *parts* rather than `toISOString()` or
 * `new Date(value)`, and that is the whole point of them. `new Date(
 * "2026-07-16")` is midnight **UTC**, which is the 15th anywhere west of it —
 * so a close date rendered a day early in San José, and the field that had been
 * fixed to split the parts then disagreed with the stats strip two inches above
 * it that had not. One definition, so they cannot drift.
 */
export function toDay(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The inverse: local midnight on that day, or nothing if it is not a day. Takes
 * a full ISO timestamp too, reading the day the server stored.
 */
export function fromDay(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const [year, month, day] = value.slice(0, 10).split("-").map(Number);
	if (!year || !month || !day) return undefined;
	const date = new Date(year, month - 1, day);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

/** How a stored day reads: `"16 jul 2026"`. */
export function formatDay(value: string | null | undefined): string {
	const date = fromDay(value);
	return date ? dayFormat.format(date) : (value ?? "—");
}

/**
 * How long ago a stored instant was, in words: `"hace 5 min"`, `"ayer"`.
 *
 * `Intl.RelativeTimeFormat` rather than hand-built English, so the same call
 * reads correctly in a second locale without a second branch — and `numeric:
 * "auto"` is what buys "ayer" instead of "hace 1 día", which is the difference
 * between copy a person wrote and copy a machine emitted.
 *
 * The empty and unparseable cases return `"—"` rather than "nunca": this
 * formats a *stored* instant, and a missing one means we do not know, not that
 * it never happened.
 */
export function relativeTimeFromIso(
	iso: string | null | undefined,
	options: { locale?: string } = {},
): string {
	if (!iso) return "—";
	const then = new Date(iso).getTime();
	if (!Number.isFinite(then)) return "—";

	const format =
		options.locale && options.locale !== DEFAULT_LOCALE
			? new Intl.RelativeTimeFormat(options.locale, {
					numeric: "auto",
					style: "short",
				})
			: relativeFormat;

	const diff = Date.now() - then;
	const abs = Math.abs(diff);
	const minute = 60_000;
	const hour = 60 * minute;
	const day = 24 * hour;

	if (abs < minute) return format.format(0, "second");
	if (abs < hour) return format.format(Math.round(-diff / minute), "minute");
	if (abs < day) return format.format(Math.round(-diff / hour), "hour");
	if (abs < 30 * day) return format.format(Math.round(-diff / day), "day");

	// Past a month, "hace 47 días" is a worse answer than the date itself.
	return shortDayFormat.format(new Date(then));
}

export function initialsFromName(name: string | null | undefined): string {
	const parts = (name ?? "").split(/\s+/).filter(Boolean);
	const first = parts[0];
	if (!first) return "?";
	if (parts.length === 1) return first.slice(0, 2).toUpperCase();
	const last = parts[parts.length - 1] ?? first;
	return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
}
