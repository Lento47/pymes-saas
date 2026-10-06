import { describe, expect, it } from "vitest";

import { buildComparisonSeries, orderWindow, seriesTotal } from "./console-metrics";

/**
 * The order-activity comparison.
 *
 * This is the arithmetic behind the dashboard's "está subiendo" claim, and every case below is
 * one where the obvious implementation is wrong in a way a glance cannot catch: an unsorted
 * series, a period with nothing in it, and the off-by-one that makes a 7-day window silently
 * cover 8 days.
 */
const day = (n: number, count: number, cancelled = 0) => ({
	day: `2026-09-${String(n).padStart(2, "0")}`,
	count,
	cancelled,
});

/** Forty days of steady activity: 10 orders a day, none cancelled. */
const steady = Array.from({ length: 40 }, (_, index) => day(index + 1, 10));

describe("orderWindow", () => {
	it("takes the last `days` entries as the current window", () => {
		const result = orderWindow(steady, 7);

		expect(result.bars).toHaveLength(7);
		expect(result.current.count).toBe(70);
	});

	it("compares against the equal-length window immediately before it", () => {
		// 10/day for 30 days, then 20/day for 10. A 10-day window is all 20s and its
		// predecessor is all 10s, so the comparison must read +100%.
		const rising = [
			...Array.from({ length: 30 }, (_, i) => day(i + 1, 10)),
			...Array.from({ length: 10 }, (_, i) => day(i + 31, 20)),
		];

		const result = orderWindow(rising, 10);
		expect(result.current.count).toBe(200);
		expect(result.previous?.count).toBe(100);
		expect(result.changePercent).toBe(100);
	});

	it("reads a rising series as rising and a falling one as falling", () => {
		const falling = [
			...Array.from({ length: 10 }, (_, i) => day(i + 1, 20)),
			...Array.from({ length: 10 }, (_, i) => day(i + 11, 10)),
		];

		expect(orderWindow(falling, 10).changePercent).toBe(-50);
		expect(orderWindow(steady, 10).changePercent).toBe(0);
	});

	it("sorts the series rather than trusting it", () => {
		// The service orders by the day expression, and this sorts again anyway. A bar chart
		// drawn from an unsorted array is wrong in a way nothing else catches.
		const shuffled = [day(3, 10), day(1, 10), day(2, 10)];

		expect(orderWindow(shuffled, 2).bars.map((bar) => bar.day)).toEqual([
			"2026-09-02",
			"2026-09-03",
		]);
	});

	it("reports no change rather than dividing by zero", () => {
		// A first period. `Infinity` or `+100%` would both be fiction: nobody doubled their
		// order count, because there was nothing to double.
		const firstPeriod = [day(1, 5), day(2, 7)];

		const result = orderWindow(firstPeriod, 2);
		expect(result.previous).toBeNull();
		expect(result.changePercent).toBeNull();
	});

	it("reads a cancellation rate without ever dividing by an empty day", () => {
		expect(orderWindow([], 7).current.cancellationRate).toBe(0);
		expect(orderWindow([], 7).current.count).toBe(0);

		const halfCancelled = [day(1, 10, 5)];
		expect(orderWindow(halfCancelled, 1).current.cancellationRate).toBe(0.5);
	});

	it("counts cancellations inside the total, because they were orders placed", () => {
		// Two questions, not one: activity includes a cancelled order, completed volume does
		// not. The panel needs both numbers from the same rows to say so.
		const mixed = [day(1, 10, 3), day(2, 10, 2)];

		const result = orderWindow(mixed, 2);
		expect(result.current.count).toBe(20);
		expect(result.current.cancelled).toBe(5);
		expect(result.current.cancellationRate).toBeCloseTo(0.25);
	});

	it("handles a window longer than the series without throwing", () => {
		// A 30-day window over a series that only has 10 days of history is the normal state of
		// a young marketplace, and it must not produce `NaN` on screen.
		const young = [day(1, 3), day(2, 4)];

		const result = orderWindow(young, 30);
		expect(result.bars).toHaveLength(2);
		expect(result.current.count).toBe(7);
		expect(result.previous).toBeNull();
		expect(Number.isNaN(result.current.cancellationRate)).toBe(false);
	});
});

describe("buildComparisonSeries", () => {
  /**
   * The comparison chart can be genuinely misleading from a correct-looking panel.
   *
   * An operator reads the vertical gap between the two lines as "how much did orders
   * improve/worsen", and that only works if the two series are aligned the way the panel
   * claims. Every case below is a reading of the *same* arithmetic that renders wrong.
   */
  it("aligns the previous period by position, so the gap is a difference and not a date offset", () => {
    // 10/day for ten days, then 20/day for ten. If the previous period were placed on its
    // calendar dates, the two lines would sit a fortnight apart and the "gap" would be two
    // weeks of calendar, not double the orders.
    const rising = [
      ...Array.from({ length: 10 }, (_, i) => day(i + 1, 10)),
      ...Array.from({ length: 10 }, (_, i) => day(i + 11, 20)),
    ];

    const { data, hasPrevious } = buildComparisonSeries(rising, 10);

    expect(hasPrevious).toBe(true);
    expect(data[0]?.values.current).toBe(20);
    expect(data[0]?.values.previous).toBe(10);
  });

  it("omits the previous series entirely rather than zero-filling a partial window", () => {
    // `LineChart` documents that a missing value counts as zero. A marketplace with only two
    // days of history that renders `previous` zero-filled would draw a cliff down to zero that
    // did not happen — the most alarming-looking shape a chart can have, and the least true.
    const young = [day(1, 5), day(2, 7)];

    const result = buildComparisonSeries(young, 7);

    expect(result.hasPrevious).toBe(false);
    expect(result.data.every((row) => "previous" in row.values === false)).toBe(true);
  });

  it("still draws the current series when there is no earlier window", () => {
    // The window is longer than the history, and the current series is still the only honest
    // thing on screen: a line of two real days, padded to zero nowhere.
    const only = [day(1, 40)];

    const result = buildComparisonSeries(only, 7);

    expect(result.hasPrevious).toBe(false);
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.values.current).toBe(40);
  });
});

describe("seriesTotal", () => {
	it("adds a series, and is zero for an empty one", () => {
		expect(seriesTotal(steady)).toBe(400);
		expect(seriesTotal([])).toBe(0);
	});
});