import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createTranslator, plural, SUPPORTED_LOCALES } from "./index";

/**
 * `Intl.PluralRules` is absent from Hermes, and this file is why nobody has to
 * remember that again.
 *
 * Hermes is the engine both native apps run on. It does not implement
 * `Intl.PluralRules`. `plural()` used to reach for it on **every call**, so on a phone
 * that was `new undefined(...)`, and the first render of any screen showing a count
 * died there — the frames below are that crash's own output, copied verbatim, so their line
 * numbers are the ones the file carried then; `plural` is at
 * `packages/i18n/src/index.ts:227` (`export function plural(`) today:
 *
 *     undefined cannot be used as a constructor
 *     plural (packages/i18n/src/index.ts:202)
 *     tp (packages/i18n/src/index.ts:183)
 *     Rating (apps/mobile/components/rating.tsx:96)
 *
 * Bun implements it, and so does every browser — so this package's suite was green,
 * and so was the web app, while both native apps threw. The defect was reachable only
 * from the one runtime the suite never runs on, which is the whole reason a test had
 * to be written in the shape below rather than as another call to `plural()`.
 *
 * `plural()` now carries its own table. Two tests keep it honest, and neither implies
 * the other:
 *
 *   1. With the constructor taken away — the phone's runtime, emulated on Bun — the
 *      translator still answers. Anything in this package that reaches for the
 *      platform again fails here, on Bun, before a phone sees it.
 *   2. With the constructor present, the table is held against `Intl.PluralRules`
 *      itself across a wide range of counts. That is what makes the table a
 *      reimplementation rather than a behaviour change: the Worker, the browser and
 *      the phone must not start disagreeing about the same number.
 */

/**
 * The `Intl` members removed below.
 *
 * Two, and both because this repository has evidence for them rather than because this
 * is a guess at Hermes' full inventory: `PluralRules` from the crash above, and
 * `RelativeTimeFormat` from the `typeof Intl.RelativeTimeFormat !== "function"` guard
 * that `apps/mobile/lib/format.ts` already carries by hand. Anything else the engine
 * lacks is not claimed here.
 */
const HERMES_MISSING_INTL = ["PluralRules", "RelativeTimeFormat"] as const;

const intl = Intl as unknown as Record<string, unknown>;

/** Each member's value before the test took it away, so it goes back unchanged. */
let removed: [string, unknown][] = [];

describe("on a runtime without the Intl members Hermes is missing", () => {
	beforeEach(() => {
		removed = HERMES_MISSING_INTL.filter((name) => name in intl).map((name) => [
			name,
			intl[name],
		]);
		for (const name of HERMES_MISSING_INTL) {
			// `value: undefined` rather than `delete`. On the phone the property exists
			// and is not a constructor, which is what makes the error message read
			// "undefined cannot be used as a constructor" instead of "not a function" —
			// this reproduces the engine rather than a tidier version of it.
			Object.defineProperty(intl, name, {
				value: undefined,
				configurable: true,
				writable: true,
			});
		}
	});

	afterEach(() => {
		for (const [name, value] of removed) {
			Object.defineProperty(intl, name, {
				value,
				configurable: true,
				writable: true,
			});
		}
		removed = [];
	});

	test("the constructors really are gone, so the rest of this block means something", () => {
		// Without this, a typo in a name above would leave every test below running on a
		// runtime that still has `PluralRules` — passing, and proving nothing. This is
		// also the direct evidence that the emulation has teeth: it is the old
		// implementation's own line, throwing the phone's own message.
		expect(Intl.PluralRules).toBeUndefined();
		expect(Intl.RelativeTimeFormat).toBeUndefined();
		expect(() => new Intl.PluralRules("es")).toThrow();
	});

	test("plural() answers one and other, and zero is other", () => {
		const forms = { one: "artículo", other: "artículos" };
		expect(plural("es", 1, forms)).toBe("artículo");
		expect(plural("es", 0, forms)).toBe("artículos");
		expect(plural("es", 2, forms)).toBe("artículos");
		expect(plural("en", 1, { one: "review", other: "reviews" })).toBe("review");
		expect(plural("en", 0, { one: "review", other: "reviews" })).toBe(
			"reviews",
		);
	});

	test("tp() renders the exact frame the native crash report named", () => {
		// `Rating`, on both native apps, first render. This is the call that threw, so it
		// is the call that has to be here — a test of `plural()` alone would not have
		// covered the `_plural` lookup above it.
		const es = createTranslator("es");
		expect(es.tp("store.rating.count", 1)).toBe("1 reseña");
		expect(es.tp("store.rating.count", 0)).toBe("0 reseñas");
		expect(es.tp("store.rating.count", 128)).toBe("128 reseñas");

		const en = createTranslator("en");
		expect(en.tp("store.rating.count", 1)).toBe("1 review");
		expect(en.tp("store.rating.count", 128)).toBe("128 reviews");
	});

	test("every locale renders a count with no Intl at all", () => {
		// Both locales, not just the default: the locale that is not the developer's is
		// the one that gets exercised least, and it is the same code path either way.
		for (const locale of SUPPORTED_LOCALES) {
			const { tp } = createTranslator(locale);
			for (const count of [0, 1, 2, 5, 99, 1000]) {
				expect(tp("store.rating.count", count)).toContain(String(count));
			}
		}
	});
});

describe("against the platform rule it replaces", () => {
	/**
	 * Wide on purpose, and the negatives are the reason: `0` and `1` and `2` cannot tell
	 * `count === 1` apart from `Math.abs(count) === 1`, and CLDR's `n` is the absolute
	 * value — so `-1` is the one count in here that a plausible-looking table gets wrong.
	 */
	const COUNTS = [
		0, 1, 2, 3, 4, 5, 10, 11, 19, 20, 21, 22, 100, 101, 1000, 1001, 42, 99, -1,
		-2, -11, -100, 0.5, 1.5, 2.5, -1.5,
	];

	test.each([...SUPPORTED_LOCALES])(
		"%s selects every count the way Intl.PluralRules selects it",
		(locale) => {
			const platform = new Intl.PluralRules(locale);
			const disagreements = COUNTS.filter(
				(count) =>
					plural(locale, count, { one: "one", other: "other" }) !==
					(platform.select(count) === "one" ? "one" : "other"),
			);

			expect(disagreements).toEqual([]);
		},
	);

	test("the range is wide enough to have caught the absolute-value case", () => {
		// The guard on the guard. A range of `[0, 1, 2]` passes for a table that reads
		// `count === 1`, so this states the fact that makes `-1` worth carrying: the
		// platform calls a negative one singular, because `n` is an absolute value.
		expect(COUNTS.some((count) => count < 0)).toBe(true);
		expect(new Intl.PluralRules("es").select(-1)).toBe("one");
		expect(new Intl.PluralRules("en").select(-1)).toBe("one");
	});
});
