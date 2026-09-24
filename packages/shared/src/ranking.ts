/**
 * The `best` ordering, as arithmetic. Pure functions, no bindings, no clock.
 *
 * Every marketplace ends up with one of these, and the ones that go wrong go wrong the
 * same three ways. Each rule below exists because of one of them, and each is a rule
 * rather than a convention because a convention is what the next formula quietly drops.
 *
 * - **Missing is not zero.** A shop nobody has rated yet, or one whose orders have not
 *   been counted yet, enters the score at the *platform's prior* for that signal — the
 *   mean for a rating, the pessimistic end of the prior for a reliability promise. A 0
 *   would rank every new business last forever, which is the bug that stops a
 *   marketplace growing its supply, and it would also be a lie: "no evidence" is not
 *   "bad".
 * - **Organic rank never reads money.** No commission, no fee, no payout, no discount
 *   depth. `payout.platformFeeMinor` is a number this module must never be handed.
 *   Ranked-by-payment is undetectable by the customer, which is what makes it the worst
 *   failure available here.
 * - **Same inputs, same order.** There is no `Math.random` and no `Date.now` in this
 *   file: time arrives as `nowMs` and ties break on `id`. A ranking that reshuffles
 *   between two identical reads cannot be paginated, replayed or debugged.
 * - **Every weight has one home.** `DEFAULT_RANKING_WEIGHTS` is the only place a number
 *   like 0.4 appears, and it is versioned, because a score without a weights version is
 *   a score nobody can reproduce next month.
 *
 * The scale: every signal is normalized to `0..1` and the score is a weighted mean of
 * them, so a score is comparable *within one request* and never across requests with
 * different weights. It is not a probability and it is not shown to a customer — the
 * surfaces show a reason, never the number. See `docs/domain.md`.
 */

/** The algorithm's name. A stored score without this cannot be explained later. */
export const RANKING_VERSION = "best-v1";

/**
 * How much each signal is worth. Sums to 1 so a score reads as a percentage of a
 * perfect shop, which is not a claim the UI makes — it is a claim that makes the
 * arithmetic checkable by hand.
 *
 * These numbers are a starting hypothesis, not a finding. They are here, versioned,
 * so that changing them is a diff instead of a hunt.
 */
export interface RankingWeights {
	weightsVersion: string;
	distance: number;
	rating: number;
	prep: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
	weightsVersion: "best-v1.0",
	distance: 0.4,
	rating: 0.4,
	prep: 0.2,
};

/**
 * The platform's beliefs before it has seen a shop — the other half of "missing is not
 * zero".
 *
 * `distanceTauKm` is the one number here that is a guess about geography rather than
 * about quality: it is the distance at which proximity has decayed to `1/e`. 2.5 km is
 * a city neighbourhood. It belongs per-region, derived from the shops that are actually
 * open there, and it is a parameter rather than a constant so that day can come without
 * this file changing.
 */
export const RANKING_PRIORS = {
	/** Where a new shop starts, and what "average" means for a rating. */
	ratingMean: 4.3,
	/** Reviews of evidence, in review-equivalents, before a shop's own average counts. */
	ratingConfidence: 10,
	/** The share of orders a shop is assumed to get ready on time. */
	prepOnTime: 0.85,
	/** Orders of evidence, in order-equivalents, before a shop's own record counts. */
	prepConfidence: 10,
	/** One-sided ~95%: how far below the observed rate the truth may plausibly sit. */
	wilsonZ: 1.645,
	/** A preparation within this multiple of the shop's own promise counts as on time. */
	prepGraceFactor: 1.25,
	/** Distance scale, km: proximity decays to `1/e` here. */
	distanceTauKm: 2.5,
	/** How long a projection takes to become half as trustworthy. One day. */
	statsHalfLifeMs: 24 * 60 * 60 * 1000,
} as const;

export interface PrepStats {
	/** Orders the shop got ready inside its own promise. */
	onTime: number;
	/** Orders that could have been counted — completed ones, of any age. */
	eligible: number;
	/** When the projection these two came from was last written. */
	updatedAtMs: number;
}

/**
 * What the scorer is allowed to know about one shop. Every field but `id` is optional in
 * effect: `distanceKm` is null for a caller who sent no coordinates, and `prep` is null
 * until the projection that carries it exists.
 */
export interface RankingCandidate {
	id: string;
	distanceKm: number | null;
	ratingAvg: number;
	ratingCount: number;
	prep?: PrepStats | null;
}

export interface RankingContext {
	/** Passed in rather than read, so a replay can score a past request. */
	nowMs: number;
	/** Overrides `RANKING_PRIORS.distanceTauKm` — per region, eventually. */
	tauKm?: number;
	weights?: RankingWeights;
}

export interface SignalContribution {
	signal: "distance" | "rating" | "prep";
	weight: number;
	/** The value used, after substitution: a prior when the signal is unobserved. */
	value: number;
	/** False when `value` is the platform prior rather than this shop's own record. */
	observed: boolean;
	/** How much of this signal's weight survives its age. 1 when fresh or unobserved. */
	freshness: number;
}

export interface RankedScore {
	/** 0..1, rounded to six decimals so a cursor cannot drift in the last bit. */
	score: number;
	/** Share of the applied weight that came from real evidence. */
	confidence: number;
	/** Safe, customer-facing labels. Never the numbers, never a weight. */
	reasons: string[];
	/** The arithmetic, for an admin surface or a test. Not for a client. */
	contributions: SignalContribution[];
	rankingVersion: string;
	weightsVersion: string;
}

/**
 * Proximity as a smooth decay rather than bands.
 *
 * The bands this replaced (`0.5/1/2/5 km`) had cliffs: two shops twenty metres apart
 * could differ by 0.2 of score, which is a difference a customer can neither see nor
 * explain. `exp(-d/τ)` is monotone, has no step anywhere, and its one parameter means
 * something — the distance at which the signal has fallen to `1/e`.
 */
export function distanceUtility(distanceKm: number, tauKm: number): number {
	const tau =
		Number.isFinite(tauKm) && tauKm > 0 ? tauKm : RANKING_PRIORS.distanceTauKm;
	if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
	return Math.min(1, Math.exp(-distanceKm / tau));
}

/** A 1–5 star average on the `0..1` scale every weight is expressed on. */
export function ratingUtility(stars: number): number {
	if (!Number.isFinite(stars)) return 0;
	const clamped = Math.min(5, Math.max(1, stars));
	return (clamped - 1) / 4;
}

/**
 * A shop's average, pulled toward the platform's mean by how little evidence stands
 * behind it.
 *
 * Raw averages are the classic small-sample bug and they are not a rounding error: one
 * five-star review beats four hundred orders at 4.8, and the customer sees the first
 * shop on the screen. `(Σr + C·m) / (n + C)` says "with no reviews, this is the platform
 * average, and it takes about `C` reviews of your own to move you most of the way off
 * it" — which is also the honest answer to "how good is this shop?", not just a
 * convenient one.
 */
export function bayesianRating(
	ratingAvg: number,
	ratingCount: number,
	options: { mean?: number; confidence?: number } = {},
): number {
	const mean = options.mean ?? RANKING_PRIORS.ratingMean;
	const confidence = options.confidence ?? RANKING_PRIORS.ratingConfidence;
	const count =
		Number.isFinite(ratingCount) && ratingCount > 0 ? ratingCount : 0;
	const sum =
		Number.isFinite(ratingAvg) && ratingAvg > 0 ? ratingAvg * count : 0;
	return ratingUtility((sum + confidence * mean) / (count + confidence));
}

/**
 * The lower bound of a rate, not the rate.
 *
 * `1/1` is not 100%. A shop with one good order and a shop with four hundred have very
 * different evidence and the same ratio, and a plain percentage cannot tell them apart —
 * so the number used is the bottom of the interval the evidence supports, which is
 * pessimistic in exactly the way that keeps a lucky first order off the top of a list.
 */
export function wilsonLowerBound(
	successes: number,
	total: number,
	z: number = RANKING_PRIORS.wilsonZ,
): number {
	if (!Number.isFinite(total) || total <= 0) return 0;
	const p = Math.min(1, Math.max(0, successes / total));
	const zSquared = z * z;
	const centre = p + zSquared / (2 * total);
	const spread = z * Math.sqrt((p * (1 - p) + zSquared / (4 * total)) / total);
	return Math.max(0, (centre - spread) / (1 + zSquared / total));
}

/**
 * How much of a projection's authority survives its age.
 *
 * A projection is written by a queue consumer somewhere behind the write that caused it,
 * so it is always a little stale, and a value from six hours ago is not the same claim
 * as a value from five seconds ago. The decay is smooth on purpose: a cliff ("older than
 * an hour, ignore it") would make the ranking change shape at an arbitrary instant, and
 * worse, it would silently renormalize the weights — which is a change no version number
 * records.
 */
export function freshnessWeight(
	ageMs: number,
	halfLifeMs: number = RANKING_PRIORS.statsHalfLifeMs,
): number {
	if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
	if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) return 1;
	return 0.5 ** (ageMs / halfLifeMs);
}

/**
 * Preparation reliability, with the platform's prior counted as evidence instead of
 * special-cased.
 *
 * The prior is added as pseudo-orders (`(onTime + p·C) / (eligible + C)`) and then the
 * lower bound is taken over that — which buys two things a bare bound cannot. A shop with
 * no orders lands on the *pessimistic end of the prior* rather than on 0 or on the prior's
 * mean, and a shop with one on-time order scores **above** it. Without the pseudo-orders,
 * `Wilson(1, 1)` is about 0.27 and a shop's first successful order would rank it below a
 * shop that has never cooked anything — the same cold-start inversion this module exists
 * to prevent, one signal over.
 *
 * The lower bound rather than the posterior mean (which is what the rating uses) because
 * preparation is a promise the customer plans around: they pick a shop because they
 * believe it will be ready, so the honest number is the pessimistic end of what the
 * evidence supports. A mean would be the right choice for a number shown as "4.8 stars".
 */
export function prepReliability(
	prep: PrepStats | null,
	nowMs: number,
	options: { prior?: number; confidence?: number } = {},
): { value: number; observed: boolean; freshness: number } {
	const prior = options.prior ?? RANKING_PRIORS.prepOnTime;
	const confidence = options.confidence ?? RANKING_PRIORS.prepConfidence;
	const counted = prep && prep.eligible > 0 ? prep.eligible : 0;
	const onTime = counted > 0 && prep ? prep.onTime : 0;

	return {
		value: wilsonLowerBound(onTime + prior * confidence, counted + confidence),
		observed: counted > 0,
		freshness: prep ? freshnessWeight(nowMs - prep.updatedAtMs) : 1,
	};
}

/**
 * The weights, or the defaults. A hand-edited KV value is a string that parsed to
 * something strange often enough that this is not paranoia: negative, `NaN` and
 * all-zero weights are each a total order that means nothing, and a shop list that
 * silently reorders the marketplace is worse than a shop list that ignores the edit.
 */
function resolveWeights(weights: RankingWeights | undefined): RankingWeights {
	if (!weights) return DEFAULT_RANKING_WEIGHTS;
	const values = [weights.distance, weights.rating, weights.prep];
	if (values.some((value) => !Number.isFinite(value) || value < 0)) {
		return DEFAULT_RANKING_WEIGHTS;
	}
	if (values.every((value) => value === 0)) return DEFAULT_RANKING_WEIGHTS;
	return weights;
}

/** Six decimals: enough to order shops, few enough to round-trip through a cursor. */
function roundScore(score: number): number {
	return Math.round(score * 1_000_000) / 1_000_000;
}

/**
 * One shop's score, with the arithmetic that produced it.
 *
 * The shape of the sum is worth stating because it is where "missing is not zero" is
 * actually implemented: a signal that has no evidence stays in the sum **at the
 * platform's prior for that signal**, and only the weight it carries moves. So an
 * unobserved shop sits at the average shop's score rather than at zero, and a shop that
 * is close *and* well-rated beats a shop that is only close — at equal distance, evidence
 * is the whole difference, which is what `ranking.test.ts` pins.
 *
 * There is deliberately no second shrinkage term. The Bayesian rating and the Wilson
 * bound already pull thin evidence toward the prior, and shrinking the *final* score by
 * confidence as well would charge the same uncertainty twice — while `prep` is absent
 * platform-wide, it would do nothing but flatten every shop's score by the same factor.
 */
export function scoreCandidate(
	candidate: RankingCandidate,
	context: RankingContext,
): RankedScore {
	const weights = resolveWeights(context.weights);
	const tau = context.tauKm ?? RANKING_PRIORS.distanceTauKm;
	const ratingPrior = ratingUtility(RANKING_PRIORS.ratingMean);
	const contributions: SignalContribution[] = [];

	// Distance is measured, never estimated: when the caller sent coordinates the value is
	// known exactly, so its "prior" is itself and it never pulls a score toward anything.
	if (candidate.distanceKm !== null && Number.isFinite(candidate.distanceKm)) {
		contributions.push({
			signal: "distance",
			weight: weights.distance,
			value: distanceUtility(candidate.distanceKm, tau),
			observed: true,
			freshness: 1,
		});
	}

	// A rating is never missing — the prior is its value — but it is only *evidence* from
	// the first review, and `confidence` is what tells the two apart.
	const hasRating =
		Number.isFinite(candidate.ratingCount) &&
		candidate.ratingCount > 0 &&
		candidate.ratingAvg > 0;
	contributions.push({
		signal: "rating",
		weight: weights.rating,
		value: hasRating
			? bayesianRating(candidate.ratingAvg, candidate.ratingCount)
			: ratingPrior,
		observed: hasRating,
		freshness: 1,
	});

	// Preparation is the signal that is genuinely absent today: the projection that counts
	// on-time preparations is not wired yet, so this sits on the prior's floor and the
	// ordering is carried by distance and rating. It is here rather than added later
	// because the substitution rule is the part that had to be right first.
	const prep = prepReliability(candidate.prep ?? null, context.nowMs);
	contributions.push({
		signal: "prep",
		weight: weights.prep,
		value: prep.value,
		observed: prep.observed,
		freshness: prep.freshness,
	});

	let numerator = 0;
	let denominator = 0;
	let observedWeight = 0;
	for (const contribution of contributions) {
		const applied = contribution.weight * contribution.freshness;
		numerator += applied * contribution.value;
		denominator += applied;
		if (contribution.observed) observedWeight += applied;
	}

	// Unreachable while any weight is non-zero, and `resolveWeights` guarantees that — so
	// this is the platform's own average shop rather than a second opinion about it.
	const score = denominator > 0 ? numerator / denominator : ratingPrior;
	const confidence = denominator > 0 ? observedWeight / denominator : 0;

	return {
		score: roundScore(score),
		confidence: roundScore(confidence),
		reasons: reasonsFor(contributions, confidence, candidate.ratingCount),
		contributions,
		rankingVersion: RANKING_VERSION,
		weightsVersion: weights.weightsVersion,
	};
}

/**
 * The labels a shop is allowed to be ranked *by*, in the order they contributed.
 *
 * A customer never sees a score or a weight: a number invites argument about the number
 * and, worse, a shop that learns its weight learns how to move it. A reason is checkable
 * by the person reading it — "near you", "usually ready on time" — and if it is wrong,
 * it is wrong about something they can see.
 */
function reasonsFor(
	contributions: SignalContribution[],
	confidence: number,
	ratingCount: number,
): string[] {
	const reasons: string[] = [];
	const byName = (signal: SignalContribution["signal"]) =>
		contributions.find((entry) => entry.signal === signal);

	const distance = byName("distance");
	if (distance?.observed && distance.value >= 0.65) reasons.push("nearby");

	const rating = byName("rating");
	if (rating?.observed && ratingCount >= 5 && rating.value >= 0.9) {
		reasons.push("highly_rated");
	}

	const prep = byName("prep");
	if (prep?.observed && prep.value >= 0.8) {
		reasons.push("usually_ready_on_time");
	}

	// The honest label for a shop most of whose score is a prior rather than a record —
	// and the one that makes the substitution visible instead of looking like a bug. Half
	// the applied weight: a distance-only shop (0.4 observed) carries it, a shop with a
	// rating and no preparation history (0.8) does not.
	if (confidence < 0.5) reasons.push("new_shop");

	return reasons;
}
