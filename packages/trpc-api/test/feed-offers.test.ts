import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, seedProduct, world } from "./harness";

/**
 * The home feed's offers rail and the offers page behind `products.list` are the same
 * fact — the products actually marked down — drawn twice. This spec pins that they
 * agree.
 *
 * The bug it exists to prevent: deepest-cut-first. A discount depth is a *ratio*, and
 * a cursor page cannot order on a ratio — the boundary logic re-derives `column < v`
 * from a value read off a row, and two cut amounts cut the same way can differ in the
 * last bit of a float, so a cursor on them would drop or repeat a product at a page
 * edge. That ordering was safe on the rail only because the rail never pages; the
 * moment the rail and the page had to agree, the page could not follow it. The fix
 * moved the rail to the column order both now share (`desc(soldCount),
 * desc(ratingAvg), desc(createdAt), asc(id)`, the same as `discover`), and this file
 * is what keeps the next sort from pulling them apart again.
 *
 * Defines an offer the same way the query does: `compareAtPriceMinor` is present and
 * strictly above `priceMinor`. A compare-at at or below the price is not a discount.
 */

async function shopWithOffers() {
	const test = world();
	const businessId = await seedBusiness(test.db, {
		id: "biz_offers",
		slug: "tienda-ofertas",
		name: "Tienda Ofertas",
	});

	// Three real offers, each with a strictly lower price, ordered most-sold first.
	await seedProduct(test.db, {
		id: "prd_hot",
		businessId,
		name: "Hot",
		priceMinor: 1000,
		compareAtPriceMinor: 2000,
		soldCount: 30,
	});
	await seedProduct(test.db, {
		id: "prd_warm",
		businessId,
		name: "Warm",
		priceMinor: 1300,
		compareAtPriceMinor: 2600,
		soldCount: 12,
	});
	await seedProduct(test.db, {
		id: "prd_low",
		businessId,
		name: "Low",
		priceMinor: 900,
		compareAtPriceMinor: 950,
		soldCount: 1,
	});
	// Not an offer: the compare-at sits below the price. The rail or the page that
	// included it would not be able to say by how much — because there is no cut.
	await seedProduct(test.db, {
		id: "prd_notsale",
		businessId,
		name: "NotSale",
		priceMinor: 5000,
		compareAtPriceMinor: 4000,
		soldCount: 99,
	});

	const caller = appRouter.createCaller(await contextFor(test, null));

	return { caller };
}

describe("the offers rail and the offers page", () => {
	test("return the same offers, in the same order, for the same call", async () => {
		const { caller } = await shopWithOffers();

		const feed = await caller.catalog.feed({});
		const page = await caller.products.list({ onSaleOnly: true, limit: 50 });

		const rail = feed.offers.map((offer) => offer.id);
		const offers = page.items.map((offer) => offer.id);

		// Same set…
		expect([...rail].sort()).toEqual([...offers].sort());
		// …and the same order.
		expect(rail).toEqual(offers);
		// And the not-really-an-offer is in neither.
		expect(rail).not.toContain("prd_notsale");
		expect(offers).not.toContain("prd_notsale");
	});

	test("the not-really-an-offer never reaches either", async () => {
		const { caller } = await shopWithOffers();

		// The fifty-dollar list is stable enough to assert, but the *one* that must hold
		// is the reason this spec exists at all: an upside-down compare-at is not a cut.
		const feed = await caller.catalog.feed({});
		const page = await caller.products.list({ onSaleOnly: true, limit: 50 });

		expect(feed.offers.map((offer) => offer.id)).not.toContain("prd_notsale");
		expect(page.items.map((item) => item.id)).not.toContain("prd_notsale");
	});
});
