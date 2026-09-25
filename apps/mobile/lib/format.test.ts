import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { formatMinuteOfDay as sharedFormatMinuteOfDay } from "@pymeshub/i18n";

import {
	formatClock,
	formatDay,
	formatMarketDayMonth,
	formatMinuteOfDay,
	formatRelative,
	formatStamp,
} from "./format";

/**
 * The two answers `formatRelative` gives, and why the second one needed a test.
 *
 * `formatRelative` builds "hace 5 min" with `Intl.RelativeTimeFormat`, and Hermes does not
 * implement that constructor. `packages/i18n/src/plural.test.ts` already names this file as
 * its reason for emulating the engine — it removes `RelativeTimeFormat` alongside
 * `PluralRules` because *this* file guards against it by hand — but the guard itself had no
 * test. So the branch the phone takes was covered by nothing at all, while the two places it
 * runs — the freshness line under a live order (`components/order-timeline.tsx:177`) and the
 * stamp on a review younger than a day (`components/review-list.tsx:360`) — are exercised in
 * a browser, which has the constructor. Same code, two branches, and the branch no customer on
 * a phone will ever see was the one under test.
 *
 * That is the shape of defect this file exists to stop: not a crash, a **divergence**. The two
 * clients were rendering different sentences for the same order — "hace 5 min" on the web
 * target and a clock time on Android — and nothing anywhere compared them.
 *
 * ## The two describes are not the same runtime, and each one proves its own premise
 *
 * The first asserts the constructor is **present** before asserting what it produces; the
 * second asserts it is **absent** before asserting the fallback. Both premises are asserted
 * rather than assumed, because the failure mode of an emulation is silence: if the property
 * removal stops working, a "phone" test quietly becomes a second copy of the engine test and
 * keeps passing. A test that cannot tell you it stopped testing is worse than no test.
 *
 * ## What is emulated, and what is deliberately not
 *
 * Two members, because there is evidence for exactly two — `PluralRules` from the crash
 * recorded in `plural.test.ts`, `RelativeTimeFormat` from the guard in `format.ts`.
 * `DateTimeFormat` and `NumberFormat` are **left in place**: Hermes has them, and removing one
 * would make this file fail for a reason no phone can produce, which is how a suite teaches
 * people to distrust it. `value: undefined` rather than `delete`, so the property exists and
 * is not a constructor — the phone's state, not a tidier version of it.
 *
 * ## The third describe is a re-export, and it is the one that keeps the drift from coming back
 *
 * `formatMinuteOfDay` used to be built here and tested here. Both moved to
 * `packages/i18n/src/minute-of-day.test.ts`, beside the function: `DateTimeFormat` is one of the
 * two members left in place above, precisely because every phone has it, so this function had no
 * Hermes branch to emulate — its `null` is reached the other way, through a structurally invalid
 * tag. The web storefront had meanwhile grown a second copy of the whole thing, with
 * `hour12: false`, and was rendering a shop open `0 → 1440` as `00:00–00:00` while this module
 * rendered `00:00–24:00`. The measurement, the hour cycle and the `null` contract are pinned
 * there now, against the one implementation both clients import.
 *
 * What is left to assert *here* is the part this file can still get wrong — that the module hands
 * out that function rather than a copy of it.
 */

/** The `Intl` members removed in the second describe — the engine's, not a guess at its inventory. */
const HERMES_MISSING_INTL = ["PluralRules", "RelativeTimeFormat"] as const;

const intl = Intl as unknown as Record<string, unknown>;

/** Each member's value before the test took it away, so it goes back unchanged. */
let removed: [string, unknown][] = [];

function removeHermesMissingMembers() {
	removed = HERMES_MISSING_INTL.filter((name) => name in intl).map((name) => [
		name,
		intl[name],
	]);
	for (const name of HERMES_MISSING_INTL) {
		Object.defineProperty(intl, name, {
			value: undefined,
			configurable: true,
			writable: true,
		});
	}
}

/**
 * A fixed instant. A freshness line is a comparison against "now", and a moving `now` makes a
 * flaky test out of a correct one — the 90-second case below is one second away from changing
 * its own answer.
 */
const NOW = new Date("2026-09-21T15:00:00Z").getTime();
const MINUTE = 60_000;

test("merchant pulse labels the Costa Rica day across UTC midnight", () => {
	expect(formatMarketDayMonth("2026-09-21T05:59:59Z", "en-US")).toBe("Sep 20");
	expect(formatMarketDayMonth("2026-09-21T06:00:00Z", "en-US")).toBe("Sep 21");
});

describe("on the engine this suite runs on, constructor present", () => {
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

	test("the premise: RelativeTimeFormat is here, so this describe tests the real sentence", () => {
		expect(typeof Intl.RelativeTimeFormat).toBe("function");
	});

	test("the sentence is the platform's wording, and it is not the clock", () => {
		const fiveMinutesAgo = NOW - 5 * MINUTE;

		// The exact wording belongs to the platform's ICU data, so the assertion is the
		// shape — a count and the short minute unit, in Spanish.
		expect(formatRelative(fiveMinutesAgo, "es-CR", NOW)).toMatch(/5\s*min/);

		// The pair that matters: if a future edit made this branch return the clock, the
		// product would lose its freshness line and only this line would notice.
		expect(formatRelative(fiveMinutesAgo, "es-CR", NOW)).not.toBe(
			formatClock(fiveMinutesAgo, "es-CR"),
		);
	});

	test("the amount is the distance, so both sides of now read the same number", () => {
		// 90 seconds reads "hace 2 min" rather than "hace 90 s" — the granularity decision in
		// `RELATIVE_UNITS`, and reachable only when the constructor exists, which is why it
		// lives here and not in the describe below.
		const ninetySecondsAgo = NOW - 90_000;
		expect(formatRelative(ninetySecondsAgo, "es-CR", NOW)).toMatch(/2\s*min/);

		// And 90 seconds *ahead* reads "dentro de 2 min" — the same number. This half is the
		// defect the first version of this function had, found by writing the line above:
		// it rounded the signed delta, and `Math.round` breaks a tie toward +Infinity, so
		// 1.5 minutes back gave -1 ("hace 1 min") while 1.5 minutes forward gave 2. One
		// distance, two amounts, decided by which side of the present it fell on.
		//
		// Both lines are the assertion. Either alone passes with the bug in place: the past
		// one was the broken side, and the future one was never broken.
		const inNinetySeconds = NOW + 90_000;
		const ahead = formatRelative(inNinetySeconds, "es-CR", NOW);
		expect(ahead).toMatch(/2\s*min/);
		expect(ahead).not.toBe(formatRelative(ninetySecondsAgo, "es-CR", NOW));
	});

	test("under a unit is one of it, never zero of it", () => {
		// The other end of the same rounding: 400ms rounds to 0, and "hace 0 s" is a sentence
		// that reads as a bug rather than as "now". `Math.max(1, …)` is the guard.
		expect(formatRelative(NOW - 400, "es-CR", NOW)).toMatch(/1\s*s/);
		expect(formatRelative(NOW + 400, "es-CR", NOW)).toMatch(/1\s*s/);

		// Zero is the exception, and it should stay the exception: "ahora" is the right word
		// for it and `1 * Math.sign(0)` is `0`, so the value reaching the formatter is still 0.
		expect(formatRelative(NOW, "es-CR", NOW)).toMatch(/ahora/i);
	});

	test("past a day it is the clock, because a week is not freshness", () => {
		// `RELATIVE_UNITS` carries no `day` on purpose: an order untouched since last week
		// would otherwise read "hace 7 días" on a screen whose job is to say how far along
		// it is. This branch shares its answer with the fallback for a different reason —
		// two reasons for one output is what a future edit gets wrong, so both are pinned.
		const twoDaysAgo = NOW - 2 * 86_400_000;
		expect(formatRelative(twoDaysAgo, "es-CR", NOW)).toBe(
			formatClock(twoDaysAgo, "es-CR"),
		);
	});

	test("an unparseable timestamp is no sentence at all, not a placeholder", () => {
		// `null` rather than a string: the caller's rule is "one line fewer beats one claim
		// more", and the freshness slot is rendered conditionally by every call site.
		expect(formatRelative("not a date", "es-CR", NOW)).toBeNull();
	});

	test("the three DateTimeFormat formatters answer, and none of them needs a guard", () => {
		const at = new Date("2026-09-15T14:30:00Z").getTime();
		expect(formatDay(at, "es-CR")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
		expect(formatStamp(at, "es-CR")).toContain(formatClock(at, "es-CR"));
	});
});

describe("on a runtime without the Intl members Hermes is missing", () => {
	beforeEach(() => {
		removeHermesMissingMembers();
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

	test("the premise: the constructor is gone, so this describe tests the phone's branch", () => {
		// Asserted, not assumed. Without this line the whole describe can degrade into a
		// second copy of the one above and never say so.
		expect(typeof Intl.RelativeTimeFormat).not.toBe("function");
	});

	test("the line falls back to the clock, and it is still a line", () => {
		const fiveMinutesAgo = NOW - 5 * MINUTE;

		const label = formatRelative(fiveMinutesAgo, "es-CR", NOW);

		// Not `null`: "one line fewer beats one claim more" is the rule for a *missing*
		// timestamp, and this timestamp is not missing — the clock is a fact either way.
		// Returning `null` here would silently drop the line on every Android and iOS build.
		expect(label).not.toBeNull();
		expect(label).toBe(formatClock(fiveMinutesAgo, "es-CR"));
	});

	test("a locale the engine cannot build is no line at all, and not a second throw", () => {
		// The second way into the fallback, and the first version of this test got both its
		// facts wrong — which is the reason the three assertions below are measurements rather
		// than the shape of the code:
		//
		//   1. A tag that is merely *unknown* does not throw. `not-a-locale` is a structurally
		//      valid language tag, so `new Intl.RelativeTimeFormat("not-a-locale")` returns a
		//      formatter against the default locale — measured, it renders "5 min. ago", in
		//      English, inside a Spanish app. So an odd device locale does not reach this
		//      `catch`; it reaches a wrong-language sentence. The locale this app passes is its
		//      own constant from `@pymeshub/i18n`, so nothing ships on that path — but the old
		//      comment here claimed the throw, and a test built on it asserted a throw.
		//   2. The tag that *does* throw throws from `Intl.DateTimeFormat` too, so the `catch`
		//      used to hand to a second constructor with the same bad input and throw out of
		//      render anyway — from inside the guard written to stop that. `clockOrNull` is why
		//      the answer here is `null` rather than a clock string.
		//
		// The members are restored at the top, so this exercises the `catch` rather than the
		// `typeof` guard the two tests above cover.
		for (const [name, value] of removed) {
			Object.defineProperty(intl, name, {
				value,
				configurable: true,
				writable: true,
			});
		}
		removed = [];

		const fiveMinutesAgo = NOW - 5 * MINUTE;

		// Fact 1: unknown, not invalid — no throw, and it is why this is not the guard's route.
		expect(() => new Intl.RelativeTimeFormat("not-a-locale")).not.toThrow();

		// Fact 2: invalid is a different thing, and it takes down both constructors.
		expect(() => new Intl.RelativeTimeFormat("en_US")).toThrow();
		expect(() => new Intl.DateTimeFormat("en_US")).toThrow();

		// So the one line this timestamp could have carried is dropped, rather than throwing
		// during render on an order screen. "One line fewer beats one claim more."
		expect(formatRelative(fiveMinutesAgo, "en_US", NOW)).toBeNull();
	});
});

/**
 * The timetable clock this module hands out, and the one property of it that lives here.
 *
 * `hours` entries carry `opensMinute`/`closesMinute` as minutes from midnight and
 * `businessHoursEntrySchema` allows `closesMinute` up to `1440` — a shop that closes at midnight.
 * The function that keeps that from printing as `opensMinute = 0` is `@pymeshub/i18n`'s, and its
 * own test file measures why; what can regress in *this* file is which function this module
 * exports.
 */
describe("the timetable clock this module hands out", () => {
	test("is `@pymeshub/i18n`'s function and not a second implementation", () => {
		// Identity, not output. The defect this repo actually had was two implementations, one per
		// client, each green in its own suite and disagreeing only across the pair: every output
		// assertion in `packages/i18n` would pass against a fresh copy here, because a copy is
		// correct on the day it is written. `toBe` on the function is the assertion a copy cannot
		// pass, and a copy is what this file used to hold.
		expect(formatMinuteOfDay).toBe(sharedFormatMinuteOfDay);
	});
});
