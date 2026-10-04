import { describe, expect, it } from "vitest";

import {
  busiestDay,
  canSumAcrossCurrencies,
  seriesTotal,
  toBars,
} from "@/pages/admin/console-metrics";

/**
 * The metrics arithmetic, without the console.
 *
 * `admin.metrics` refetches every thirty seconds and most of it is drawn by nobody. These are
 * the two shapes that have to survive that: a 30-day signup series and a per-currency
 * volume list. The interesting cases are all degenerate ones — an empty platform, a single
 * day, a week where nothing happened — and degenerate cases are exactly what never gets
 * looked at by hand.
 */

describe("toBars", () => {
  it("scales the busiest day to full height", () => {
    const bars = toBars([
      { day: "2026-10-01", count: 1 },
      { day: "2026-10-02", count: 4 },
      { day: "2026-10-03", count: 2 },
    ]);

    expect(bars.map((bar) => bar.percent)).toEqual([25, 100, 50]);
  });

  it("draws a flat series at full height rather than at zero", () => {
    // `[3, 3, 3]` scaled by its own maximum is three full bars, which reads as "a strong week"
    // when it is three signups. What the bars can say is the *shape*; the number next to
    // them is what says whether three is a lot.
    expect(toBars([{ day: "a", count: 3 }, { day: "b", count: 3 }]).map((b) => b.percent)).toEqual([
      100, 100,
    ]);
  });

  it("draws an empty series as zeros, not NaN", () => {
    // Dividing by a maximum of zero produces NaN, which React renders as nothing at all —
    // leaving an empty strip that looks like a loading state and never resolves.
    expect(toBars([{ day: "a", count: 0 }, { day: "b", count: 0 }]).map((b) => b.percent)).toEqual([
      0, 0,
    ]);
  });

  it("handles no series at all", () => {
    expect(toBars([])).toEqual([]);
  });

  it("handles a single day", () => {
    expect(toBars([{ day: "a", count: 7 }])).toEqual([
      { day: "a", count: 7, percent: 100 },
    ]);
  });

  it("keeps the day and the count, so a bar can be labelled", () => {
    const [bar] = toBars([{ day: "2026-10-02", count: 9 }]);
    expect(bar?.day).toBe("2026-10-02");
    expect(bar?.count).toBe(9);
  });
});

describe("seriesTotal", () => {
  it("sums the window", () => {
    expect(
      seriesTotal([
        { day: "a", count: 2 },
        { day: "b", count: 3 },
      ]),
    ).toBe(5);
  });

  it("is zero for an empty series", () => {
    expect(seriesTotal([])).toBe(0);
  });
});

describe("busiestDay", () => {
  it("names the busiest day", () => {
    expect(
      busiestDay([
        { day: "a", count: 1 },
        { day: "b", count: 9 },
        { day: "c", count: 4 },
      ]),
    ).toEqual({ day: "b", count: 9 });
  });

  it("is null with no series, because there is no day to name", () => {
    expect(busiestDay([])).toBeNull();
  });
});

describe("canSumAcrossCurrencies", () => {
  it("refuses, always, and says why in the module", () => {
    // `adminMetricsSchema` groups money by currency because "₡4 200 000 + $1 300 has no
    // answer". This function exists so that the refusal is a named thing rather than a
    // temptation rediscovered whenever somebody adds a total-revenue tile.
    expect(canSumAcrossCurrencies(["CRC", "USD"])).toBe(false);
    expect(canSumAcrossCurrencies(["CRC"])).toBe(false);
    expect(canSumAcrossCurrencies([])).toBe(false);
  });
});