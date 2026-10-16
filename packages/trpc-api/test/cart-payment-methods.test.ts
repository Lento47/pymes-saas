import { describe, expect, test } from "bun:test";
import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

describe("checkout payment availability", () => {
	test("follows the caller's cart and account changes without exposing recipient details", async () => {
		const w = world();
		w.env.SEPARATE_PAYMENTS_ENABLED = "true";
		try {
			const first = await seedBusiness(w.db, {
				id: "biz_payment_first",
				slug: "payment-first",
			});
			const second = await seedBusiness(w.db, {
				id: "biz_payment_second",
				slug: "payment-second",
			});
			const owner = await seedUser(w.db, { id: "usr_payment_owner" });
			await seedMembership(w.db, owner.id, first, "OWNER");
			const merchant = appRouter.createCaller(await authed(w, owner));
			const buyer = appRouter.createCaller(
				await authed(w, await seedUser(w.db, { id: "usr_payment_buyer" })),
			);
			expect(await buyer.cart.paymentMethods()).toEqual({
				businessId: null,
				methods: [],
			});
			const product = await seedProduct(w.db, {
				id: "prd_payment_first",
				businessId: first,
			});
			const other = await seedProduct(w.db, {
				id: "prd_payment_second",
				businessId: second,
			});
			await buyer.cart.addItem({
				productId: product.id,
				quantity: 1,
				onBusinessConflict: "reject",
			});
			expect(await buyer.cart.paymentMethods()).toEqual({
				businessId: first,
				methods: ["CASH"],
			});
			await merchant.orders.savePaymentAccount({
				businessId: first,
				account: { phone: "88881111", recipientName: "Cuenta comercio" },
			});
			expect(await buyer.cart.paymentMethods()).toEqual({
				businessId: first,
				methods: ["CASH", "SINPE_MOVIL"],
			});
			await merchant.orders.savePaymentAccount({
				businessId: first,
				account: null,
			});
			expect((await buyer.cart.paymentMethods()).methods).toEqual(["CASH"]);
			await merchant.orders.savePaymentAccount({
				businessId: first,
				account: { phone: "88881111", recipientName: "Cuenta comercio" },
			});
			await buyer.orders.savePaymentAccount({
				account: { phone: "88882222", recipientName: "Cuenta personal" },
			});
			await buyer.cart.addItem({
				productId: other.id,
				quantity: 1,
				onBusinessConflict: "replace",
			});
			expect(await buyer.cart.paymentMethods()).toEqual({
				businessId: second,
				methods: ["CASH"],
			});
		} finally {
			w.close();
		}
	});
	test("preserves legacy payment choices when separate payments are disabled", async () => {
		const w = world();
		try {
			const shop = await seedBusiness(w.db);
			const product = await seedProduct(w.db, { businessId: shop });
			const buyer = appRouter.createCaller(
				await authed(w, await seedUser(w.db)),
			);
			await buyer.cart.addItem({
				productId: product.id,
				quantity: 1,
				onBusinessConflict: "reject",
			});
			expect((await buyer.cart.paymentMethods()).methods).toEqual([
				"CASH",
				"SINPE_MOVIL",
			]);
		} finally {
			w.close();
		}
	});
});
