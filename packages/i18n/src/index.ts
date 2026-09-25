/**
 * `@pymeshub/i18n` — the words, in one place, for a Worker, a browser and a phone.
 *
 * Hand-rolled rather than `next-intl` or `i18next`, for one reason that decides it:
 * **the same strings have to render in a React Server Component, a client component
 * and a React Native screen.** The libraries that do this well are each bound to one
 * of those three, and the alternative — one library in the web app and another in the
 * app — is two sets of keys that drift until a phone says something the browser does
 * not.
 *
 * ## The shape
 *
 * - `SUPPORTED_LOCALES` is closed: `["es", "en"]`. Spanish is the default, because
 *   the businesses are Costa Rican and the person reading the screen is far more
 *   often the shop than the tourist.
 * - Messages are flat, dot-namespaced strings (`"cart.empty.title"`), grouped into
 *   per-domain files. Flat rather than nested because a missing key then has one
 *   obvious spelling in a log line, and because a nested object makes "does this key
 *   exist" a runtime walk.
 * - Every locale implements `Messages` — `Record<MessageKey, string>` — so a key
 *   added to Spanish and forgotten in English is a **compile error**, not a screen
 *   that silently shows `cart.empty.title`. That type is the entire reason this is
 *   worth writing by hand.
 * - Plurals are a `_plural` sibling (`biz.board.items` / `biz.board.items_plural`),
 *   read through `tp()`. Two forms is what `es` and `en` have; a locale with more
 *   (Russian's few/many, Arabic's six) would need this convention replaced with a
 *   real keyed structure rather than extended, and that is a deliberate trade —
 *   building the general shape now would be a table nobody reads for two languages
 *   that do not use it.
 *
 *   The guard is on one side only. `tp` refuses a key with no `_plural` sibling
 *   (`PluralKey`), but `t` still accepts `MessageKey`, so `t("cart.items_plural")` would
 *   compile and draw the *many* form for a count of one. Narrowing `t` to exclude
 *   `_plural` was tried and measured: it is a ~40-signature change (every helper taking a
 *   translator, every `MessageKey` prop) and it surfaced **no call site that passes a
 *   `_plural` key** — the convention already holds everywhere, each use of `tp` carrying a
 *   comment saying so. So it is deferred hardening rather than an open hole, and anyone
 *   who repeats the experiment should expect the same churn and the same nothing.
 *
 * ## What is deliberately not here
 *
 * No locale in a URL. The locale is a cookie (`pymeshub_locale`) and a device
 * setting, never a path segment: `/es/…` and `/en/…` are two URLs for one storefront,
 * which splits every share link, every cache key and every canonical tag in two. A
 * marketplace link is a link to a *shop*, and the language it opens in is the
 * reader's business.
 */

import type { OrderStatus } from "@pymeshub/shared/order-state";

import { en } from "./messages/en/index";
import { es } from "./messages/es/index";
import type { MessageKey, Messages } from "./messages/types";

export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** The cookie the choice is remembered in. Read by the web app and the Worker. */
export const LOCALE_COOKIE = "pymeshub_locale";

const DICTIONARIES: Record<Locale, Messages> = { es, en };

export function isLocale(value: unknown): value is Locale {
	return (
		typeof value === "string" &&
		(SUPPORTED_LOCALES as readonly string[]).includes(value)
	);
}

/**
 * Pick a locale from whatever the caller has, in order of authority:
 * an explicit choice, then the browser's preference list, then the default.
 *
 * The browser's own ordering is respected rather than our array's: a reader whose
 * languages are `["en-GB", "es"]` prefers English, and a loop over
 * `SUPPORTED_LOCALES` would hand them Spanish because `es` comes first in ours.
 */
export function resolveLocale(options: {
	cookie?: string | null;
	acceptLanguage?: string | null;
}): Locale {
	if (isLocale(options.cookie)) return options.cookie;

	for (const tag of parseAcceptLanguage(options.acceptLanguage)) {
		if (isLocale(tag)) return tag;
	}
	return DEFAULT_LOCALE;
}

/** `"es-CR,es;q=0.9,en;q=0.8"` → `["es-CR", "es", "en"]`, in the reader's own order. */
function parseAcceptLanguage(header: string | null | undefined): string[] {
	if (!header) return [];
	return (
		header
			.split(",")
			.map((part) => {
				const [tag, ...params] = part.trim().split(";");
				const q = params
					.map((param) => /^q=([0-9.]+)$/.exec(param.trim()))
					.map((match) => (match ? Number.parseFloat(match[1] ?? "1") : 1))
					.reduce((best, value) => Math.min(best, value), 1);
				return { tag: (tag ?? "").trim().toLowerCase(), q };
			})
			.filter((entry) => entry.tag.length > 0 && entry.q > 0)
			.sort((a, b) => b.q - a.q)
			// `es-CR` means Spanish, and the region is not ours to honour — a Costa
			// Rican shop and a Spanish one read the same words here.
			.map((entry) => entry.tag.split("-")[0] ?? entry.tag)
	);
}

export type TranslateParams = Record<string, string | number>;

/** The `_plural` sibling of a key, or `never` if there isn't one.
 *
 * This is what makes the plural convention safe rather than a naming habit: `tp("biz.board.items", 3)`
 * only compiles when `biz.board.items_plural` exists, so forgetting the plural form is a
 * type error at the call site instead of a screen reading "3 artículo".
 */
// The suffix is removed by distribution rather than by a mapped type over the whole
// union: with more than a thousand message keys, that mapped type pushed TypeScript's
// instantiation depth past its limit before it could prove the guard.
type RemovePluralSuffix<K> = K extends `${infer Base}_plural` ? Base : never;
export type PluralKey = Extract<RemovePluralSuffix<MessageKey>, MessageKey>;

export type Translator = {
	/** The message, with `{name}` placeholders filled. */
	t: (key: MessageKey, params?: TranslateParams) => string;
	/**
	 * The message for `count`, chosen by `plural`, with `{count}` filled in.
	 *
	 * Wraps `plural()` so a call site never spells out both forms — they live in the
	 * dictionary as `key` and `key_plural`, which is what lets a translator add a language
	 * without touching a component. The parameter type is `PluralKey`, so calling this
	 * with a key that has no plural form is a compile error rather than a screen reading
	 * "3 artículo".
	 */
	tp: (key: PluralKey, count: number, params?: TranslateParams) => string;
	locale: Locale;
	/** For `Intl.DateTimeFormat` and `Intl.NumberFormat`, which want a full tag. */
	intlLocale: string;
};

/** `es` → `es-CR`. The region is what makes a date read `15/09/2026` and a name sort right. */
const INTL_LOCALES: Record<Locale, string> = { es: "es-CR", en: "en-US" };

/**
 * A translator for one locale.
 *
 * `{name}` interpolation, and **no formatting logic**: a parameter that is money
 * arrives already formatted by `formatMoney` from `@pymeshub/shared`, and a date by
 * `Intl`. A translation layer that also knows how to format a currency is a layer
 * where `₡1.500` gets divided by 100 for one locale and not the other.
 *
 * A missing key returns the key itself rather than an empty string. An empty string
 * is a blank space on a screen that nobody reports; `cart.empty.title` on a screen
 * gets reported in a minute.
 */
export function createTranslator(locale: Locale): Translator {
	const dictionary = DICTIONARIES[locale];
	const intlLocale = INTL_LOCALES[locale];

	const fill = (template: string, params?: TranslateParams): string => {
		if (!params) return template;
		return template.replace(/\{(\w+)\}/g, (match, name: string) => {
			const value = params[name];
			return value === undefined ? match : String(value);
		});
	};

	return {
		locale,
		intlLocale,
		t: (key, params) => fill(dictionary[key] ?? key, params),
		tp: (key, count, params) => {
			// The cast is the one place the `_plural` convention is spelled out. It is safe
			// because `PluralKey` only admits keys whose sibling exists — the type system
			// proved it before the lookup happened, and a suffix is not expressible as a
			// `MessageKey` without one.
			const other = dictionary[`${key}_plural` as MessageKey] ?? key;
			const chosen = plural(locale, count, { one: dictionary[key], other });
			return fill(chosen, { count, ...params });
		},
	};
}

/**
 * Which form a count takes, in this locale. A table, and not `Intl.PluralRules`.
 *
 * **Hermes does not implement `Intl.PluralRules`.** It ships `NumberFormat`,
 * `DateTimeFormat`, `Collator` and `getCanonicalLocales`, and that one is missing — so
 * on a phone `new Intl.PluralRules(...)` is `new undefined(...)`, and the first render
 * of any screen that shows a count dies with "undefined cannot be used as a
 * constructor". Bun and every browser do implement it, so this was reachable *only*
 * from a phone: `bun test` was green and the web app was fine while both native apps
 * threw on the first `tp()`.
 *
 * The first version of this function used the platform feature and its comment said
 * the rules "are a platform feature and cost nothing". They cost the phone. A table
 * cannot be absent from a runtime, and `Record<Locale, …>` keeps the property that
 * comment was reaching for — a third locale does not compile until its rule is written
 * here, which is the same guarantee the type checker already gives a third dictionary.
 *
 * Deliberately **not** a `typeof Intl.PluralRules === "function"` fallback: that would
 * let the browser and the phone disagree about the same count, and this package exists
 * so a string renders identically in a server component, a browser and a native screen.
 */
const PLURAL_RULES: Record<Locale, (count: number) => "one" | "other"> = {
	// `Math.abs(count) === 1`, and not `count === 1`: both locales' CLDR rule is `n = 1`,
	// and `n` is the **absolute** value of the number, so the platform answers "one" for
	// -1 as readily as for 1. A review count cannot be negative, but the property this
	// table exists to hold is that the phone and the browser give the same answer — not
	// that the phone's answer is defensible. `plural.test.ts` checks this table against
	// `Intl.PluralRules` itself over a range that includes negatives, and `count === 1`
	// fails that check on exactly one of them.
	//
	// It is also `=== 1` and not `<= 1`, which is the character that makes 0 right:
	// both locales read "0 artículos", never "0 artículo".
	es: (count) => (Math.abs(count) === 1 ? "one" : "other"),
	en: (count) => (Math.abs(count) === 1 ? "one" : "other"),
};

export function plural(
	locale: Locale,
	count: number,
	forms: { one: string; other: string },
): string {
	return PLURAL_RULES[locale](count) === "one" ? forms.one : forms.other;
}

/**
 * The week's reference instant: 2024-01-07 was a Sunday, so a `day` of 0–6 indexes off it
 * without the day the app happens to run, or the runtime's own timezone, moving the answer.
 */
const REFERENCE_SUNDAY_UTC = Date.UTC(2024, 0, 7);
const DAY_MS = 86_400_000;

/**
 * The three shapes of clock this file prints, and one formatter each rather than one per call.
 *
 * Asking the platform for a formatter is the expensive half of formatting and `.format()` is the
 * cheap one: the constructor parses the tag, resolves the pattern and builds the object, and the
 * timetable below then prints seven strings from it. An hours table calls `weekdayName` seven
 * times and `formatMinuteOfDay` twice per row — twenty-one `new Intl.DateTimeFormat` per render
 * to produce fourteen strings, on the storefront, which re-renders on every measured section
 * offset. The shapes are constants, so the formatter is one per locale for the life of the
 * module and the table costs one construction ever.
 *
 * A **failure is cached too**, and that is not a shortcut: `RangeError: invalid language tag` is
 * a property of the tag rather than of the call (measured — `new Intl.DateTimeFormat("en_US")`),
 * so the second render would pay for the same throw to reach the same answer. Remembering `null`
 * is remembering the truth, and both callers' contract is unchanged: `null` in, `null` out.
 */
type ClockShape = "weekday" | "h23" | "h24";

const SHAPE_OPTIONS: Record<ClockShape, Intl.DateTimeFormatOptions> = {
	weekday: { weekday: "long", timeZone: "UTC" },
	// Not `hour12: false`, which measured renders *both* ends of the day as `00:00` — see
	// `formatMinuteOfDay`, which is where the two cycles are told apart.
	h23: {
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone: "UTC",
	},
	h24: {
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h24",
		timeZone: "UTC",
	},
};

const FORMATTERS = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(
	shape: ClockShape,
	intlLocale: string,
): Intl.DateTimeFormat | null {
	const key = `${shape}|${intlLocale}`;
	const cached = FORMATTERS.get(key);
	if (cached !== undefined) return cached;

	let built: Intl.DateTimeFormat | null;
	try {
		built = new Intl.DateTimeFormat(intlLocale, SHAPE_OPTIONS[shape]);
	} catch {
		built = null;
	}

	FORMATTERS.set(key, built);

	return built;
}

/**
 * What day 0–6 is called — the index `Date.getDay()` returns and that
 * `businessHoursEntrySchema`'s `day` carries, where 0 is Sunday and 6 is Saturday.
 *
 * Here, and not in `@pymeshub/shared`: that package is what the Worker and its clients must
 * agree on, and the API never renders a weekday — the answer is a *word*, and a word needs a
 * locale tag, which is this package's whole subject. Here, and not beside a `formatDay`,
 * because there are two of those and neither package may import the other
 * (`apps/mobile/lib/format.ts` and `packages/ui/src/lib/format.ts`; a phone imports this
 * package and `@pymeshub/shared` and nothing else). The storefront and the phone print this
 * name for the same shop, so it is one function or it is two answers waiting to disagree —
 * which is what it was: `apps/web/components/catalog/hours.ts` and
 * `apps/mobile/components/hours-table.tsx` each grew their own, one of them unguarded.
 *
 * `Intl.DateTimeFormat` and not a table of fourteen names. Hermes has this constructor — it is
 * the one every timestamp on a phone is already printed through, and `tsconfig.json` beside
 * this file records the inventory: `Intl.DateTimeFormat` and `Intl.NumberFormat` come with the
 * `es2022` lib and the engine, `Intl.PluralRules` is the member that is missing. So the names
 * are the platform's own, in the reader's language, and no Spanish or English one is written
 * down here — a table would be exactly the literal that `docs/design-mobile.md` forbids a lane
 * from reaching for when a key is missing.
 *
 * `null` rather than a throw, the contract `formatMinuteOfDay` keeps and for the same reason:
 * this runs *during render*, and `new Intl.DateTimeFormat("en_US")` raises
 * `RangeError: invalid language tag` (measured), which would take a storefront to an error
 * boundary over one column of a table. A caller's rule is that one line fewer beats one claim
 * more.
 *
 * The formatter is `formatterFor`'s and is built once per locale — see the note there. The
 * `catch` stays around the `format` call and not only around the construction, because the
 * contract is that this function answers `null` instead of throwing, whatever the platform does.
 */
export function weekdayName(day: number, intlLocale: string): string | null {
	const formatter = formatterFor("weekday", intlLocale);
	if (formatter === null) return null;

	try {
		return formatter.format(new Date(REFERENCE_SUNDAY_UTC + day * DAY_MS));
	} catch {
		return null;
	}
}

/**
 * A row's name in the reader's locale, from a Spanish name and an optional English one.
 *
 * A marketplace taxonomy is not a message catalogue: `category.name` is a row in D1, so it
 * cannot go through `MessageKey`, and the two locales live in two columns rather than in two
 * files. `category_name_en` is nullable on purpose — the six demo categories
 * `packages/db/src/seed.ts` writes carry Spanish only — so an English reader falls back to the
 * Spanish name rather than to an empty chip.
 *
 * Written once, here, because the fallback is the part that gets forgotten: a client that reads
 * `nameEn` directly draws `undefined` for those six rows, and the row that is missing is the one
 * nobody is looking at when they ship. The Spanish name is the fallback in *both* directions —
 * a row with no English name is not a row with no name.
 */
export function localizedName(
	row: { name: string; nameEn?: string | null },
	locale: Locale,
): string {
	if (locale === "en" && row.nameEn) return row.nameEn;
	return row.name;
}

/** The last value `businessHoursEntrySchema` allows — midnight at the *end* of the day. */
const END_OF_DAY_MINUTE = 1440;

/**
 * A minute of the day as a timetable clock — `08:00`, `18:00`, and `24:00` for the day's end.
 *
 * Here, and not in a client, for the reason `weekdayName` is: the storefront and the phone print
 * the same shop's hours, and they disagreed about them. `apps/web/components/catalog/hours.ts`
 * had its own `timeOfDay` — `{ hour: "2-digit", minute: "2-digit", hour12: false }`, unguarded —
 * and `closesMinute = 1440`, which `businessHoursEntrySchema` allows, came out of it as `00:00`.
 * The phone prints `24:00`. So a shop open `0 → 1440` with `isClosed: false` read **`00:00–00:00`**
 * on the web storefront and `00:00–24:00` in the app: one timetable saying the shop trades all day
 * and the other saying it never opens. Measured on this runtime (bun 1.4.0, ICU 78.3) with the
 * reference instant below and `timeZone: "UTC"`, in both `es-CR` and `en-US`.
 *
 * ## 0 is the start of the day, 1440 is the end of it, and they must not collide
 *
 * Both are the same wall-clock instant — the same clock face — so no option describing only an
 * instant can separate them: measured, `{ hour: "numeric", minute: "2-digit" }` renders the two as
 * one string, `12:00 a. m.` in `es-CR` and `12:00 AM` in `en-US`. The hour **cycle** names them
 * differently, and the caller's number picks the cycle — minute 0 is `h23`'s `00:00` and minute
 * 1440 is `h24`'s `24:00`, both measured in both locales. `h24` is the cycle in which a day runs
 * 1–24, so its midnight is the 24th hour of the day *ending*, which is what `closesMinute = 1440`
 * states; `hour12: false` is neither cycle and measured collapses both ends onto `00:00`.
 *
 * `24:00` and not a word for midnight, because it is the same kind of value as the rest of the
 * column: a clock a reader compares by scanning, one that sorts after `23:59` and needs no
 * glossary. `minute >= 1440` is the end of the day, including a value past it — 1440 is the
 * schema's cap, and a value past it must not wrap into the next day, because `1500` would print
 * `01:00`, the same string as minute 60, which is the collision this function exists to end.
 *
 * `null` rather than a throw, because this runs *during render*: measured,
 * `new Intl.DateTimeFormat("en_US")` raises `RangeError: invalid language tag`, and a throw here
 * would take a storefront to an error boundary over one row of a table. A tag that is merely
 * *unknown* is not that case — `not-a-locale` is structurally valid, so it silently formats against
 * the default locale and a caller printing it prints a real time in the wrong language rather than
 * `null`. Both callers drop the range rather than print the word "null": one line fewer beats one
 * claim more.
 */
export function formatMinuteOfDay(
	minute: number,
	intlLocale: string,
): string | null {
	const endOfDay = minute >= END_OF_DAY_MINUTE;
	const formatter = formatterFor(endOfDay ? "h24" : "h23", intlLocale);
	if (formatter === null) return null;

	try {
		return formatter.format(
			new Date(REFERENCE_SUNDAY_UTC + (endOfDay ? 0 : minute) * 60_000),
		);
	} catch {
		return null;
	}
}

/**
 * The word on a move button: which key names a move a shop can make on an order.
 *
 * **Here, and not in a client**, because two clients draw it. `apps/web/components/business/order-move.ts`
 * and `apps/mobile/app/business.tsx` each held their own copy of this table — entry for entry
 * identical, which is what made them worth comparing and what nearly hid the defect, since the
 * risk in two copies is never the state they are in today. It is the same shape `weekdayName`
 * and `formatMinuteOfDay` above were extracted from, and for the same reason: the shop's board
 * and the phone's board are the same surface on two devices, so a move button reading one word
 * in the browser and another in the app is two answers waiting to disagree.
 *
 * **Here, and not in `@pymeshub/shared`**, which is the other package both clients import: that
 * package is what the Worker and its clients must agree on, and the API never draws a move
 * button. Its answer is `nextStatuses` — *which* moves the machine allowed — and that stays
 * there (`order-state.ts`). `docs/api-surface.md` states the same split from the other side:
 * "the API has no dictionary and the client renders the words". So the type comes from the
 * domain and the values come from here, each from where it is defined: `OrderStatus` and
 * `FulfilmentKind` are `@pymeshub/shared/order-state`'s — the file that decides which moves
 * exist — and every value below is a `MessageKey`, which is this package's whole subject.
 *
 * A `Record` over the whole union rather than a lookup with a fallback, the guarantee
 * `PLURAL_RULES` above buys: a status added to `ORDER_STATUSES` fails `tsc` here, before it
 * fails a button in a shop's hand.
 *
 * The dictionary's rule for `biz.board.*` is that a move button is a **verb naming what will
 * happen** ("Marcar listo"), never a synonym for the column it moves the order to. Where the
 * order is coming *from* is deliberately not read, and must not be: a button's label is
 * computed before the move, from the `to` the machine already allowed, so a label that depended
 * on `from` would be a second opinion about the state machine living in the UI.
 *
 * The one status whose verb is not in this table is `COMPLETED`: a pickup is collected at the
 * counter and a delivery is handed over at a door, so its word depends on the fulfilment and
 * the caller branches on it before reading this table. That branch is each client's
 * `moveLabelKey`, and it is the residual duplication this move did not close — see that
 * function at both call sites.
 */
export const MOVE_LABELS: Record<OrderStatus, MessageKey> = {
	ACCEPTED: "biz.board.accept",
	REJECTED: "biz.board.reject",
	PREPARING: "biz.board.startPreparing",
	READY: "biz.board.markReady",
	OUT_FOR_DELIVERY: "biz.board.sendOut",
	COMPLETED: "biz.board.markDelivered",
	// A business does cancel, from ACCEPTED onwards, and "Rechazar" is the wrong word for it —
	// nothing is being refused, an order in progress is being called off.
	CANCELLED: "action.cancel",
	// Unreachable: nothing moves an order back to PENDING. Present because the map is a full
	// `Record`, which is what makes a status added to the union fail the build here.
	PENDING: "biz.board.advance",
};

export type { MessageKey, Messages } from "./messages/types";
