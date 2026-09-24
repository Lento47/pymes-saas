import { describe, expect, test } from "bun:test";

import { business as businessTable } from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, world } from "./harness";

/**
 * `sort: "best"`, and the four things it must not do to the four sorts beside it.
 *
 * The scorer itself is arithmetic and is pinned in `packages/shared/src/ranking.test.ts`.
 * What is left for *this* file is everything the scorer cannot know by itself, and each
 * case is a failure that is invisible from the outside:
 *
 * - **The candidate cut.** The list sorts in JavaScript because a computed distance cannot
 *   be sorted in SQL, so SQL truncates to 200 rows *before* the ranking ever runs. With no
 *   `ORDER BY` that cut was arbitrary, which means a dense neighbourhood could lose its
 *   nearest shop without anything reporting a problem. The regression test at the bottom
 *   inserts 200 shops that are all farther away than the one it looks for.
 * - **Cold start.** A shop nobody has rated is not zero and not last; a shop with *bad*
 *   reviews is worse than a shop with none, because "no evidence" and "bad evidence" are
 *   different claims. The first rule keeps supply growing, the second keeps it honest.
 * - **Pagination.** A cursor is a `(score, id)` tuple and a score is a float that has to
 *   come out identical on the second request, or a page boundary repeats or skips a row.
 *   This is why nothing in the scorer reads the clock — it is passed in.
 * - **The other sorts.** `distance`, `rating`, `popular` and `newest` are what a shipped
 *   mobile build already sends by name. Their behaviour must be unchanged: `rating` still
 *   orders by the raw average, small-sample bug and all, because "best" is where that is
 *   fixed and silently redefining a sort a client is already paging on is how a list
 *   reorders under a screen nobody re-tested.
 */

/** San José. `EQUAL` is where three shops sit at the same distance, on purpose. */
const ORIGIN = { lat: 9.9281, lng: -84.0907 };
const EQUAL = { lat: 9.935, lng: -84.0907 }; // ~0.77 km
/** ~1 km: close enough that only evidence can separate it from `EQUAL`. */
const NEAR = { lat: 9.9371, lng: -84.0907 };
const FAR = { lat: 9.86, lng: -84.0907 }; // ~7.6 km
const FARTHER = { lat: 9.87, lng: -84.0907 }; // ~8.9 km

type Shop = {
	id: string;
	slug: string;
	coords: { lat: number; lng: number } | null;
	ratingAvg?: number;
	ratingCount?: number;
	createdAt?: string;
};

/**
 * Shops, written the way the API reads them.
 *
 * `seedBusiness` deliberately takes no coordinates and no ratings — every shop it makes is
 * otherwise identical — so a fixture that wants an order in the result has to say which
 * signal it is varying. That is a feature of these specs, not friction: an assertion about
 * ranking is only meaningful if exactly one input moved.
 */
async function seedShops(shops: Shop[]) {
	const test = world();

	for (const shop of shops) {
		await seedBusiness(test.db, {
			id: shop.id,
			slug: shop.slug,
			name: shop.slug,
		});
		await test.db
			.update(businessTable)
			.set({
				lat: shop.coords?.lat ?? null,
				lng: shop.coords?.lng ?? null,
				ratingAvg: shop.ratingAvg ?? 0,
				ratingCount: shop.ratingCount ?? 0,
				createdAt: new Date(shop.createdAt ?? "2024-01-01T00:00:00Z"),
			})
			.where(eq(businessTable.id, shop.id));
	}

	return appRouter.createCaller(await contextFor(test, null));
}

describe("best", () => {
	test("at equal distance, a shop with a history outranks one without", async () => {
		// All three are the same 0.77 km away, so distance contributes the same number to
		// every score and the ordering is decided by evidence alone. That is the invariant
		// the prior substitution exists for: without it, a rated shop and an unrated one
		// score identically and the list falls back to whatever the tiebreak is.
		const caller = await seedShops([
			{ id: "biz_unrated", slug: "soda-nueva", coords: EQUAL },
			{
				id: "biz_proven",
				slug: "soda-probada",
				coords: EQUAL,
				ratingAvg: 4.8,
				ratingCount: 400,
			},
			{
				id: "biz_poor",
				slug: "soda-mala",
				coords: EQUAL,
				ratingAvg: 2.2,
				ratingCount: 300,
			},
		]);

		const { items } = await caller.businesses.list({ ...ORIGIN, sort: "best" });

		expect(items.map((card) => card.slug)).toEqual([
			"soda-probada",
			"soda-nueva",
			"soda-mala",
		]);
	});

	test("an unrated shop is in the list, and ahead of a badly rated one", async () => {
		const caller = await seedShops([
			{ id: "biz_unrated", slug: "soda-nueva", coords: EQUAL },
			{
				id: "biz_poor",
				slug: "soda-mala",
				coords: EQUAL,
				ratingAvg: 2.2,
				ratingCount: 300,
			},
		]);

		const { items } = await caller.businesses.list({ ...ORIGIN, sort: "best" });

		// Not filtered: a shop nobody has reviewed yet is exactly the shop a marketplace has
		// to keep showing, or new supply never accumulates the reviews that would rank it.
		expect(items.map((card) => card.slug)).toEqual(["soda-nueva", "soda-mala"]);
	});

	test("orders without coordinates too, over the signals that remain", async () => {
		const caller = await seedShops([
			{
				id: "biz_good",
				slug: "soda-buena",
				coords: null,
				ratingAvg: 4.9,
				ratingCount: 100,
			},
			{
				id: "biz_ok",
				slug: "soda-regular",
				coords: null,
				ratingAvg: 3.1,
				ratingCount: 60,
			},
		]);

		const { items } = await caller.businesses.list({ sort: "best" });

		// A caller who declined location still gets a ranked list rather than the arbitrary
		// rowid order the retrieval would otherwise hand back.
		expect(items.map((card) => card.slug)).toEqual([
			"soda-buena",
			"soda-regular",
		]);
	});

	test("answers the same request with the same order, twice", async () => {
		const caller = await seedShops([
			{
				id: "biz_a",
				slug: "soda-a",
				coords: EQUAL,
				ratingAvg: 4.4,
				ratingCount: 20,
			},
			{
				id: "biz_b",
				slug: "soda-b",
				coords: FAR,
				ratingAvg: 4.4,
				ratingCount: 20,
			},
			{ id: "biz_c", slug: "soda-c", coords: FARTHER },
		]);

		const first = await caller.businesses.list({ ...ORIGIN, sort: "best" });
		const second = await caller.businesses.list({ ...ORIGIN, sort: "best" });

		// Equality of the whole page, not just the slugs: a score that drifted between two
		// requests would make the cursor a lie, and the drift would be invisible here while
		// showing up as a repeated row three pages into a real one.
		expect(second.items).toEqual(first.items);
		expect(second.nextCursor).toBe(first.nextCursor);
	});

	test("pages a score-ordered list without repeating or skipping a row", async () => {
		const caller = await seedShops([
			{
				id: "biz_a",
				slug: "soda-a",
				coords: EQUAL,
				ratingAvg: 4.9,
				ratingCount: 400,
			},
			{
				id: "biz_b",
				slug: "soda-b",
				coords: EQUAL,
				ratingAvg: 4.4,
				ratingCount: 90,
			},
			// Two shops with no reviews at all: their scores are *identical* to six decimals,
			// so this is the case that exercises the `id` tiebreak rather than the score.
			{ id: "biz_c", slug: "soda-c", coords: FAR },
			{ id: "biz_d", slug: "soda-d", coords: FAR },
			{
				id: "biz_e",
				slug: "soda-e",
				coords: FARTHER,
				ratingAvg: 3.4,
				ratingCount: 12,
			},
		]);

		const whole = await caller.businesses.list({
			...ORIGIN,
			sort: "best",
			limit: 50,
		});
		expect(whole.items.length).toBe(5);
		expect(whole.nextCursor).toBeNull();

		const walked: string[] = [];
		let cursor: string | undefined;
		for (let page = 0; page < 10 && walked.length < 5; page += 1) {
			const result = await caller.businesses.list({
				...ORIGIN,
				sort: "best",
				limit: 2,
				cursor,
			});
			expect(result.items.length).toBeGreaterThan(0);
			walked.push(...result.items.map((card) => card.slug));
			cursor = result.nextCursor ?? undefined;
			if (!cursor) break;
		}

		// Same order, same rows, one page at a time — and `toEqual` rather than a set
		// comparison, because a walk that repeats a row and one that skips a row have the
		// same length as the list they came from.
		expect(walked).toEqual(whole.items.map((card) => card.slug));
	});

	test("leaves the four existing sorts exactly as they were", async () => {
		// Two shops placed so that four sorts agree and the fifth does not, which is the only
		// arrangement that tests anything. The lucky shop is closer by about 200 m, newest and
		// holds a single five-star review; the proven shop is 400 orders at 4.8. Every
		// existing sort puts the lucky one first — `distance` because it is nearer, `rating`
		// because 5 > 4.8 and that is the small-sample bug left standing on purpose, `newest`
		// because of the dates. `best` puts the proven one first, which is the whole point:
		// the fix lives in a sort a client opts into by name, so a shipped build that pages on
		// `rating` keeps the ordering it was built against.
		const caller = await seedShops([
			{
				id: "biz_lucky",
				slug: "soda-suerte",
				coords: EQUAL,
				ratingAvg: 5,
				ratingCount: 1,
				createdAt: "2024-06-01T00:00:00Z",
			},
			{
				id: "biz_proven",
				slug: "soda-probada",
				coords: NEAR,
				ratingAvg: 4.8,
				ratingCount: 400,
				createdAt: "2024-01-01T00:00:00Z",
			},
		]);

		const order = async (
			sort: "distance" | "rating" | "popular" | "newest" | "best",
		) =>
			(await caller.businesses.list({ ...ORIGIN, sort })).items.map(
				(card) => card.slug,
			);

		expect(await order("distance")).toEqual(["soda-suerte", "soda-probada"]);
		expect(await order("rating")).toEqual(["soda-suerte", "soda-probada"]);
		expect(await order("newest")).toEqual(["soda-suerte", "soda-probada"]);
		// The one sort the lucky shop loses on today, and the reason it is in this list: a
		// review count is a count, and it is the only one of the four that was never about
		// the quality claim at all.
		expect(await order("popular")).toEqual(["soda-probada", "soda-suerte"]);
		expect(await order("best")).toEqual(["soda-probada", "soda-suerte"]);
	});

	test("keeps the nearest shop when the retrieval has to truncate", async () => {
		// 200 shops at ~5 km, then the nearest one inserted *last*. Before the retrieval had
		// an `ORDER BY`, SQLite answered in rowid order and the 200-row limit dropped the row
		// this test looks for — so the bug was not "the ranking is wrong", it was "the shop
		// is not in the list, and the list does not say so". Only the retrieval changed; the
		// scoring below it never saw the difference.
		const filler: Shop[] = Array.from({ length: 200 }, (_, index) => ({
			id: `biz_filler_${String(index).padStart(3, "0")}`,
			slug: `soda-relleno-${index}`,
			coords: { lat: 9.973, lng: -84.0907 }, // ~5 km from ORIGIN
		}));
		const caller = await seedShops([
			...filler,
			{ id: "biz_nearest", slug: "soda-cercana", coords: EQUAL },
		]);

		const byDistance = await caller.businesses.list({
			...ORIGIN,
			sort: "distance",
		});
		expect(byDistance.items[0]?.slug).toBe("soda-cercana");

		const byBest = await caller.businesses.list({ ...ORIGIN, sort: "best" });
		expect(byBest.items[0]?.slug).toBe("soda-cercana");
	});

	test("truncates a newest list by date, not by distance", async () => {
		// The cut has to approximate the answer the caller asked for. Truncating a `newest`
		// list by proximity would answer that shop *near* the caller rather than shops that
		// are *new* — and it would do it silently, because a list that is missing its newest
		// row still looks like a list. So the 200 nearest shops are all older, and the newest
		// one is 7.6 km away, inside the radius but beyond the cut.
		const filler: Shop[] = Array.from({ length: 200 }, (_, index) => ({
			id: `biz_old_${String(index).padStart(3, "0")}`,
			slug: `soda-vieja-${index}`,
			coords: EQUAL,
			createdAt: "2024-01-01T00:00:00Z",
		}));
		const caller = await seedShops([
			...filler,
			{
				id: "biz_newest",
				slug: "soda-reciente",
				coords: FAR,
				createdAt: "2024-06-01T00:00:00Z",
			},
		]);

		const byNewest = await caller.businesses.list({
			...ORIGIN,
			sort: "newest",
		});
		expect(byNewest.items[0]?.slug).toBe("soda-reciente");

		// And the same pool under `best` keeps the nearest instead, because proximity is its
		// largest weight: the far shop is 201st of 201 and is not in the answer at all. That
		// absence is the candidate limit doing its job — stated here so the limit is a
		// decision the suite pins rather than a surprise somebody finds in production.
		const byBest = await caller.businesses.list({ ...ORIGIN, sort: "best" });
		expect(byBest.items.map((card) => card.slug)).not.toContain(
			"soda-reciente",
		);
	});
});
