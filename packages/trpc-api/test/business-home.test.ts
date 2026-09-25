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
		expect(home.pulse.currency).toBe("CRC");
		expect(home.pulse.period.from).toBeInstanceOf(Date);
		expect(home.pulse.period.to).toBeInstanceOf(Date);
		expect(home.pulse.period.timezone).not.toBe("");
		expect(home.pulse.orderCount).toBe(0);
		expect(home.pulse.averageOrderValueMinor).toBe(0);
		expect(home.pulse.grossSalesMinor).toBe(0);
		expect(home.pulse.discountsMinor).toBe(0);
		expect(home.pulse.refundsMinor).toBe(0);
		expect(home.pulse.merchantNetSalesMinor).toBe(0);
		expect(
			home.pulse.comparisons?.map((comparison) => comparison.period).sort(),
		).toEqual(["previous_day", "previous_week"]);
		expect(home.insights).toEqual({
			estimatedMarginPercent: null,
			topProduct: "Producto de Prueba",
			averagePreparationMinutes: 10,
			projectedPayoutMinor: home.pulse.merchantNetSalesMinor,
		});
		expect(home.orders.map((order) => order.id)).toEqual([placed.id]);
		expect(home.catalog).toMatchObject({ active: 2, draft: 0, outOfStock: 1 });
		expect(home.catalog.products.map((product) => product.id).sort()).toEqual([
			"prd_home_available",
			"prd_home_sold_out",
		]);
		expect(home.attention.map((alert) => alert.type)).toEqual([
			"new_order",
			"inventory_zero",
		]);
		expect(home.attention.map((alert) => alert.id)).toEqual([
			`alert:new_order:${placed.id}`,
			"alert:inventory_zero:prd_home_sold_out",
		]);
		expect(home.attention.map((alert) => alert.action)).toEqual([
			"open_orders",
			"open_inventory",
		]);
		for (const alert of home.attention) {
			expect(alert.createdAt).toBeInstanceOf(Date);
		}
		const available = home.catalog.products.find(
			(product) => product.id === "prd_home_available",
		);
		const soldOut = home.catalog.products.find(
			(product) => product.id === "prd_home_sold_out",
		);
		expect(available?.locationScope).toBe("all_locations");
		expect(available?.availability).toMatchObject({
			inStock: true,
			quantity: 5,
			unavailableReason: null,
			inventory: { trackInventory: true, stockQuantity: 5 },
		});
		expect(soldOut?.locationScope).toBe("all_locations");
		expect(soldOut?.availability).toMatchObject({
			inStock: false,
			quantity: 0,
			unavailableReason: "out_of_stock",
			inventory: { trackInventory: true, stockQuantity: 0 },
		});
		const secondHome = merchantHomeSchema.parse(
			await owner.business.home({ businessId, locationId: otherLocation.id }),
		);
		expect(secondHome.selectedLocation.id).toBe(otherLocation.id);
		expect(secondHome.pulse.active).toBe(1);
		expect(secondHome.orders.map((order) => order.id)).toEqual([
			placedOther.id,
		]);
		expect(secondHome.attention.map((alert) => alert.type)).toContain(
			"new_order",
		);
		expect(secondHome.catalog).toEqual(home.catalog);
		const repeatedHome = merchantHomeSchema.parse(
			await owner.business.home({
				businessId,
				locationId: `loc_${businessId}`,
			}),
		);
		expect(repeatedHome.attention.map((alert) => alert.id)).toEqual(
			home.attention.map((alert) => alert.id),
		);
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
