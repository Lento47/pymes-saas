import { describe, expect, test } from "bun:test";

import { formatMinuteOfDay } from "./index";

/**
 * A minute of the day as a timetable clock — and the one pair of minutes that used to be one
 * string across two clients.
 *
 * `businessHoursEntrySchema` carries `opensMinute`/`closesMinute` as minutes from midnight and
 * allows `closesMinute` up to `1440`, a shop that closes at midnight — so a shop open `0 → 1440`
 * with `isClosed: false` is a valid row. Both ends of a day are the same clock face, so every
 * option that describes only an instant renders them alike; the tests below measure that, then
 * measure that the hour *cycle* is what separates them.
 *
 * This function has one formatter and two clients, which is why it is in this package: the web
 * storefront's `components/catalog/hours.ts` had its own copy, with `hour12: false` and no guard,
 * and printed that shop as `00:00–00:00` while `apps/mobile/lib/format.ts` printed `00:00–24:00`.
 * So what is pinned here is not only the wording — that belongs to the platform's ICU data — but
 * the cycle, the timezone the value is anchored to, and the failure mode.
 */

/** The reference Sunday the formatter indexes off, spelled out so the test needs no import. */
const REF = Date.UTC(2024, 0, 7);
const MINUTE = 60_000;

/** The minute before the day's end, and the end itself — one minute apart, never one string. */
const LAST_MINUTE = 1439;
const END_OF_DAY = 1440;

describe("a minute of the day, which is a timetable and not a clock", () => {
	test("the premise: the option sets this function refuses render both ends of a day alike", () => {
		// Measurements, not a reading of the code — if ICU ever stops collapsing the two ends of
		// a day, this test says so rather than the function quietly staying special for no reason.

		// The first version of the web copy. It is what printed `00:00–00:00` for a shop open
		// `0 → 1440`: minute 0 and minute 1440 were the same two characters in both locales.
		const withHour12 = (minute: number) =>
			new Intl.DateTimeFormat("es-CR", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
				timeZone: "UTC",
			}).format(new Date(REF + minute * MINUTE));
		expect(withHour12(0)).toBe("00:00");
		expect(withHour12(END_OF_DAY)).toBe("00:00");

		// Twelve-hour collides too, so this is not a quirk of the 24-hour options. Each locale
		// gets its own midnight written out, because a single literal would read as the
		// product's own text and this one is the platform's.
		for (const [locale, midnight] of [
			["es-CR", "12:00 a. m."],
			["en-US", "12:00 AM"],
		] as const) {
			const clock = (minute: number) =>
				new Intl.DateTimeFormat(locale, {
					hour: "numeric",
					minute: "2-digit",
					timeZone: "UTC",
				}).format(new Date(REF + minute * MINUTE));
			expect(clock(0)).toBe(midnight);
			expect(clock(END_OF_DAY)).toBe(midnight);
		}

		// And the cycles the function does use are two answers, which is the whole fix.
		const cycled = (cycle: "h23" | "h24", minute: number) =>
			new Intl.DateTimeFormat("es-CR", {
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: cycle,
				timeZone: "UTC",
			}).format(new Date(REF + minute * MINUTE));
		expect(cycled("h23", 0)).toBe("00:00");
		expect(cycled("h24", 0)).toBe("24:00");
	});

	test("the two ends of the day are two strings, in both locales the app ships", () => {
		// `INTL_LOCALES` is `{ es: "es-CR", en: "en-US" }`, and the pair is asserted in both
		// because a fix that holds in one locale's ICU data is not a fix.
		for (const locale of ["es-CR", "en-US"]) {
			const start = formatMinuteOfDay(0, locale);
			const end = formatMinuteOfDay(END_OF_DAY, locale);

			expect(start).toBe("00:00");
			expect(end).toBe("24:00");
			// The defect, stated as the assertion that would have caught it: a shop that opens at
			// midnight and one that closes at midnight must not read the same.
			expect(end).not.toBe(start);
		}
	});

	test("the end of the day is ICU's own 24th hour, not a string this app made up", () => {
		// The answer for 1440 is the `h24` cycle's rendering of midnight — the cycle in which a
		// day runs 1–24 — rather than a literal, so it keeps the locale's own digits and
		// separator. Pinned so an edit that hardcodes `"24:00"` while the cycle changes, or stops
		// being used, is visible rather than identical-looking.
		const h24 = new Intl.DateTimeFormat("es-CR", {
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h24",
			timeZone: "UTC",
		}).format(new Date(REF));
		expect(h24).toBe("24:00");
		expect(formatMinuteOfDay(END_OF_DAY, "es-CR")).toBe(h24);
	});

	test("a minute inside the day is a plain timetable clock", () => {
		expect(formatMinuteOfDay(1, "es-CR")).toBe("00:01");
		expect(formatMinuteOfDay(750, "es-CR")).toBe("12:30");
		expect(formatMinuteOfDay(1080, "es-CR")).toBe("18:00");
	});

	test("23:59 is still the last minute of the day, so 24:00 cannot be reached by accident", () => {
		// The other boundary: 1440 is the end of the day *because the schema caps it there*, and
		// the minute before it proves the `h24` branch is a boundary rather than a rounding.
		expect(formatMinuteOfDay(LAST_MINUTE, "es-CR")).toBe("23:59");
		expect(formatMinuteOfDay(END_OF_DAY, "es-CR")).not.toBe(
			formatMinuteOfDay(LAST_MINUTE, "es-CR"),
		);
	});

	test("past the schema's cap is the end of the day, never the next day's first hour", () => {
		// `businessHoursEntrySchema` caps both fields at 1440, so 1500 cannot arrive through the
		// API — and wrapping it would print `01:00`, the same string as minute 60. That is the
		// collision this function exists to end, so the out-of-contract value lands on the same
		// end-of-day marker rather than on a real minute of the day.
		expect(formatMinuteOfDay(1500, "es-CR")).toBe("24:00");
		expect(formatMinuteOfDay(1500, "es-CR")).not.toBe(
			formatMinuteOfDay(60, "es-CR"),
		);
	});

	test("the value is anchored to UTC, not to the zone the reader's device keeps", () => {
		// `REF + minute * 60_000` is an *instant*, and `timeZone: "UTC"` is what makes it the
		// minute the caller meant for a reader eleven hours behind it. Without that option the
		// number is read against the host's own zone and every value in a shop's column shifts by
		// the reader's offset — end of day would stop being the end of day.
		//
		// The premise is asserted first, because an emulation that quietly stopped working would
		// leave the rest of this test passing while measuring nothing, and that assertion is the
		// only line here that can tell you it did.
		const zone = process.env.TZ;
		try {
			process.env.TZ = "Pacific/Midway";
			expect(
				new Intl.DateTimeFormat("es-CR", {
					hour: "numeric",
					minute: "2-digit",
				}).format(new Date(REF + END_OF_DAY * MINUTE)),
			).toBe("1:00 p. m.");

			expect(formatMinuteOfDay(END_OF_DAY, "es-CR")).toBe("24:00");
			expect(formatMinuteOfDay(750, "es-CR")).toBe("12:30");
		} finally {
			// The zone is process-wide: left set, it changes the answer of every suite that runs
			// after this one in the same process. `delete` rather than assigning `undefined`,
			// which would leave the variable set to the string "undefined" on a machine that
			// never had one.
			if (zone === undefined) delete process.env.TZ;
			else process.env.TZ = zone;
		}
	});

	test("a tag the engine cannot build a formatter from is null, not a throw", () => {
		// This runs during render, so a throw would take a storefront to an error boundary over
		// one row of a table. `en_US` is the measured case — a structurally *invalid* tag, which
		// is not the same as an unknown one: `not-a-locale` is a valid tag and falls back to the
		// default locale in silence, so a caller that printed the fallback would print a real
		// time in the wrong language rather than `null`.
		expect(() => new Intl.DateTimeFormat("en_US")).toThrow();

		expect(formatMinuteOfDay(0, "en_US")).toBeNull();
		expect(formatMinuteOfDay(END_OF_DAY, "en_US")).toBeNull();
		expect(formatMinuteOfDay(750, "not-a-locale")).not.toBeNull();
	});
});
