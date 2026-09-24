import { describe, expect, test } from "bun:test";

import { weekdayName } from "./index";

/**
 * The weekday name, and the three properties a caller is trusting when it prints one.
 *
 * It has one caller per client — the web storefront's week list and the phone's hours table —
 * and both of them passed `Date.getDay()`-shaped numbers to a private copy of this function
 * until the copies were folded into this package. So what is pinned here is not the wording,
 * which belongs to the platform's ICU data, but the index convention, the timezone the name is
 * anchored to, and the failure mode.
 *
 * The wording is asserted anyway, in both languages the app ships: a name that holds in one
 * locale's data is not a name that holds, and a hand-written table that drifted from the
 * platform would still pass a test that only checked "not empty".
 */
describe("a weekday name", () => {
	test("day 0 is Sunday and day 6 is Saturday, in both locales", () => {
		// `businessHoursEntrySchema` allows `day` 0–6 and both call sites pass the same number
		// `Date.getDay()` returns. An off-by-one prints every shop's Monday on a Tuesday and no
		// type checks it, so both ends of the week are asserted rather than only the middle.
		expect(weekdayName(0, "es-CR")).toBe("domingo");
		expect(weekdayName(6, "es-CR")).toBe("sábado");
		expect(weekdayName(0, "en-US")).toBe("Sunday");
		expect(weekdayName(6, "en-US")).toBe("Saturday");
	});

	test("the name is anchored to UTC, not to the clock the reader's device keeps", () => {
		// The reference Sunday is an *instant*, and `timeZone: "UTC"` is what makes it a Sunday
		// for a reader eleven hours behind it. Without that option the index would be read
		// against the host's own day, and the same call would name the wrong day for everyone
		// west of Greenwich — which is every customer this product has.
		//
		// The premise is asserted first, because an emulation that quietly stopped working would
		// leave this test passing while measuring nothing, and that assertion is the only line
		// here that can tell you it did.
		const zone = process.env.TZ;
		try {
			process.env.TZ = "Pacific/Midway";
			expect(new Date(Date.UTC(2024, 0, 7)).getDay()).toBe(6);

			expect(weekdayName(0, "es-CR")).toBe("domingo");
			expect(weekdayName(3, "es-CR")).toBe("miércoles");
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
		// This runs during render, so the throw would take a screen to an error boundary over
		// one column of one table. `en_US` is the measured case — a structurally *invalid* tag,
		// which is not the same as an unknown one: `not-a-locale` is a valid tag and falls back
		// to the default locale in silence, so a caller that prints that fallback prints a real
		// name in the wrong language rather than `null`.
		expect(() => new Intl.DateTimeFormat("en_US")).toThrow();

		expect(weekdayName(0, "en_US")).toBeNull();
		expect(weekdayName(0, "not-a-locale")).not.toBeNull();
	});
});
