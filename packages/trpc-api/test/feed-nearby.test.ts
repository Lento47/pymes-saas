import { describe, expect, test } from "bun:test";

import { business as businessTable } from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, world } from "./harness";

/**
 * "Near you" is two lists, and only one of them can filter.
 *
 * The bug this file exists to prevent: `publicBusinesses` applied its distance rank to
 * *both* of its orders. With no origin, `distanceTo` answers `null` for every row, so
 * `.filter((card) => card.distanceKm !== null)` removed every row and `catalog.feed`'s
 * `nearby` was empty for **every** caller who had not granted location. Nothing failed —
 * the shape was right, the other two sections were full, and the only symptom was a
 * location prompt sitting where the shops should have been. No test read `nearby` at all,
 * which is how it got there, so this one reads it three ways.
 *
 * The contract is the home screen's own, written in `apps/mobile/app/(tabs)/index.tsx`:
 * "without coords the API answers with the same shape and `nearby` is the newest businesses
 * instead of the closest." Both halves of that sentence are pinned below, because fixing
 * the empty list by returning the *closest* without a coordinate would satisfy the first
 * clause and break the second.
 *
 * A business with no coordinates is the one row whose treatment differs between the two
 * lists, so it is in every case: present in the newest-first list, absent from the
 * distance-ranked one (it cannot be ranked against a shop that has coordinates), which is
 * the rule the old code was right about and applied one list too widely.
 */

/** San José, and two shops at known bearings from it. */
const ORIGIN = { lat: 9.9281, lng: -84.0907 };
const NEAR = { lat: 9.935, lng: -84.0907 }; // ~0.8 km
const FAR = { lat: 9.86, lng: -84.0907 }; // ~7.6 km

/**
 * Three shops — one near, one far, one with no coordinates at all — and an anonymous
 * caller. The coordinates are written after seeding because `seedBusiness` does not take
 * them: every shop in the fixture is otherwise identical, so an order in the result can
 * only come from the distance or the date this file set.
 */
async function threeShops() {
	const test = world();

	const near = await seedBusiness(test.db, {
		id: "biz_near",
		slug: "soda-cerca",
		name: "Soda Cerca",
	});
	const far = await seedBusiness(test.db, {
		id: "biz_far",
		slug: "soda-lejos",
		name: "Soda Lejos",
	});
	// The shop nobody can place. Its `lat`/`lng` stay null, which is the seed's default.
	const unplaced = await seedBusiness(test.db, {
		id: "biz_unplaced",
		slug: "soda-sin-ubicacion",
		name: "Soda Sin Ubicación",
	});

	const placed = [
		[near, NEAR, "2024-01-01T00:00:00Z"],
		[far, FAR, "2024-06-01T00:00:00Z"],
		[unplaced, null, "2024-03-01T00:00:00Z"],
	] as const;

	for (const [id, coords, createdAt] of placed) {
		await test.db
			.update(businessTable)
			.set({
				lat: coords?.lat ?? null,
				lng: coords?.lng ?? null,
				createdAt: new Date(createdAt),
			})
			.where(eq(businessTable.id, id));
	}

	const caller = appRouter.createCaller(await contextFor(test, null));

	return { caller };
}

describe("the home feed's nearby list", () => {
	test("answers with businesses, not an empty list, when nobody sent coordinates", async () => {
		const { caller } = await threeShops();

		const feed = await caller.catalog.feed({});

		// The regression itself. Before the fix this was `[]` — and it was `[]` for every
		// caller, on every request, because the filter had nothing left to keep.
		expect(feed.nearby.length).toBe(3);
		expect(feed.nearby.map((card) => card.slug).sort()).toEqual([
			"soda-cerca",
			"soda-lejos",
			"soda-sin-ubicacion",
		]);
	});

	test("carries no distance for a caller who sent no coordinates", async () => {
		const { caller } = await threeShops();

		const feed = await caller.catalog.feed({});

		// Not an assertion about the API's restraint for its own sake: the phone draws a
		// distance from this field, and a fabricated one would label a shop "1,2 km" away
		// from somebody whose location was never read.
		for (const card of feed.nearby) expect(card.distanceKm).toBeNull();
	});

	test("orders the no-coordinate list newest first", async () => {
		const { caller } = await threeShops();

		const feed = await caller.catalog.feed({});

		// Seeded oldest to newest: far (January), unplaced (March), near (June). The
		// distance order would be near, far, and the unplaced shop gone — so this asserts
		// the other order, which is the one a coordinate-less caller is promised.
		expect(feed.nearby.map((card) => card.slug)).toEqual([
			"soda-lejos",
			"soda-sin-ubicacion",
			"soda-cerca",
		]);
	});

	test("ranks by distance and drops what cannot be ranked, once coordinates arrive", async () => {
		const { caller } = await threeShops();

		const feed = await caller.catalog.feed(ORIGIN);

		// The unplaced shop is gone: it cannot be compared with a shop that has a position,
		// and a "nearest" list that includes a business of unknown distance is a list that
		// lies about its own order. This is the half of the old behaviour that was correct.
		expect(feed.nearby.map((card) => card.slug)).toEqual([
			"soda-cerca",
			"soda-lejos",
		]);

		const [first, second] = feed.nearby;
		expect(first?.distanceKm).not.toBeNull();
		expect(second?.distanceKm).not.toBeNull();
		// Ascending, and the near one is the near one — a rank that runs the other way
		// would put the far shop first and still look sorted.
		expect(first?.distanceKm ?? 0).toBeLessThan(second?.distanceKm ?? 0);
	});
});
