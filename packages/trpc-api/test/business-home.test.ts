import { expect, test } from "bun:test";
import { addToCartInput, merchantHomeSchema } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

test("merchant home scopes orders to one branch and keeps the catalog shop-wide", async () => {
	const testWorld = world();
	try {
		const businessId = await seedBusiness(testWorld.db, { id: "biz_home_one" });
		const otherId = await seedBusiness(testWorld.db, { id: "biz_home_other" });
		await seedProduct(testWorld.db, {
			id: "prd_home_sold_out",
			businessId,
			trackInventory: true,
			stockQuantity: 0,
		});
		await seedProduct(testWorld.db, {
			id: "prd_home_available",
			businessId,
			trackInventory: true,
			stockQuantity: 5,
		});
		await seedProduct(testWorld.db, {
			id: "prd_home_other",
			businessId: otherId,
			trackInventory: true,
			stockQuantity: 0,
		});
		const buyerUser = await seedUser(testWorld.db, { id: "usr_home_buyer" });
		const buyer = appRouter.createCaller(await authed(testWorld, buyerUser));
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: "prd_home_available", quantity: 1 }),
		);
		const placed = await buyer.orders.place({
			fulfilment: "PICKUP",
			paymentMethod: "CASH",
			clientRequestId: "req_home_one",
		});
		const ownerUser = await seedUser(testWorld.db, { id: "usr_home_owner" });
		await seedMembership(testWorld.db, ownerUser.id, businessId, "OWNER");
		const owner = appRouter.createCaller(await authed(testWorld, ownerUser));
		const otherLocation = await owner.business.createLocation({
			businessId,
			name: "Sucursal Dos",
			line1: "Calle de Prueba 2",
			city: "Ciudad de Prueba",
			region: "Provincia de Prueba",
		});
		await buyer.cart.addItem(
			addToCartInput.parse({ productId: "prd_home_available", quantity: 1 }),
		);
		const placedOther = await buyer.orders.place({
			locationId: otherLocation.id,
			fulfilment: "PICKUP",
			paymentMethod: "CASH",
			clientRequestId: "req_home_two",
		});

		const home = merchantHomeSchema.parse(
			await owner.business.home({
				businessId,
				locationId: `loc_${businessId}`,
			}),
		);
		expect(home.location.id).toBe(businessId);
		expect(home.selectedLocation.id).toBe(`loc_${businessId}`);
		expect(home.pulse.active).toBe(1);
		expect(home.orders.map((order) => order.id)).toEqual([placed.id]);
		expect(home.catalog).toMatchObject({ active: 2, draft: 0, outOfStock: 1 });
		expect(home.catalog.products.map((product) => product.id).sort()).toEqual([
			"prd_home_available",
			"prd_home_sold_out",
		]);
		expect(home.attention).toEqual([
			{
				type: "new_order",
				severity: "high",
				count: 1,
				action: { type: "OPEN_ORDERS" },
			},
			{
				type: "inventory_zero",
				severity: "medium",
				count: 1,
				action: { type: "OPEN_CATALOG" },
			},
		]);
		const secondHome = merchantHomeSchema.parse(
			await owner.business.home({ businessId, locationId: otherLocation.id }),
		);
		expect(secondHome.selectedLocation.id).toBe(otherLocation.id);
		expect(secondHome.pulse.active).toBe(1);
		expect(secondHome.orders.map((order) => order.id)).toEqual([
			placedOther.id,
		]);
		expect(secondHome.attention[0]?.count).toBe(1);
		expect(secondHome.catalog).toEqual(home.catalog);
		const crossBranch = await refused(
			owner.business.home({ businessId, locationId: `loc_${otherId}` }),
		);
		expect(crossBranch.code).toBe("NOT_FOUND");
		const crossTenant = await refused(
			owner.business.home({
				businessId: otherId,
				locationId: `loc_${otherId}`,
			}),
		);
		expect(crossTenant.code).toBe("FORBIDDEN");
	} finally {
		testWorld.close();
	}
});
