import { describe, expect, test } from "bun:test";
import { order, orderPaymentProof } from "@pymeshub/db";
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
const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
async function fixture() {
	const w = world();
	w.env.SEPARATE_PAYMENTS_ENABLED = "true";
	const businessId = await seedBusiness(w.db);
	const owner = await seedUser(w.db, { id: "usr_checkout_owner" });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	const merchant = appRouter.createCaller(await authed(w, owner));
	const account = { phone: "+50688881111", recipientName: "Cuenta comercio" };
	await merchant.orders.savePaymentAccount({ businessId, account });
	const customer = await seedUser(w.db, { id: "usr_checkout_buyer" });
	const buyer = appRouter.createCaller(await authed(w, customer));
	const product = await seedProduct(w.db, { businessId, priceMinor: 2500 });
	await buyer.cart.addItem({ productId: product.id, quantity: 1 });
	const input = {
		fulfilment: "PICKUP" as const,
		paymentMethod: "SINPE_MOVIL" as const,
		locationId: "loc_" + businessId,
		clientRequestId: "checkout-proof-attempt",
	};
	const uploadInput = {
		businessId,
		amountMinor: 2500,
		account,
		mimeType: "image/png" as const,
		base64: PNG,
	};
	return { w, buyer, merchant, businessId, product, input, uploadInput };
}
describe("SINPE receipt before checkout", () => {
	test("requires an uploaded receipt before creating any order and preserves the cart", async () => {
		const f = await fixture();
		try {
			expect((await refused(f.buyer.orders.place(f.input))).message).toBe(
				"payments.refusal.proofRequired",
			);
			expect(await f.w.db.select().from(order)).toHaveLength(0);
			expect((await f.buyer.cart.get()).items).toHaveLength(1);
			const forged = {
				...f.input,
				paymentProofId: "payproof_00000000-0000-0000-0000-000000000000",
			};
			expect((await refused(f.buyer.orders.place(forged))).message).toBe(
				"payments.refusal.proofRequired",
			);
			expect(await f.w.db.select().from(order)).toHaveLength(0);
		} finally {
			f.w.close();
		}
	});
	test("uploads first, then atomically creates an order with evidence awaiting merchant verification; retries are idempotent", async () => {
		const f = await fixture();
		try {
			expect(await f.buyer.orders.checkoutPaymentAccount()).toEqual({
				businessId: f.businessId,
				account: f.uploadInput.account,
			});
			const receipt = await f.buyer.orders.uploadCheckoutProof(f.uploadInput);
			expect(await f.w.db.select().from(order)).toHaveLength(0);
			expect(await f.w.db.select().from(orderPaymentProof)).toHaveLength(0);
			const submitted = { ...f.input, paymentProofId: receipt.proofId };
			const [placed, concurrent] = await Promise.all([f.buyer.orders.place(submitted), f.buyer.orders.place(submitted)]);
			expect(concurrent.id).toBe(placed.id);
			expect(placed.paymentStatus).toBe("PENDING");
			const payments = await f.buyer.orders.payments({ orderId: placed.id });
			expect(
				payments.payments.find((p) => p.purpose === "MERCHANT_ORDER"),
			).toMatchObject({
				status: "AWAITING_VERIFICATION",
				proofId: receipt.proofId,
				version: 1,
			});
			expect(
				(
					await f.merchant.orders.paymentProof({
						orderId: placed.id,
						purpose: "MERCHANT_ORDER",
					})
				).base64,
			).toBe(PNG);
			expect((await f.buyer.orders.place(submitted)).id).toBe(placed.id);
			expect(await f.w.db.select().from(order)).toHaveLength(1);
			expect(await f.w.db.select().from(orderPaymentProof)).toHaveLength(1);
		} finally {
			f.w.close();
		}
	});
	test("does not accept another customer's receipt or expose accounts without a matching cart", async () => {
		const f = await fixture();
		try {
			const receipt = await f.buyer.orders.uploadCheckoutProof(f.uploadInput);
			const other = appRouter.createCaller(
				await authed(f.w, await seedUser(f.w.db, { id: "usr_other_checkout" })),
			);
			expect(await other.orders.checkoutPaymentAccount()).toEqual({
				businessId: null,
				account: null,
			});
			await other.cart.addItem({ productId: f.product.id, quantity: 1 });
			expect(
				(
					await refused(
						other.orders.place({ ...f.input, paymentProofId: receipt.proofId }),
					)
				).message,
			).toBe("payments.refusal.proofRequired");
			expect(await f.w.db.select().from(order)).toHaveLength(0);
		} finally {
			f.w.close();
		}
	});
	test("requires the amount and recipient shown at payment time to still match checkout", async () => {
		const f = await fixture();
		try {
			const receipt = await f.buyer.orders.uploadCheckoutProof({
				...f.uploadInput,
				amountMinor: 2400,
			});
			expect(
				(
					await refused(
						f.buyer.orders.place({
							...f.input,
							paymentProofId: receipt.proofId,
						}),
					)
				).message,
			).toBe("payments.refusal.changed");
			const matching = await f.buyer.orders.uploadCheckoutProof(f.uploadInput);
			await f.merchant.orders.savePaymentAccount({
				businessId: f.businessId,
				account: { phone: "+50688882222", recipientName: "Cuenta nueva" },
			});
			expect(
				(
					await refused(
						f.buyer.orders.place({
							...f.input,
							paymentProofId: matching.proofId,
						}),
					)
				).message,
			).toBe("payments.refusal.changed");
			expect(
				(await refused(f.buyer.orders.uploadCheckoutProof(f.uploadInput)))
					.message,
			).toBe("payments.refusal.changed");
			expect(await f.w.db.select().from(order)).toHaveLength(0);
		} finally {
			f.w.close();
		}
	});
	test("failed uploads and invalid images never create orders", async () => {
		const f = await fixture();
		try {
			expect(
				(
					await refused(
						f.buyer.orders.uploadCheckoutProof({
							...f.uploadInput,
							base64: "not an image",
						}),
					)
				).message,
			).toBe("payments.refusal.image");
			f.w.env.MEDIA.put = async () => {
				throw new Error("R2 upload failed");
			};
			await expect(
				f.buyer.orders.uploadCheckoutProof(f.uploadInput),
			).rejects.toThrow("R2 upload failed");
			expect(await f.w.db.select().from(order)).toHaveLength(0);
			expect((await f.buyer.cart.get()).items).toHaveLength(1);
		} finally {
			f.w.close();
		}
	});
	test("one receipt cannot fund two orders even when both photos were staged before the first order", async () => {
		const f = await fixture();
		try {
			const first = await f.buyer.orders.uploadCheckoutProof(f.uploadInput);
			const other = appRouter.createCaller(
				await authed(
					f.w,
					await seedUser(f.w.db, { id: "usr_second_transfer" }),
				),
			);
			await other.cart.addItem({ productId: f.product.id, quantity: 1 });
			const second = await other.orders.uploadCheckoutProof(f.uploadInput);
			const attempts = await Promise.allSettled([
				f.buyer.orders.place({ ...f.input, paymentProofId: first.proofId }),
				other.orders.place({ ...f.input, paymentProofId: second.proofId }),
			]);
			expect(
				attempts.filter((attempt) => attempt.status === "fulfilled"),
			).toHaveLength(1);
			expect(
				attempts.filter((attempt) => attempt.status === "rejected"),
			).toHaveLength(1);
			expect(await f.w.db.select().from(order)).toHaveLength(1);
		} finally {
			f.w.close();
		}
	});
	test("an evidence-write failure rolls back the order and keeps the receipt usable for a new attempt", async () => {
		const f = await fixture();
		try {
			const receipt = await f.buyer.orders.uploadCheckoutProof(f.uploadInput);
			f.w.sqlite.exec(
				"CREATE TRIGGER fail_checkout_proof BEFORE INSERT ON order_payment_proof BEGIN SELECT RAISE(ABORT, 'forced proof failure'); END",
			);
			await expect(
				f.buyer.orders.place({ ...f.input, paymentProofId: receipt.proofId }),
			).rejects.toThrow("forced proof failure");
			expect(await f.w.db.select().from(order)).toHaveLength(0);
			expect((await f.buyer.cart.get()).items).toHaveLength(1);
			f.w.sqlite.exec("DROP TRIGGER fail_checkout_proof");
			const placed = await f.buyer.orders.place({
				...f.input,
				clientRequestId: "checkout-proof-new-attempt",
				paymentProofId: receipt.proofId,
			});
			expect(placed.paymentStatus).toBe("PENDING");
		} finally {
			f.w.close();
		}
	});
});
