import { expect, test } from "bun:test";
import {
	MARKET_TIME_ZONE,
	MARKET_UTC_OFFSET_MINUTES,
	marketDayKey,
	shiftMarketMonths,
	shiftMarketYears,
	startOfMarketDay,
} from "./market-time";

test("market day crosses UTC midnight at 06:00 in Costa Rica", () => {
	expect(MARKET_TIME_ZONE).toBe("America/Costa_Rica");
	expect(MARKET_UTC_OFFSET_MINUTES).toBe(-360);
	expect(marketDayKey(new Date("2026-09-21T05:59:59.999Z"))).toBe("2026-09-20");
	expect(marketDayKey(new Date("2026-09-21T06:00:00.000Z"))).toBe("2026-09-21");
	expect(startOfMarketDay(new Date("2026-09-21T05:59:59.999Z"))).toEqual(
		new Date("2026-09-20T06:00:00.000Z"),
	);
	expect(startOfMarketDay(new Date("2026-09-21T06:00:00.000Z"))).toEqual(
		new Date("2026-09-21T06:00:00.000Z"),
	);
});

test("shifting market years preserves wall time and clamps leap day", () => {
	expect(shiftMarketYears(new Date("2024-03-01T05:45:30.123Z"), 1)).toEqual(
		new Date("2025-03-01T05:45:30.123Z"),
	);
	expect(shiftMarketYears(new Date("2024-02-29T18:30:00.000Z"), 1)).toEqual(
		new Date("2025-02-28T18:30:00.000Z"),
	);
});

test("shifting market months preserves wall time and clamps short months", () => {
	// May 31 minus three months is February 31, which does not exist: the clamp takes the
	// last day February has, not JavaScript's default roll into March.
	expect(shiftMarketMonths(new Date("2024-05-31T18:30:00.000Z"), -3)).toEqual(
		new Date("2024-02-29T18:30:00.000Z"),
	);
	// A negative month index crosses the year boundary through the floor, not a loop.
	expect(shiftMarketMonths(new Date("2024-01-15T12:00:00.000Z"), -1)).toEqual(
		new Date("2023-12-15T12:00:00.000Z"),
	);
	expect(shiftMarketMonths(new Date("2024-11-30T18:30:00.000Z"), 2)).toEqual(
		new Date("2025-01-30T18:30:00.000Z"),
	);
});
