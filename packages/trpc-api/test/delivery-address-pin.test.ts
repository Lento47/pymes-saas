import { describe, expect, test } from "bun:test";
import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedProduct,
	seedUser,
	world,
} from "./harness";

describe("delivery destination pin", () => {
	for (const routing of [false, true]) {
		test(`a missing pin refuses quote and placement before writes (routing ${routing})`, async () => {
			const test = world();
			try {
				if (routing) test.env.ROUTING_ENABLED = "true";
				const businessId = await seedBusiness(test.db);
				const product = await seedProduct(test.db, { businessId });
				const customer = await seedUser(test.db);
				const caller = appRouter.createCaller(await authed(test, customer));
				await caller.cart.addItem({ productId: product.id, quantity: 1 });
				const address = await caller.users.saveAddress({
					line1: "Street",
					city: "San José",
					region: "San José",
				});
				const input = {
					fulfilment: "DELIVERY" as const,
					addressId: address.id,
				};
				const quoteError = await refused(caller.cart.quote(input));
				expect(quoteError.message).toBe("checkout.refusal.addressPinRequired");
				const placeError = await refused(
					caller.orders.place({
						...input,
						paymentMethod: "CASH",
						clientRequestId: `missing-pin-${routing}`,
					}),
				);
				expect(placeError.message).toBe("checkout.refusal.addressPinRequired");
				expect(
					test.sqlite.prepare('SELECT count(*) AS n FROM "order"').get(),
				).toEqual({ n: 0 });
				expect(
					test.sqlite.prepare("SELECT count(*) AS n FROM delivery").get(),
				).toEqual({ n: 0 });
				expect((await caller.cart.get()).items).toHaveLength(1);
				const pickup = await caller.orders.place({
					fulfilment: "PICKUP",
					paymentMethod: "CASH",
					clientRequestId: `pickup-no-pin-${routing}`,
				});
				expect(pickup.status).toBe("PENDING");
			} finally {
				test.close();
			}
		});
	}

	test("a pinned destination is preserved on the delivery request", async () => {
		const test = world();
		try {
			const businessId = await seedBusiness(test.db);
			const product = await seedProduct(test.db, { businessId });
			const customer = await seedUser(test.db);
			const caller = appRouter.createCaller(await authed(test, customer));
			await caller.cart.addItem({ productId: product.id, quantity: 1 });
			const address = await caller.users.saveAddress({
				line1: "Street",
				city: "San José",
				region: "San José",
				lat: 9.94,
				lng: -84.07,
			});
			const input = { fulfilment: "DELIVERY" as const, addressId: address.id };
			const quote = await caller.cart.quote(input);
			await caller.orders.place({
				...input,
				paymentMethod: "CASH",
				clientRequestId: "pinned-destination",
				expectedTotalMinor: quote.totalMinor,
			});
			expect(
				test.sqlite
					.prepare("SELECT dropoff_lat, dropoff_lng FROM delivery")
					.get(),
			).toEqual({
				dropoff_lat: 9.94,
				dropoff_lng: -84.07,
			});
		} finally {
			test.close();
		}
	});
});
