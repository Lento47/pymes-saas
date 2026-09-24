/**
 * Money is an integer in the currency's minor unit, and the exponent that turns
 * it into a display value belongs to the currency rather than to the formatter.
 *
 * The reference implementation this was built from divided every price by 100 and
 * let `Intl` choose the decimals. That is correct for USD and wrong by two orders
 * of magnitude for CRC — the colon has no minor unit, so ₡1 500 formatted that way
 * reads ₡15.00. A price that is wrong by 100× is the kind of bug that reaches a
 * customer, so the exponent table below is ours and `Intl` is only ever asked to
 * draw the number we hand it.
 *
 * Two consequences worth stating once:
 *
 * - `Intl` resolves currency digits from CLDR, which disagrees with ISO 4217 for
 *   several currencies (CLDR gives CRC two decimals, the standard gives it none).
 *   Every format call therefore passes the fraction digits explicitly. `Intl` is
 *   never allowed to guess, because when it guesses it guesses differently from
 *   the payment terminal.
 * - Minor units keep every stored amount an integer. A cart total is exact
 *   addition rather than float drift, which is what makes a payout reconciliation
 *   come out to the cent instead of to ₡0.01 off.
 */

export const CURRENCIES = [
	"CRC",
	"USD",
	"MXN",
	"GTQ",
	"HNL",
	"NIO",
	"PAB",
	"DOP",
	"COP",
	"PEN",
	"CLP",
	"ARS",
	"BRL",
	"EUR",
	"JPY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * ISO 4217 minor-unit exponents. Anything absent is treated as 2, which is the
 * common case, but the zero-decimal currencies are listed rather than inferred:
 * inferring from "looks like a whole number" is how ₡1500 becomes ₡15.
 */
const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
	CRC: 0,
	USD: 2,
	MXN: 2,
	GTQ: 2,
	HNL: 2,
	NIO: 2,
	PAB: 2,
	DOP: 2,
	COP: 2,
	PEN: 2,
	CLP: 0,
	ARS: 2,
	BRL: 2,
	EUR: 2,
	JPY: 0,
};

export function currencyExponent(currency: Currency): number {
	return MINOR_UNIT_EXPONENT[currency] ?? 2;
}

export function isCurrency(value: string): value is Currency {
	return (CURRENCIES as readonly string[]).includes(value);
}

/** The locales a single market needs. es-CR is first because it is the default. */
const DEFAULT_LOCALE = "es-CR";

/**
 * The money formatters, built once per locale and currency rather than once per price.
 *
 * The constructor is the expensive half of `Intl.NumberFormat` — it parses the tag, resolves the
 * currency pattern and builds the object — and `.format()` is the cheap one. Constructing one per
 * call means a screen of prices pays for a pattern it already has: `<Price>` renders on every
 * product row, every featured tile and every order row, and a row with a struck-through compare-at
 * price formats the same value three times (the drawn amount, and the accessible label's copy of
 * it). The four inputs that decide the pattern are the key, so a cache hit cannot return a
 * different string.
 *
 * Nothing is caught here and nothing is stored on failure: a tag the engine rejects raises the
 * same `RangeError` from the same call it always did, every time, because a wrong answer would be
 * worse than a throw — a fallback would change the string.
 */
const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatterFor(
	locale: string,
	currency: Currency,
	exponent: number,
	signed: boolean,
): Intl.NumberFormat {
	const key = `${locale}|${currency}|${exponent}|${signed ? "signed" : "plain"}`;
	const cached = FORMATTERS.get(key);
	if (cached !== undefined) return cached;

	const built = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: exponent,
		maximumFractionDigits: exponent,
		signDisplay: signed ? "exceptZero" : "auto",
	});

	FORMATTERS.set(key, built);

	return built;
}

/**
 * Render minor units as a display string, e.g. `formatMoney(1500, "CRC")` →
 * `"₡1 500"` and `formatMoney(1500, "USD")` → `"$15.00"`.
 *
 * `minimumFractionDigits` and `maximumFractionDigits` are both passed so the
 * output has exactly the currency's own precision — no trailing `.00` on a colon
 * amount, no rounding away of cents on a dollar amount.
 *
 * The formatter itself is `formatterFor`'s and is built once per locale and currency; the
 * signature and the string this returns are unchanged.
 */
export function formatMoney(
	amountMinor: number,
	currency: Currency,
	options: { locale?: string; signed?: boolean } = {},
): string {
	const exponent = currencyExponent(currency);
	const major = amountMinor / 10 ** exponent;
	const signed = options.signed === true;

	return formatterFor(
		options.locale ?? DEFAULT_LOCALE,
		currency,
		exponent,
		signed,
	).format(major);
}

/**
 * The inverse of `formatMoney` for input fields, where a person types a major-unit
 * amount.
 *
 * Both `1,500.50` and `1.500,50` are accepted, because the same seller will type the
 * first on a US keyboard and the second on a Costa Rican one. The rule is positional:
 * whichever separator appears last is the decimal point, and the other is a
 * thousands separator. Deciding from the character alone gets `₡1.500` (fifteen
 * hundred) wrong in the direction that prices a product at ₡1.50.
 *
 * The one judgement call is a separator followed by *more* digits than the currency
 * has. That is grouping, not precision: `1.500` is fifteen hundred colones and also
 * fifteen hundred dollars, because nobody types three decimal places on a price and
 * everybody in this market writes thousands with a dot. The consequence worth stating
 * — `parseMoney("15.999", "USD")` is $15 999, not $16 — is the reading a person
 * typing into a price field almost always means.
 */
export function parseMoney(
	input: string | number,
	currency: Currency,
): number | null {
	const exponent = currencyExponent(currency);

	if (typeof input === "number") {
		if (!Number.isFinite(input)) return null;
		return Math.round(input * 10 ** exponent);
	}

	const cleaned = input.replace(/[^\d.,-]/g, "");
	if (cleaned === "") return null;

	const lastSeparator = Math.max(
		cleaned.lastIndexOf("."),
		cleaned.lastIndexOf(","),
	);
	const decimalDigits =
		lastSeparator === -1 ? 0 : cleaned.length - lastSeparator - 1;

	let normalized = cleaned;
	if (lastSeparator !== -1) {
		// A zero-decimal currency has no cents to type, so a dot or comma in
		// `₡1.500` is only ever a thousands separator. Treating it as a decimal
		// point — the first version of this function did — turns fifteen hundred
		// colones into ₡2.
		const isDecimal =
			exponent > 0 && decimalDigits > 0 && decimalDigits <= exponent;
		const head = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "");
		const tail = cleaned.slice(lastSeparator + 1).replace(/[.,]/g, "");
		normalized = isDecimal ? `${head}.${tail}` : `${head}${tail}`;
	}

	const raw = Number(normalized);
	if (!Number.isFinite(raw)) return null;

	return Math.round(raw * 10 ** exponent);
}

/**
 * Every arithmetic total in the product goes through here so that rounding is
 * decided in one place. Integer minor units mean this is exact addition and the
 * `Math.round` is only there to defend against a float having been introduced by a
 * caller doing its own `* 100`.
 */
export function sumMoney(amounts: readonly number[]): number {
	return Math.round(amounts.reduce((total, amount) => total + amount, 0));
}

/**
 * A percentage of an amount — tax, a platform fee, a discount — rounded to the
 * nearest minor unit.
 *
 * `percent` is a percentage, not a fraction: 13 for Costa Rica's IVA, 20 for a
 * "20% off". That matches `percentSchema` and every promotion row, and it is the
 * form a person types. A fraction would make `percentageOf(subtotal, 13)` mean
 * thirteen hundred percent, which is a bug that produces a plausible-looking
 * number rather than an error.
 */
export function percentageOf(amountMinor: number, percent: number): number {
	return Math.round((amountMinor * percent) / 100);
}

/**
 * The two shapes a promotion can take, matching `promotion.kind` in the schema.
 *
 * A percentage is stored as a percent rather than as a pre-computed amount because
 * a coupon that says "10% off" must take 10% off whatever is in the cart, not 10%
 * of the cart it was created against.
 */
export type Discount =
	| { kind: "FIXED"; valueMinor: number }
	| { kind: "PERCENT"; percent: number };

/** How much a discount takes off. Never more than the amount, and never negative. */
export function discountAmountOf(
	amountMinor: number,
	discount: Discount,
): number {
	const amount =
		discount.kind === "FIXED"
			? discount.valueMinor
			: percentageOf(amountMinor, discount.percent);
	return Math.min(amountMinor, Math.max(0, amount));
}

/**
 * What is left after a discount.
 *
 * Clamped at zero rather than allowed to go negative: a ₡5 000 discount on a ₡1 000
 * order makes the order free, not a ₡4 000 refund the business never agreed to.
 */
export function applyDiscount(amountMinor: number, discount: Discount): number {
	return Math.max(0, amountMinor - discountAmountOf(amountMinor, discount));
}
