/**
 * Dates and times, in the reader's own convention.
 *
 * The one exception is `formatMinuteOfDay` at the foot of the file, and it is the exception
 * because it is not a reader's clock at all: it is a shop's *timetable*, printed the same way on
 * every device, and it is re-exported from `@pymeshub/i18n` so the browser and the phone cannot
 * hold two of it.
 *
 * Money is **not** here. Money is an integer in the currency's minor unit and it is
 * formatted by `formatMoney` / `<Price>` and by nothing else — a second formatter is a
 * second place that can divide a colón by 100, and CRC has no minor unit to divide. These
 * are the leftovers: a timestamp on an order, a countdown to a pickup window.
 *
 * `Intl` rather than a date library. The device already knows what "15/09" looks like and
 * which clock the customer reads; a library would be a download that reimplements it,
 * slightly differently, in a bundle that has to be installed.
 */

/**
 * Every shape this file prints, one formatter each per locale.
 *
 * Building an `Intl.DateTimeFormat` or an `Intl.NumberFormat` is the expensive half of using one —
 * it parses the tag and resolves the pattern, where `.format()` is the cheap half — and every
 * caller of the functions below is a row: the customer's orders list formats three dates and a
 * total per card and re-derives its rows on a ten-second poll, and a business card prints a rating
 * and a distance. The shapes are constants, so each is one formatter per locale for the life of
 * the module rather than one per call.
 *
 * A failure is **not** caught and **not** cached, which is the difference from
 * `@pymeshub/i18n`'s `formatterFor` and is deliberate: these functions have always thrown out of a
 * render on a tag the engine rejects (`RangeError: invalid language tag`), and there is no guard
 * here to preserve. Catching would invent a behaviour; storing only what was built means the throw
 * repeats exactly as often as it did before.
 */
const DATE_SHAPES = {
	day: { day: "2-digit", month: "2-digit", year: "numeric" },
	dayMonth: { day: "numeric", month: "short" },
	clock: { hour: "numeric", minute: "2-digit" },
	stamp: {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	},
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const NUMBER_SHAPES = {
	oneDecimal: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
	atMostOneDecimal: { maximumFractionDigits: 1 },
} as const satisfies Record<string, Intl.NumberFormatOptions>;

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

function dateFormatterFor(
	shape: keyof typeof DATE_SHAPES,
	intlLocale: string,
): Intl.DateTimeFormat {
	const key = `${shape}|${intlLocale}`;
	const cached = DATE_FORMATTERS.get(key);
	if (cached !== undefined) return cached;

	const built = new Intl.DateTimeFormat(intlLocale, DATE_SHAPES[shape]);

	DATE_FORMATTERS.set(key, built);

	return built;
}

function numberFormatterFor(
	shape: keyof typeof NUMBER_SHAPES,
	intlLocale: string,
): Intl.NumberFormat {
	const key = `${shape}|${intlLocale}`;
	const cached = NUMBER_FORMATTERS.get(key);
	if (cached !== undefined) return cached;

	const built = new Intl.NumberFormat(intlLocale, NUMBER_SHAPES[shape]);

	NUMBER_FORMATTERS.set(key, built);

	return built;
}

/** `15/09/2026` in `es-CR`, `9/15/2026` in `en-US`. */
export function formatDay(
	value: Date | string | number,
	intlLocale: string,
): string {
	return dateFormatterFor("day", intlLocale).format(asDate(value));
}

/** `15 sept` in `es-CR`, `Sep 15` in `en-US` — the pulse band's date, a day without a year. */
export function formatDayMonth(
	value: Date | string | number,
	intlLocale: string,
): string {
	return dateFormatterFor("dayMonth", intlLocale).format(asDate(value));
}

/** `2:30 p. m.` in `es-CR`, `2:30 PM` in `en-US`. */
export function formatClock(
	value: Date | string | number,
	intlLocale: string,
): string {
	return dateFormatterFor("clock", intlLocale).format(asDate(value));
}

/**
 * `4.7` — a rating, which is always one decimal because that is the precision `ratingAvg` is
 * stored at.
 *
 * One function for the four places that print it — `./rating`, `./business-card`,
 * `./review-summary` and `app/store/[slug]` — because they must not disagree about the same
 * number, and each of them used to build its own formatter to say the same thing. The web's twin
 * is `formatRating` in `packages/ui/src/lib/format.ts` and is deliberately **not** shared: it
 * pins a bare `es-CR` default locale and rounds with `toFixed`, where this one follows the
 * reader's locale, and the two clients are allowed to differ in a locale the phone has and the
 * browser was not given.
 */
export function formatOneDecimal(value: number, intlLocale: string): string {
	return numberFormatterFor("oneDecimal", intlLocale).format(value);
}

/**
 * `2.4` — a distance in kilometres, which is one decimal at most and no decimal when it is whole.
 *
 * Not `formatOneDecimal`: `2` and not `2.0` for a shop two kilometres away, which is what the two
 * call sites (`./business-card`, `app/store/[slug]`) already printed and must keep printing.
 */
export function formatAtMostOneDecimal(
	value: number,
	intlLocale: string,
): string {
	return numberFormatterFor("atMostOneDecimal", intlLocale).format(value);
}

/**
 * A shop's timetable clock, re-exported — the implementation is `@pymeshub/i18n`'s.
 *
 * Re-exported rather than reimplemented, because it *was* reimplemented: this file held the
 * function, and `apps/web/components/catalog/hours.ts` grew a second one with `hour12: false`
 * and no guard, so a shop open `0 → 1440` — which `businessHoursEntrySchema` allows — read
 * `00:00–00:00` on the web storefront and `00:00–24:00` here. One formatter, in the package both
 * clients already import, is the only shape in which that cannot happen again; it sits beside
 * `weekdayName`, which the same two clients print from the same table of the same shop.
 *
 * The re-export stays, rather than the two screens importing the package directly, because this
 * is the name `docs/design-mobile.md` gives the formatter and the module
 * `components/hours-table` and `app/store/[slug]` already take it from. Why minute 1440 is
 * `24:00`, and why a locale no formatter can be built from answers `null` instead of throwing
 * during render, is documented on the function itself.
 */
export { formatMinuteOfDay } from "@pymeshub/i18n";

/** `15/09/2026 2:30 p. m.` — for a detail line where both matter. */
export function formatStamp(
	value: Date | string | number,
	intlLocale: string,
): string {
	return dateFormatterFor("stamp", intlLocale).format(asDate(value));
}

/**
 * `hace 5 min` / `en 20 min`, for the freshness line under a live order.
 *
 * `Intl.RelativeTimeFormat` and not `"hace " + minutes`, because English needs "5 minutes
 * ago" in that order and Spanish needs "hace 5 minutos" — the two languages disagree about
 * where the number goes, and the platform's formatter is the thing that already knows.
 *
 * Past a day it is no longer freshness, so it hands over to `formatClock`. The loop below
 * picks the largest unit whose magnitude exceeds one, and if `day` were in that list it would
 * be the largest unit there is — an order untouched since last week would read "hace 7 días"
 * on a screen whose whole job is to say how far along it is. The note that used to stand here
 * claimed this hand-over already existed; the code did not have it, and this function had no
 * callers yet, so the sentence was the only thing that was wrong.
 */
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
	["second", 1000],
	["minute", 60_000],
	["hour", 3_600_000],
];

const DAY_MS = 86_400_000;

/**
 * The formatter, or `null` when the engine has none.
 *
 * Hermes implements `Intl` natively rather than through a JavaScript polyfill, so a missing
 * `RelativeTimeFormat` is not something the bundler can catch — it is a property of the engine
 * the phone shipped with. Constructed bare inside `formatRelative` it would throw *during
 * render* and take the whole order screen down to an error boundary, rather than costing one
 * caption line on it, which is the wrong size of failure for the value being displayed.
 *
 * Cached per locale like the two above, and this one had been left out: the function is *named*
 * `relativeFormatter` and built a fresh formatter on every call, which is the expensive half, and
 * its caller is the freshness line under a live order — a row that re-renders on `app/orders`'
 * own ten-second poll for as long as the reader waits on that order. Only a formatter that was
 * built is stored, and the `typeof` guard is checked before the lookup rather than cached, so the
 * file's rule holds: the engine-has-none case costs one property read, and a tag that throws keeps
 * throwing exactly as often as it did before.
 */
const RELATIVE_FORMATTERS = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormatter(intlLocale: string): Intl.RelativeTimeFormat | null {
	if (typeof Intl.RelativeTimeFormat !== "function") return null;

	const cached = RELATIVE_FORMATTERS.get(intlLocale);
	if (cached !== undefined) return cached;

	try {
		const built = new Intl.RelativeTimeFormat(intlLocale, {
			numeric: "auto",
			style: "short",
		});

		RELATIVE_FORMATTERS.set(intlLocale, built);

		return built;
	} catch {
		// A *structurally invalid* tag throws here — `en_US` does, measured on this runtime.
		// A tag that is merely unknown to the engine's data does **not**: `not-a-locale` is a
		// valid tag, so the constructor silently falls back to the default locale and this
		// branch is never reached. The comment that used to stand here claimed the opposite
		// ("a locale the engine does not know throws"), which is why the test that covered it
		// was asserting a throw that does not happen.
		return null;
	}
}

/**
 * The clock, or `null` when the locale cannot build even that.
 *
 * This exists because the `catch` above used to hand straight to `formatClock`, which
 * constructs an `Intl.DateTimeFormat` from the *same* locale — so a locale bad enough to make
 * `RelativeTimeFormat` throw made the fallback throw too, out of render, on the way out of the
 * guard that was written to prevent exactly that. Measured: `new Intl.RelativeTimeFormat("en_US")`
 * and `new Intl.DateTimeFormat("en_US")` both throw `RangeError: invalid language tag`. The
 * guard was one constructor wide and the failure was two.
 *
 * `null` rather than a string, because the caller's rule is already "one line fewer beats one
 * claim more": with no formatter there is no truthful line to write, and the freshness slot is
 * rendered conditionally by every call site.
 */
function clockOrNull(
	value: Date | string | number,
	intlLocale: string,
): string | null {
	try {
		return formatClock(value, intlLocale);
	} catch {
		return null;
	}
}

/**
 * The sentence, or `null` when there is nothing truthful to put in it.
 *
 * `null` rather than a placeholder string, because the caller's rule is already "with no
 * timestamp there is no sentence at all: one line fewer beats one claim more" — an unreadable
 * timestamp is the same case as a missing one. A caller that renders the `{time}` slot
 * unconditionally turns `null` into "Actualizado null", so every call site must check.
 */
export function formatRelative(
	value: Date | string | number,
	intlLocale: string,
	now: number = Date.now(),
): string | null {
	const at = asDate(value).getTime();
	// Unparseable: no line at all. Further from now than a day: the clock, which is a fact
	// either way — and still a locale-dependent one, which is why it goes through the guard.
	if (!Number.isFinite(at)) return null;
	const deltaMs = at - now;
	if (Math.abs(deltaMs) >= DAY_MS) return clockOrNull(value, intlLocale);

	const formatter = relativeFormatter(intlLocale);
	if (!formatter) return clockOrNull(value, intlLocale);

	let [unit, size] = RELATIVE_UNITS[0] as [Intl.RelativeTimeFormatUnit, number];
	for (const entry of RELATIVE_UNITS) {
		// The largest unit whose magnitude still exceeds one — so 90 seconds reads
		// "hace 2 min" rather than "hace 90 s".
		if (Math.abs(deltaMs) >= entry[1]) [unit, size] = entry;
	}

	/**
	 * The magnitude is rounded, then the direction is reapplied — and the order of those
	 * two steps is the whole point of this comment.
	 *
	 * `Math.round(deltaMs / size)` was the first version and it was asymmetric: `Math.round`
	 * breaks a tie toward +Infinity, so 90 seconds *before* now gave `Math.round(-1.5)` =
	 * `-1` — "hace 1 min" — while 90 seconds *after* now gave `Math.round(1.5)` = `2` —
	 * "en 2 min". One distance, two amounts, decided by which side of the present it fell
	 * on. The sentence above this block has always promised "hace 2 min", so for as long as
	 * the code disagreed with it, the comment was the only thing in the file that was wrong.
	 *
	 * `Math.max(1, …)` keeps the smallest unit honest at the other end: a value under one
	 * second rounds to 0, and "hace 0 s"/"en 0 s" is a sentence that reads as a bug rather
	 * than as "now". A zero delta stays zero, which is what `0 s`/`ahora` should be.
	 */
	const magnitude = Math.max(1, Math.round(Math.abs(deltaMs) / size));
	return formatter.format(magnitude * Math.sign(deltaMs), unit);
}

/**
 * Everything the API sends over the wire is superjson-tagged, so a `Date` arrives as a
 * `Date` — these two branches exist only for the places a value has been through
 * `JSON.stringify` anyway, such as a value restored from storage or a cache.
 */
function asDate(value: Date | string | number): Date {
	return value instanceof Date ? value : new Date(value);
}
