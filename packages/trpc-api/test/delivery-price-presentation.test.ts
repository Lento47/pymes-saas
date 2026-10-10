import { expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, world } from "./harness";

test("public shop cards stop presenting courier pay as the road delivery price", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_road_price_card",
		});
		const caller = appRouter.createCaller(await contextFor(testWorld, null));
		const fixed = await caller.businesses.bySlug({
			slug: `tienda-${businessId}`,
		});
		expect(fixed.card.deliveryFeeMinor).toBe(850);
		expect(fixed.card.deliveryPriceAtCheckout).toBe(false);

		testWorld.env.ROUTE_FEE_ENABLED = "true";
		const storefront = await caller.businesses.bySlug({
			slug: `tienda-${businessId}`,
		});
		expect(storefront.card.deliveryPriceAtCheckout).toBe(true);
		const listed = await caller.businesses.list({});
		expect(
			listed.items.find((item) => item.id === businessId)
				?.deliveryPriceAtCheckout,
		).toBe(true);
		const searched = await caller.catalog.search({ q: "Tienda de Prueba" });
		expect(
			searched.businesses.find((item) => item.id === businessId)
				?.deliveryPriceAtCheckout,
		).toBe(true);
	} finally {
		testWorld.close();
	}
});
