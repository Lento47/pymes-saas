/**
 * Ranking tests, and the three failures they exist to catch.
 *
 * Every one of these is a bug that has shipped in a real marketplace: a shop with one
 * five-star review outranking a shop with four hundred orders; a business that has not
 * been rated yet ranking last forever, so new supply never gets seen; and a shop whose
 * *first* good order moves it **down**, because a rate with no prior is weaker evidence
 * than no rate at all. The arithmetic is small enough to argue about, so it is pinned
 * here instead of being defended in a meeting.
 *
 * `nowMs` is a constant rather than the clock because nothing in this module may read the
 * clock — a score that depends on when it was computed cannot be replayed.
 */

import { describe, expect, test } from "bun:test";
import {
	bayesianRating,
	DEFAULT_RANKING_WEIGHTS,
	distanceUtility,
	freshnessWeight,
	prepReliability,
	RANKING_PRIORS,
	RANKING_VERSION,
	type RankingCandidate,
	ratingUtility,
	scoreCandidate,
	wilsonLowerBound,
} from "./ranking";

const NOW = 1_760_000_000_000;
const HOUR = 60 * 60 * 1000;

/** A shop with coordinates, no reviews and no preparation history. */
function shop(overrides: Partial<RankingCandidate> = {}): RankingCandidate {
	return {
		id: "biz_test",
		distanceKm: 1,
		ratingAvg: 0,
		ratingCount: 0,
		prep: null,
		...overrides,
	};
}

describe("distanceUtility", () => {
	test("a shop at the caller's feet is worth exactly one", () => {
		expect(distanceUtility(0, 2.5)).toBe(1);
	});

	test("falls to 1/e at tau, which is what tau means", () => {
		expect(distanceUtility(2.5, 2.5)).toBeCloseTo(Math.exp(-1), 10);
	});

	test("has no cliff: twenty metres cannot move the score by a fifth", () => {
		// The bands this replaced (`2 km` then `5 km`) stepped, so two shops either side of
		// 2.000 km differed by ~0.2 of score. A customer cannot see twenty metres, so the
		// ranking must not act on them.
		const justInside = distanceUtility(1.99, 2.5);
		const justOutside = distanceUtility(2.01, 2.5);
		expect(Math.abs(justInside - justOutside)).toBeLessThan(0.01);
	});

	test("decreases with distance, and never leaves 0..1", () => {
		const scores = [0, 0.5, 1, 3, 10, 40].map((km) => distanceUtility(km, 2.5));
		for (const score of scores) {
			expect(score).toBeGreaterThan(0);
			expect(score).toBeLessThanOrEqual(1);
		}
		for (let index = 1; index < scores.length; index += 1) {
			expect(scores[index] ?? 1).toBeLessThan(scores[index - 1] ?? 0);
		}
	});
});

describe("bayesianRating", () => {
	test("a shop with no reviews is the platform's average, not zero", () => {
		expect(bayesianRating(0, 0)).toBeCloseTo(ratingUtility(4.3), 10);
	});

	test("one five-star review loses to four hundred orders at 4.8", () => {
		// The whole reason this is not a raw average. The customer sees the first shop on
		// the screen, and a raw average puts the luckiest shop there.
		expect(bayesianRating(5, 1)).toBeLessThan(bayesianRating(4.8, 500));
	});

	test("enough reviews of a shop's own move it off the prior", () => {
		// 4.8 with 500 reviews is a real claim about the shop; the prior's 4.3 should barely
		// be visible in it.
		expect(bayesianRating(4.8, 500)).toBeGreaterThan(0.94);
	});

	test("confidence is the reviews of evidence, not decoration", () => {
		const few = bayesianRating(5, 2);
		const many = bayesianRating(5, 200);
		expect(few).toBeLessThan(many);
		expect(many).toBeLessThan(ratingUtility(5));
	});
});

describe("wilsonLowerBound", () => {
	test("one success out of one is not a hundred percent", () => {
		expect(wilsonLowerBound(1, 1)).toBeLessThan(0.5);
	});

	test("the same rate with more evidence has a higher floor", () => {
		expect(wilsonLowerBound(1, 1)).toBeLessThan(wilsonLowerBound(100, 100));
		expect(wilsonLowerBound(100, 100)).toBeLessThan(wilsonLowerBound(400, 400));
	});

	test("no evidence is zero — the caller substitutes a prior instead", () => {
		expect(wilsonLowerBound(0, 0)).toBe(0);
	});
});

describe("prepReliability", () => {
	test("a shop with no counted orders does not fall to zero", () => {
		// The cold-start rule, one signal over: absent evidence is the prior's floor, never 0.
		const missing = prepReliability(null, NOW);
		expect(missing.observed).toBe(false);
		expect(missing.value).toBeGreaterThan(0.5);
		expect(missing.value).toBeLessThan(RANKING_PRIORS.prepOnTime);
	});

	test("one on-time order ranks *above* no orders at all", () => {
		// The inversion this guards: a bare `Wilson(1, 1)` is ~0.27, so a shop's first
		// successful order would rank it below a shop that has never cooked anything —
		// punishing the shop that produced the only evidence there is.
		const none = prepReliability(null, NOW);
		const one = prepReliability(
			{ onTime: 1, eligible: 1, updatedAtMs: NOW },
			NOW,
		);
		const many = prepReliability(
			{ onTime: 400, eligible: 400, updatedAtMs: NOW },
			NOW,
		);
		expect(one.value).toBeGreaterThan(none.value);
		expect(many.value).toBeGreaterThan(one.value);
		expect(many.value).toBeLessThan(1);
	});

	test("a late order lowers the floor without collapsing it", () => {
		const allLate = prepReliability(
			{ onTime: 0, eligible: 20, updatedAtMs: NOW },
			NOW,
		);
		const allOnTime = prepReliability(
			{ onTime: 20, eligible: 20, updatedAtMs: NOW },
			NOW,
		);
		expect(allLate.value).toBeLessThan(allOnTime.value);
		expect(allLate.value).toBeGreaterThan(0);
	});
});

describe("freshnessWeight", () => {
	test("fresh is one, and a half-life is a half", () => {
		expect(freshnessWeight(0, HOUR)).toBe(1);
		expect(freshnessWeight(HOUR, HOUR)).toBeCloseTo(0.5, 10);
	});

	test("decays smoothly rather than falling off a cliff", () => {
		// A step ("older than an hour, ignore it") would renormalize the weights at an
		// arbitrary instant — a change of ranking that no version number records.
		const justUnder = freshnessWeight(59 * 60 * 1000, HOUR);
		const justOver = freshnessWeight(61 * 60 * 1000, HOUR);
		expect(Math.abs(justUnder - justOver)).toBeLessThan(0.02);
		expect(freshnessWeight(6 * HOUR, HOUR)).toBeLessThan(justOver);
	});
});

describe("scoreCandidate", () => {
	test("at equal distance, the shop with a history wins", () => {
		// The invariant the whole prior substitution exists for. Without it, "unevidenced"
		// and "excellent" score the same and the ordering is decided by distance alone.
		const rated = scoreCandidate(shop({ ratingAvg: 4.9, ratingCount: 300 }), {
			nowMs: NOW,
		});
		const unrated = scoreCandidate(shop(), { nowMs: NOW });
		expect(rated.score).toBeGreaterThan(unrated.score);
	});

	test("a shop nobody has rated is neither zero nor first", () => {
		const unrated = scoreCandidate(shop(), { nowMs: NOW });
		expect(unrated.score).toBeGreaterThan(0.5);
		expect(unrated.score).toBeLessThan(1);
		// Distance is the only thing observed, so most of the score is a prior — and it says
		// so, in a label a customer can read.
		expect(unrated.confidence).toBeCloseTo(0.4, 6);
		expect(unrated.reasons).toContain("new_shop");
	});

	test("closer is better, and better rated is better, all else equal", () => {
		const near = scoreCandidate(shop({ distanceKm: 0.5 }), { nowMs: NOW });
		const far = scoreCandidate(shop({ distanceKm: 8 }), { nowMs: NOW });
		expect(near.score).toBeGreaterThan(far.score);

		const good = scoreCandidate(
			shop({ distanceKm: 1, ratingAvg: 4.9, ratingCount: 200 }),
			{ nowMs: NOW },
		);
		const poor = scoreCandidate(
			shop({ distanceKm: 1, ratingAvg: 2.5, ratingCount: 200 }),
			{ nowMs: NOW },
		);
		expect(good.score).toBeGreaterThan(poor.score);
	});

	test("one five-star review does not outrank four hundred at 4.8, in a list", () => {
		const lucky = scoreCandidate(
			shop({ id: "biz_lucky", ratingAvg: 5, ratingCount: 1 }),
			{ nowMs: NOW },
		);
		const proven = scoreCandidate(
			shop({ id: "biz_proven", ratingAvg: 4.8, ratingCount: 400 }),
			{ nowMs: NOW },
		);
		expect(proven.score).toBeGreaterThan(lucky.score);
	});

	test("scores without coordinates, over the signals that remain", () => {
		const cards = scoreCandidate(
			shop({ distanceKm: null, ratingAvg: 4.7, ratingCount: 80 }),
			{ nowMs: NOW },
		);
		expect(
			cards.contributions.some((entry) => entry.signal === "distance"),
		).toBe(false);
		expect(cards.score).toBeGreaterThan(0);
		expect(cards.score).toBeLessThanOrEqual(1);
	});

	test("stale preparation counts for less than fresh", () => {
		const prep = { onTime: 400, eligible: 400, updatedAtMs: NOW - 6 * HOUR };
		const stale = scoreCandidate(shop({ prep }), { nowMs: NOW });
		const fresh = scoreCandidate(
			shop({ prep: { ...prep, updatedAtMs: NOW } }),
			{
				nowMs: NOW,
			},
		);
		const prepWeight = (result: typeof stale) =>
			result.contributions.find((entry) => entry.signal === "prep")?.weight ??
			0;

		// The applied weight, not the value: what age costs a projection is influence.
		expect(prepWeight(stale)).toBe(prepWeight(fresh));
		expect(
			stale.contributions.find((entry) => entry.signal === "prep")?.freshness,
		).toBeLessThan(
			fresh.contributions.find((entry) => entry.signal === "prep")?.freshness ??
				1,
		);
		// A preparation record better than the prior pulls the score down once it is old,
		// because less of a good signal reaches the sum.
		expect(stale.score).toBeLessThan(fresh.score);
	});

	test("carries its versions, because a score without one is unreproducible", () => {
		const result = scoreCandidate(shop(), { nowMs: NOW });
		expect(result.rankingVersion).toBe(RANKING_VERSION);
		expect(result.weightsVersion).toBe(DEFAULT_RANKING_WEIGHTS.weightsVersion);
		// Six decimals, so a cursor carrying a score compares equal when it should.
		expect(Math.round(result.score * 1_000_000) / 1_000_000).toBe(result.score);
	});

	test("is deterministic: the same shop scores the same, twice", () => {
		const candidate = shop({ ratingAvg: 4.6, ratingCount: 42 });
		expect(scoreCandidate(candidate, { nowMs: NOW })).toEqual(
			scoreCandidate(candidate, { nowMs: NOW }),
		);
	});

	test("ignores anything money-shaped it is handed", () => {
		// Organic rank never reads a fee or a discount depth. A database row arrives with
		// those columns on it, and this pins that none of them can reach the arithmetic —
		// a shop that pays more, or that inflates a struck-through price, does not move.
		const plain = scoreCandidate(shop(), { nowMs: NOW });
		const withMoney = scoreCandidate(
			{
				...shop(),
				priceMinor: 5000,
				compareAtPriceMinor: 10000,
				deliveryFeeMinor: 0,
				platformFeeMinor: 750,
			} as RankingCandidate,
			{ nowMs: NOW },
		);
		expect(withMoney.score).toBe(plain.score);
	});

	test("falls back to the default weights when handed nonsense", () => {
		const fallback = scoreCandidate(shop(), {
			nowMs: NOW,
			weights: { ...DEFAULT_RANKING_WEIGHTS, distance: Number.NaN },
		});
		expect(fallback.score).toBe(scoreCandidate(shop(), { nowMs: NOW }).score);
		expect(fallback.weightsVersion).toBe(
			DEFAULT_RANKING_WEIGHTS.weightsVersion,
		);

		const zeroed = scoreCandidate(shop(), {
			nowMs: NOW,
			weights: {
				weightsVersion: "zeroed",
				distance: 0,
				rating: 0,
				prep: 0,
			},
		});
		expect(zeroed.score).toBe(scoreCandidate(shop(), { nowMs: NOW }).score);
	});
});

describe("the weights themselves", () => {
	test("are exactly four keys, and none of them is money", () => {
		// A weight added here is a change to what the marketplace rewards, so it should be a
		// deliberate diff with a version bump — not a field that arrived quietly.
		expect(Object.keys(DEFAULT_RANKING_WEIGHTS).sort()).toEqual([
			"distance",
			"prep",
			"rating",
			"weightsVersion",
		]);
	});
});
