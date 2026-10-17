import { describe, expect, test } from "bun:test";
import {
	business as businessTable,
	courierPresence,
	courierProfile,
	merchantLocation,
	order as orderTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
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
const SECOND_PNG = btoa(`${atob(PNG)}\n`);
function requireValue<T>(value: T | null | undefined): T {
	if (value == null) throw new Error("Missing payment evidence");
	return value;
}
async function setup(
	method: "CASH" | "SINPE_MOVIL" = "CASH",
	free = false,
	road = false,
) {
	const w = world();
	w.env.SEPARATE_PAYMENTS_ENABLED = "true";
	if (road) {
		w.env.ROUTE_FEE_ENABLED = "true";
		w.env.ROUTING_ENABLED = "true";
		w.env.ROUTING_SERVICE = {
			fetch: async () =>
				Response.json({
					code: "Ok",
					routes: [
						{
							distance: 4000,
							duration: 720,
							geometry: {
								type: "LineString",
								coordinates: [
									[-84.08, 9.93],
									[-84.09, 9.94],
								],
							},
						},
					],
				}),
		} as unknown as Fetcher;
	}
	const businessId = await seedBusiness(w.db);
	await w.db
		.update(merchantLocation)
		.set({ lat: 9.93, lng: -84.08 })
		.where(eq(merchantLocation.businessId, businessId));
	if (free)
		await w.db
			.update(businessTable)
			.set({ merchantCoversDelivery: true })
			.where(eq(businessTable.id, businessId));
	const owner = await seedUser(w.db, { id: "usr_pay_owner" });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	const merchant = appRouter.createCaller(await authed(w, owner));
	await merchant.orders.savePaymentAccount({
		businessId,
		account: { phone: "+50688881111", recipientName: "Titular comercio" },
	});
	const customer = await seedUser(w.db, { id: "usr_pay_buyer" });
	const buyer = appRouter.createCaller(await authed(w, customer));
	const courierUser = await seedUser(w.db, {
		id: "usr_pay_courier",
		name: "Repartidor",
	});
	const now = new Date();
	await w.db.insert(courierProfile).values({
		id: "cpr_pay_courier",
		userId: courierUser.id,
		displayName: "Repartidor",
		serviceArea: "San José",
		isAvailable: true,
		verificationStatus: "VERIFIED",
		createdAt: now,
		updatedAt: now,
	});
	await w.db.insert(courierPresence).values({
		id: "cps_pay_courier",
		userId: courierUser.id,
		lat: 9.9301,
		lng: -84.0801,
		accuracyMeters: 8,
		updatedAt: now,
	});
	const courier = appRouter.createCaller(await authed(w, courierUser));
	await courier.orders.savePaymentAccount({
		account: { phone: "+50688882222", recipientName: "Titular repartidor" },
	});
	const product = await seedProduct(w.db, { businessId, priceMinor: 2500 });
	await buyer.cart.addItem({ productId: product.id, quantity: 1 });
	const address = await buyer.users.saveAddress({
		label: "Casa",
		line1: "Portón",
		city: "San José",
		region: "San José",
		lat: 9.94,
		lng: -84.09,
	});
	const routeQuote = road
		? await buyer.cart.quote({
				fulfilment: "DELIVERY",
				locationId: `loc_${businessId}`,
				addressId: address.id,
			})
		: null;
	const checkoutProof = method === "SINPE_MOVIL" ? await buyer.orders.uploadCheckoutProof({
		businessId, amountMinor: 2500, mimeType: "image/png", base64: PNG,
		account: { phone: "+50688881111", recipientName: "Titular comercio" },
	}) : null;
	const order = await buyer.orders.place({
		fulfilment: "DELIVERY",
		locationId: `loc_${businessId}`,
		addressId: address.id,
		paymentMethod: method,
		paymentProofId: checkoutProof?.proofId,
		clientRequestId: `payments-${method}`,
		quoteId: routeQuote?.roadQuote?.quoteId,
		expectedTotalMinor: routeQuote?.totalMinor,
	});
	for (const to of ["ACCEPTED", "PREPARING"] as const)
		await merchant.orders.advance({ orderId: order.id, to });
	async function accept() {
		await merchant.orders.advance({ orderId: order.id, to: "READY" });
		const [offer] = await courier.deliveries.offers();
		if (!offer) throw new Error("Missing courier request");
		const accepted = await courier.deliveries.acceptOffer({
			offerId: offer.id,
		});
		await courier.deliveries.advance({
			deliveryId: accepted.id,
			action: "START_TO_PICKUP",
		});
		await courier.deliveries.advance({
			deliveryId: accepted.id,
			action: "ARRIVE_PICKUP",
		});
		return { offer, deliveryId: accepted.id };
	}
	return { w, merchant, buyer, courier, order, businessId, accept };
}

describe("separate order payments", () => {
	test("a courier's SINPE advance still requires the business's confirmation before pickup", async () => {
		const f = await setup();
		try {
			const { deliveryId } = await f.accept();
			const target = {
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER" as const,
			};
			await f.courier.orders.choosePaymentMethod({
				...target,
				method: "SINPE_MOVIL",
				expectedVersion: 0,
			});
			const uploaded = await f.courier.orders.submitPaymentProof({
				...target,
				mimeType: "image/png",
				base64: PNG,
				expectedVersion: 1,
			});
			const advance = uploaded.payments.find(
				(p) => p.purpose === "MERCHANT_ORDER",
			);
			if (!advance?.proofId) throw new Error("Missing advance evidence");
			expect(advance).toMatchObject({
				payer: "COURIER",
				payee: "MERCHANT",
				amountMinor: 2500,
				status: "AWAITING_VERIFICATION",
			});
			expect(
				(
					await refused(
						f.courier.deliveries.advance({
							deliveryId,
							action: "CONFIRM_PICKUP",
						}),
					)
				).message,
			).toBe("payments.refusal.businessUnpaid");
			await f.merchant.orders.reviewPayment({
				...target,
				decision: "CONFIRM",
				proofId: advance.proofId,
				expectedVersion: 2,
			});
			await f.courier.deliveries.advance({
				deliveryId,
				action: "CONFIRM_PICKUP",
			});
			const result = await f.courier.orders.payments({ orderId: f.order.id });
			expect(
				result.payments.find((p) => p.purpose === "COURIER_COLLECTION"),
			).toMatchObject({
				amountMinor: 3350,
				method: "CASH",
				canVerify: true,
				unlocked: true,
			});
		} finally {
			f.w.close();
		}
	});
	test("cancellation blocks payment writes and stored financial obligations cannot be edited", async () => {
		const f = await setup();
		try {
			expect(() =>
				f.w.sqlite.exec("UPDATE order_payment SET amount_minor=1"),
			).toThrow("Payment obligations are immutable");
			await f.accept();
			f.w.sqlite
				.prepare("UPDATE [order] SET status='CANCELLED' WHERE id=?")
				.run(f.order.id);
			expect(
				(
					await refused(
						f.merchant.orders.reviewPayment({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
							decision: "CONFIRM",
							expectedVersion: 0,
						}),
					)
				).message,
			).toBe("payments.refusal.cancelled");
			expect(() =>
				f.w.sqlite.exec("UPDATE order_payment SET status='CONFIRMED'"),
			).toThrow("Order cancelled during payment verification");
		} finally {
			f.w.close();
		}
	});
	test("a manually selected courier cannot receive customer transfers before actually accepting the delivery", async () => {
		const f = await setup("SINPE_MOVIL");
		try {
			const uploaded = await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				mimeType: "image/png",
				base64: PNG,
				expectedVersion: 0,
			});
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				decision: "CONFIRM",
				expectedVersion: 1,
				proofId: requireValue(
					requireValue(
						uploaded.payments.find((p) => p.purpose === "MERCHANT_ORDER"),
					).proofId,
				),
			});
			await f.w.db
				.update(orderTable)
				.set({ courierUserId: "usr_pay_courier" })
				.where(eq(orderTable.id, f.order.id));
			expect(
				(
					await refused(
						f.buyer.orders.choosePaymentMethod({
							orderId: f.order.id,
							purpose: "COURIER_COLLECTION",
							method: "SINPE_MOVIL",
							expectedVersion: 0,
						}),
					)
				).message,
			).toBe("payments.refusal.waitForMerchant");
		} finally {
			f.w.close();
		}
	});
	test("the fixed road quote becomes a cash advance plus one customer collection, without repricing courier earnings", async () => {
		const f = await setup("CASH", false, true);
		try {
			expect(
				await f.buyer.orders.payments({ orderId: f.order.id }),
			).toMatchObject({
				merchantAmountMinor: 2500,
				courierChargeMinor: 2310,
				customerTotalMinor: 4810,
				courierEarningsMinor: 2310,
			});
			const { offer } = await f.accept();
			expect(offer).toMatchObject({
				merchantAdvanceMinor: 2500,
				customerCollectionMinor: 4810,
				courierFeeMinor: 2310,
			});
		} finally {
			f.w.close();
		}
	});
	test("payment evidence cannot be fetched through the public image route", async () => {
		const f = await setup("SINPE_MOVIL");
		try {
			await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				mimeType: "image/png",
				base64: PNG,
				expectedVersion: 0,
			});
			const stored = f.w.sqlite
				.query("SELECT key FROM order_payment_proof")
				.get() as { key: string };
			const result = await createApp().fetch(
				new Request(`https://api.example.test/uploads/${stored.key}`),
				f.w.env,
			);
			expect(result.status).toBe(404);
		} finally {
			f.w.close();
		}
	});
	test("rejected evidence remains auditable and a stale review cannot confirm the replacement", async () => {
		const f = await setup("SINPE_MOVIL");
		try {
			const first = await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				mimeType: "image/png",
				base64: PNG,
				expectedVersion: 0,
			});
			const firstId = requireValue(
				requireValue(first.payments.find((p) => p.purpose === "MERCHANT_ORDER"))
					.proofId,
			);
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				decision: "REJECT",
				expectedVersion: 1,
				proofId: firstId,
				reason: "El monto no coincide",
			});
			await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				mimeType: "image/png",
				base64: SECOND_PNG,
				expectedVersion: 2,
			});
			expect(
				(
					await refused(
						f.merchant.orders.reviewPayment({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
							decision: "CONFIRM",
							expectedVersion: 1,
							proofId: firstId,
						}),
					)
				).message,
			).toBe("payments.refusal.changed");
			expect(
				(
					await refused(
						f.merchant.orders.paymentProof({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
							proofId: firstId,
						}),
					)
				).code,
			).toBe("NOT_FOUND");
			expect(
				f.w.sqlite.query("SELECT id FROM order_payment_proof").all(),
			).toHaveLength(2);
		} finally {
			f.w.close();
		}
	});
	test("business self-delivery reserves the driver before a cash advance without skipping payment", async () => {
		const f = await setup();
		try {
			await f.merchant.orders.advance({ orderId: f.order.id, to: "READY" });
			const reserved = await f.merchant.orders.startSelfDelivery({
				orderId: f.order.id,
				expectedStatus: "READY",
			});
			expect(reserved.status).toBe("READY");
			expect(await f.courier.deliveries.offers()).toEqual([]);
			expect(
				(
					await f.merchant.orders.payments({ orderId: f.order.id })
				).payments.find((p) => p.purpose === "MERCHANT_ORDER"),
			).toMatchObject({ canPay: true, canVerify: true, unlocked: true });
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				decision: "CONFIRM",
				expectedVersion: 0,
			});
			expect(
				(
					await f.merchant.orders.startSelfDelivery({
						orderId: f.order.id,
						expectedStatus: "READY",
					})
				).status,
			).toBe("OUT_FOR_DELIVERY");
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "COURIER_COLLECTION",
				decision: "CONFIRM",
				expectedVersion: 0,
			});
			expect(
				(
					await f.merchant.orders.completeSelfDelivery({
						orderId: f.order.id,
						expectedStatus: "OUT_FOR_DELIVERY",
					})
				).status,
			).toBe("COMPLETED");
		} finally {
			f.w.close();
		}
	});
	test("cash: courier fronts products, merchant confirms, customer pays products plus Express to courier", async () => {
		const f = await setup();
		try {
			const { offer, deliveryId } = await f.accept();
			expect(offer).toMatchObject({
				merchantAdvanceMinor: 2500,
				customerCollectionMinor: 3350,
				courierFeeMinor: 850,
			});
			const customerView = await f.buyer.orders.payments({
				orderId: f.order.id,
			});
			expect(customerView).toMatchObject({
				cashAdvance: true,
				merchantAmountMinor: 2500,
				courierChargeMinor: 850,
				customerTotalMinor: 3350,
				courierEarningsMinor: 850,
			});
			expect(
				customerView.payments.find((p) => p.purpose === "MERCHANT_ORDER"),
			).toMatchObject({
				payer: "COURIER",
				payee: "MERCHANT",
				amountMinor: 2500,
				canPay: false,
			});
			expect(
				(
					await refused(
						f.courier.deliveries.advance({
							deliveryId,
							action: "CONFIRM_PICKUP",
						}),
					)
				).message,
			).toBe("payments.refusal.businessUnpaid");
			expect(
				(
					await refused(
						f.buyer.orders.reviewPayment({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
							decision: "CONFIRM",
							expectedVersion: 0,
						}),
					)
				).code,
			).toBe("FORBIDDEN");
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				decision: "CONFIRM",
				expectedVersion: 0,
			});
			await f.courier.deliveries.advance({
				deliveryId,
				action: "CONFIRM_PICKUP",
			});
			expect(
				(
					await refused(
						f.courier.deliveries.advance({ deliveryId, action: "COMPLETE" }),
					)
				).message,
			).toBe("payments.refusal.collectionUnpaid");
			await f.courier.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "COURIER_COLLECTION",
				decision: "CONFIRM",
				expectedVersion: 0,
			});
			await f.courier.deliveries.advance({ deliveryId, action: "COMPLETE" });
			expect(
				(await f.buyer.orders.byId({ id: f.order.id })).paymentStatus,
			).toBe("PAID");
			expect(
				(await f.buyer.orders.payments({ orderId: f.order.id }))
					.customerTotalMinor,
			).toBe(3350);
		} finally {
			f.w.close();
		}
	});
	test("SINPE: upload is not verification; each recipient verifies only their own transfer", async () => {
		const f = await setup("SINPE_MOVIL");
		try {
			expect(
				(
					await refused(
						f.merchant.orders.advance({ orderId: f.order.id, to: "READY" }),
					)
				).message,
			).toBe("payments.refusal.businessUnpaid");
			const submitted = await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				mimeType: "image/png",
				base64: PNG,
				expectedVersion: 0,
			});
			const merchantPayment = requireValue(
				submitted.payments.find((p) => p.purpose === "MERCHANT_ORDER"),
			);
			expect(merchantPayment).toMatchObject({
				amountMinor: 2500,
				status: "AWAITING_VERIFICATION",
				payer: "CUSTOMER",
				version: 1,
			});
			expect(
				(await f.buyer.orders.byId({ id: f.order.id })).paymentStatus,
			).toBe("PENDING");
			expect(
				(
					await f.merchant.orders.paymentProof({
						orderId: f.order.id,
						purpose: "MERCHANT_ORDER",
					})
				).base64,
			).toBe(PNG);
			expect(
				(
					await refused(
						f.buyer.orders.choosePaymentMethod({
							orderId: f.order.id,
							purpose: "COURIER_COLLECTION",
							method: "SINPE_MOVIL",
							expectedVersion: 0,
						}),
					)
				).message,
			).toBe("payments.refusal.waitForMerchant");
			await f.merchant.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER",
				decision: "CONFIRM",
				expectedVersion: 1,
				proofId: requireValue(merchantPayment.proofId),
			});
			await f.accept();
			expect(
				(
					await refused(
						f.courier.orders.paymentProof({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
						}),
					)
				).code,
			).toBe("NOT_FOUND");
			await f.buyer.orders.choosePaymentMethod({
				orderId: f.order.id,
				purpose: "COURIER_COLLECTION",
				method: "SINPE_MOVIL",
				expectedVersion: 0,
			});
			expect(
				(
					await refused(
						f.buyer.orders.submitPaymentProof({
							orderId: f.order.id,
							purpose: "COURIER_COLLECTION",
							mimeType: "image/png",
							base64: PNG,
							expectedVersion: 1,
						}),
					)
				).message,
			).toBe("payments.refusal.reusedProof");
			const second = await f.buyer.orders.submitPaymentProof({
				orderId: f.order.id,
				purpose: "COURIER_COLLECTION",
				mimeType: "image/png",
				base64: SECOND_PNG,
				expectedVersion: 1,
			});
			const transfer = requireValue(
				second.payments.find((p) => p.purpose === "COURIER_COLLECTION"),
			);
			expect(transfer).toMatchObject({
				amountMinor: 850,
				status: "AWAITING_VERIFICATION",
				payeeName: "Titular repartidor",
				sinpePhone: "+50688882222",
			});
			expect(
				(
					await refused(
						f.merchant.orders.paymentProof({
							orderId: f.order.id,
							purpose: "COURIER_COLLECTION",
						}),
					)
				).code,
			).toBe("NOT_FOUND");
			expect(
				(
					await refused(
						f.merchant.orders.reviewPayment({
							orderId: f.order.id,
							purpose: "COURIER_COLLECTION",
							decision: "CONFIRM",
							expectedVersion: 2,
							proofId: requireValue(transfer.proofId),
						}),
					)
				).code,
			).toBe("FORBIDDEN");
			await f.courier.orders.reviewPayment({
				orderId: f.order.id,
				purpose: "COURIER_COLLECTION",
				decision: "CONFIRM",
				expectedVersion: 2,
				proofId: requireValue(transfer.proofId),
			});
			expect(
				(await f.buyer.orders.byId({ id: f.order.id })).paymentStatus,
			).toBe("PAID");
		} finally {
			f.w.close();
		}
	});
	test("merchant-funded delivery keeps the customer charge zero and a separate merchant debt to the courier", async () => {
		const f = await setup("CASH", true);
		try {
			const result = await f.buyer.orders.payments({ orderId: f.order.id });
			expect(result).toMatchObject({
				customerTotalMinor: 2500,
				courierChargeMinor: 0,
				courierEarningsMinor: 850,
			});
			expect(
				result.payments.find((p) => p.purpose === "COURIER_COLLECTION")
					?.amountMinor,
			).toBe(2500);
			expect(
				result.payments.find((p) => p.purpose === "MERCHANT_DELIVERY"),
			).toMatchObject({
				payer: "MERCHANT",
				payee: "COURIER",
				amountMinor: 850,
			});
		} finally {
			f.w.close();
		}
	});
	test("accounts are scoped; strangers cannot see receipts or approve payments", async () => {
		const f = await setup();
		try {
			const stranger = await seedUser(f.w.db, { id: "usr_pay_stranger" });
			const caller = appRouter.createCaller(await authed(f.w, stranger));
			expect(
				(
					await refused(
						caller.orders.paymentAccount({ businessId: f.businessId }),
					)
				).code,
			).toBe("NOT_FOUND");
			expect(
				(await refused(caller.orders.payments({ orderId: f.order.id }))).code,
			).toBe("NOT_FOUND");
			expect(
				(
					await refused(
						caller.orders.reviewPayment({
							orderId: f.order.id,
							purpose: "MERCHANT_ORDER",
							decision: "CONFIRM",
							expectedVersion: 0,
						}),
					)
				).code,
			).toBe("NOT_FOUND");
			const [stored] = await f.w.db
				.select()
				.from(orderTable)
				.where(eq(orderTable.id, f.order.id));
			expect(stored?.paymentFlowVersion).toBe(1);
		} finally {
			f.w.close();
		}
	});
	test("duplicate uploads and concurrent confirmations retain one receipt and one financial confirmation", async () => {
		const f = await setup("SINPE_MOVIL");
		try {
			const input = {
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER" as const,
				mimeType: "image/png" as const,
				base64: PNG,
				expectedVersion: 0,
			};
			const first = await f.buyer.orders.submitPaymentProof(input);
			await f.buyer.orders.submitPaymentProof(input);
			expect(
				f.w.sqlite.query("SELECT id FROM order_payment_proof").all(),
			).toHaveLength(1);
			const proofId = requireValue(
				requireValue(first.payments.find((p) => p.purpose === "MERCHANT_ORDER"))
					.proofId,
			);
			const review = {
				orderId: f.order.id,
				purpose: "MERCHANT_ORDER" as const,
				decision: "CONFIRM" as const,
				expectedVersion: 1,
				proofId,
			};
			await Promise.allSettled([
				f.merchant.orders.reviewPayment(review),
				f.merchant.orders.reviewPayment(review),
			]);
			expect(
				f.w.sqlite
					.query("SELECT id FROM audit_log WHERE action='payment.confirm'")
					.all(),
			).toHaveLength(1);
		} finally {
			f.w.close();
		}
	});
});
