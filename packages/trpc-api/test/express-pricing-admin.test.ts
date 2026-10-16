import { describe, expect, test } from "bun:test";
import {
	deliveryPricingPolicy,
	deliveryQuote,
	merchantLocation,
	order,
	user,
} from "@pymeshub/db";
import {
	DEFAULT_DELIVERY_PRICING_TERMS,
	deliveryPricingTermsSchema,
	PLANS,
} from "@pymeshub/shared";
import { eq } from "drizzle-orm";
import { requireAuthed } from "../src/context";
import { appRouter } from "../src/routers";
import { canSetDeliveryFee } from "../src/services/delivery-policy";
import {
	priceBreakdown,
	routeFeeMinor,
} from "../src/services/delivery-pricing";
import { activeDeliveryPricing } from "../src/services/delivery-pricing-admin";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

type World = ReturnType<typeof world>;
const reason = "Ajuste de tarifa aprobado para el piloto";
const terms = DEFAULT_DELIVERY_PRICING_TERMS;

async function pricingAdmin(w: World) {
	const actor = await seedUser(w.db, {
		id: "usr_pricing_admin",
		isAdmin: true,
	});
	await w.db
		.update(user)
		.set({ canManagePricing: true })
		.where(eq(user.id, actor.id));
	const ctx = requireAuthed(await authed(w, actor));
	return { ctx, caller: appRouter.createCaller(ctx) };
}
async function checkout(w: World) {
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
								[-84.07, 9.94],
							],
						},
					},
				],
			}),
	} as unknown as Fetcher;
	const businessId = await seedBusiness(w.db);
	await w.db
		.update(merchantLocation)
		.set({ lat: 9.93, lng: -84.08 })
		.where(eq(merchantLocation.businessId, businessId));
	const product = await seedProduct(w.db, { businessId });
	const customer = await seedUser(w.db, { id: "usr_pricing_customer" });
	const caller = appRouter.createCaller(await authed(w, customer));
	await caller.cart.addItem({ productId: product.id, quantity: 1 });
	const address = await caller.users.saveAddress({
		label: "Casa",
		line1: "Portón azul",
		city: "San José",
		region: "San José",
		lat: 9.94,
		lng: -84.07,
	});
	return {
		caller,
		customer,
		businessId,
		input: {
			fulfilment: "DELIVERY" as const,
			locationId: `loc_${businessId}`,
			addressId: address.id,
		},
	};
}

describe("central Express pricing", () => {
	test("the four documented examples use one rounding and preserve the courier's merchant-funded pay", () => {
		for (const [km, minutes, fee] of [
			[2, 6, 1580],
			[4, 12, 2310],
			[8, 20, 3590],
			[12, 35, 5185],
		] as const) {
			expect(routeFeeMinor(km * 1000, minutes * 60)).toBe(fee);
			expect(
				priceBreakdown({
					terms,
					policyVersion: "v1",
					distanceMeters: km * 1000,
					durationSeconds: minutes * 60,
					merchantCoversDelivery: true,
				}),
			).toMatchObject({
				roadFeeCRC: fee,
				customerFeeCRC: 0,
				courierPayoutCRC: fee,
				fundingSource: "MERCHANT",
				fundedCRC: fee,
				nearbyDiscountCRC: 0,
				readyDiscountCRC: 0,
				topUpCRC: 0,
			});
		}
		expect(routeFeeMinor(1234, 67, terms)).toBe(1184);
	});
	test("incentives cannot be enabled before funding and anti-abuse support exist", () => {
		for (const patch of [
			{ nearbyDiscountEnabled: true },
			{ readyBenefitEnabled: true },
			{ dynamicTopUpEnabled: true },
			{ maxTopUpCRC: 1 },
			{ nearbyMaxPct: 11 },
			{ readyMaxPct: 6 },
			{ combinedMaxPct: 16 },
			{ nearbyMaxEtaSeconds: 181 },
			{ baseCRC: -1 },
			{ baseCRC: 0 },
			{ perKmCRC: 1.5 },
			{ perEstimatedMinuteCRC: Infinity },
			{ arbitraryCode: "alert()" },
		])
			expect(
				deliveryPricingTermsSchema.safeParse({ ...terms, ...patch }).success,
			).toBe(false);
	});
	test("customers, couriers, merchants and general admins cannot manage pricing", async () => {
		const w = world();
		try {
			const businessId = await seedBusiness(w.db);
			for (const role of ["CUSTOMER", "OWNER", "COURIER", "ADMIN"] as const) {
				const actor = await seedUser(w.db, {
					id: `usr_price_${role}`,
					isAdmin: role === "ADMIN",
				});
				if (role === "OWNER" || role === "COURIER")
					await seedMembership(w.db, actor.id, businessId, role);
				const caller = appRouter.createCaller(await authed(w, actor));
				expect(
					(
						await refused(
							caller.admin.savePricingPolicyDraft({
								terms,
								expectedVersion: "express-v1",
								reason,
							}),
						)
					).code,
				).toBe("FORBIDDEN");
				expect(
					(
						await refused(
							caller.admin.updatePricingPolicy({
								draftId: "dpp_unknown",
								expectedVersion: "express-v1",
								reason,
							}),
						)
					).code,
				).toBe("FORBIDDEN");
				expect(
					(
						await refused(
							caller.admin.simulatePricingPolicy({
								terms,
								distanceMeters: 4000,
								durationSeconds: 720,
							}),
						)
					).code,
				).toBe("FORBIDDEN");
				if (role === "ADMIN")
					expect((await caller.admin.pricingPolicy()).canManage).toBe(false);
			}
		} finally {
			w.close();
		}
	});
	test("drafts do not change checkout; publication is versioned, audited, and immutable", async () => {
		const w = world();
		try {
			const { ctx, caller } = await pricingAdmin(w);
			const draft = await caller.admin.savePricingPolicyDraft({
				terms: { ...terms, baseCRC: 950 },
				expectedVersion: "express-v1",
				reason,
			});
			expect((await activeDeliveryPricing(ctx)).terms.baseCRC).toBe(850);
			const simulation = await caller.admin.simulatePricingPolicy({
				terms: draft.terms,
				distanceMeters: 4000,
				durationSeconds: 720,
			});
			expect(simulation).toMatchObject({
				customerFeeCRC: 2410,
				courierPayoutCRC: 2410,
				exceedsCap: false,
			});
			const published = await caller.admin.updatePricingPolicy({
				draftId: draft.id,
				expectedVersion: "express-v1",
				reason,
			});
			expect((await activeDeliveryPricing(ctx)).version).toBe(
				published.version,
			);
			expect(published.revision).toBe(1);
			expect(
				(
					await refused(
						caller.admin.updatePricingPolicy({
							draftId: draft.id,
							expectedVersion: "express-v1",
							reason,
						}),
					)
				).code,
			).toBe("CONFLICT");
			const entries = w.sqlite
				.query(
					"SELECT actor_user_id,meta FROM audit_log WHERE action='pricing.publish'",
				)
				.all() as { actor_user_id: string; meta: string }[];
			expect(entries).toHaveLength(1);
			expect(entries[0]?.actor_user_id).toBe(ctx.user.id);
			expect(JSON.parse(entries[0]?.meta ?? "{}")).toMatchObject({
				before: { version: "express-v1" },
				after: { version: published.version },
				reason,
			});
			await expect(
				w.db
					.update(deliveryPricingPolicy)
					.set({ terms })
					.where(eq(deliveryPricingPolicy.id, published.id))
					.execute(),
			).rejects.toThrow();
			await w.db
				.update(user)
				.set({ canManagePricing: false })
				.where(eq(user.id, ctx.user.id));
			expect(
				(
					await refused(
						caller.admin.savePricingPolicyDraft({
							terms,
							expectedVersion: published.version,
							reason,
						}),
					)
				).code,
			).toBe("FORBIDDEN");
		} finally {
			w.close();
		}
	});
	test("simultaneous publications have one winner and one audit record", async () => {
		const w = world();
		try {
			const { caller } = await pricingAdmin(w);
			const first = await caller.admin.savePricingPolicyDraft({
				terms,
				expectedVersion: "express-v1",
				reason,
			});
			const second = await caller.admin.savePricingPolicyDraft({
				terms: { ...terms, baseCRC: 900 },
				expectedVersion: "express-v1",
				reason,
			});
			const result = await Promise.allSettled(
				[first, second].map((draft) =>
					caller.admin.updatePricingPolicy({
						draftId: draft.id,
						expectedVersion: "express-v1",
						reason,
					}),
				),
			);
			expect(result.filter((row) => row.status === "fulfilled")).toHaveLength(
				1,
			);
			expect(
				w.sqlite
					.query("SELECT id FROM audit_log WHERE action='pricing.publish'")
					.all(),
			).toHaveLength(1);
			expect(
				w.sqlite
					.query("SELECT id FROM delivery_pricing_policy WHERE status='ACTIVE'")
					.all(),
			).toHaveLength(1);
		} finally {
			w.close();
		}
	});
	test("a future version leaves current pricing active until its scheduled time", async () => {
		const w = world();
		try {
			const { ctx, caller } = await pricingAdmin(w);
			const activeFrom = new Date(Date.now() + 3600000);
			const draft = await caller.admin.savePricingPolicyDraft({
				terms: { ...terms, baseCRC: 1000 },
				expectedVersion: "express-v1",
				reason,
				activeFrom,
			});
			await caller.admin.updatePricingPolicy({
				draftId: draft.id,
				expectedVersion: "express-v1",
				reason,
			});
			expect((await activeDeliveryPricing(ctx)).version).toBe("express-v1");
			expect((await activeDeliveryPricing(ctx, activeFrom)).version).toBe(
				draft.version,
			);
			expect(
				(
					await refused(
						caller.admin.savePricingPolicyDraft({
							terms,
							expectedVersion: draft.version,
							reason,
						}),
					)
				).code,
			).toBe("BAD_REQUEST");
		} finally {
			w.close();
		}
	});
	test("unexpired quotes survive a new policy; placed orders and retries preserve their financial snapshot", async () => {
		const w = world();
		try {
			const { caller: admin } = await pricingAdmin(w);
			const buyer = await checkout(w);
			const quoted = await buyer.caller.cart.quote(buyer.input);
			expect(quoted.deliveryFeeMinor).toBe(2310);
			const draft = await admin.admin.savePricingPolicyDraft({
				terms: { ...terms, baseCRC: 1000 },
				expectedVersion: "express-v1",
				reason,
			});
			await admin.admin.updatePricingPolicy({
				draftId: draft.id,
				expectedVersion: "express-v1",
				reason,
			});
			const cached = await buyer.caller.cart.quote(buyer.input);
			expect(cached.roadQuote?.quoteId).toBe(quoted.roadQuote?.quoteId);
			const input = {
				...buyer.input,
				quoteId: quoted.roadQuote?.quoteId,
				paymentMethod: "CASH" as const,
				clientRequestId: "express-policy-snapshot",
				expectedTotalMinor: quoted.totalMinor,
			};
			const placed = await buyer.caller.orders.place(input);
			const repeated = await buyer.caller.orders.place(input);
			expect(repeated.id).toBe(placed.id);
			const [stored] = await w.db
				.select()
				.from(order)
				.where(eq(order.id, placed.id));
			expect(stored).toMatchObject({
				deliveryFeeMinor: 2310,
				courierFeeMinor: 2310,
				deliveryPricingVersion: "express-v1",
				deliveryPricingSnapshot: {
					policyVersion: "express-v1",
					courierPayoutCRC: 2310,
					customerFeeCRC: 2310,
				},
			});
			expect(
				(await buyer.caller.orders.byId({ id: placed.id })).totals
					.deliveryFeeMinor,
			).toBe(2310);
		} finally {
			w.close();
		}
	});
	test("expired quotes require reconfirmation at the newly published price", async () => {
		const w = world();
		try {
			const { caller: admin } = await pricingAdmin(w);
			const buyer = await checkout(w);
			const quoted = await buyer.caller.cart.quote(buyer.input);
			const draft = await admin.admin.savePricingPolicyDraft({
				terms: { ...terms, baseCRC: 1000 },
				expectedVersion: "express-v1",
				reason,
			});
			await admin.admin.updatePricingPolicy({
				draftId: draft.id,
				expectedVersion: "express-v1",
				reason,
			});
			await w.db
				.update(deliveryQuote)
				.set({ expiresAt: new Date(Date.now() - 1) })
				.where(eq(deliveryQuote.id, quoted.roadQuote?.quoteId ?? ""));
			expect(
				(
					await refused(
						buyer.caller.orders.place({
							...buyer.input,
							quoteId: quoted.roadQuote?.quoteId,
							paymentMethod: "CASH",
							clientRequestId: "expired-policy-quote",
							expectedTotalMinor: quoted.totalMinor,
						}),
					)
				).message,
			).toBe("checkout.refusal.totalChanged");
			const fresh = await buyer.caller.cart.quote(buyer.input);
			expect(fresh.deliveryFeeMinor).toBe(2460);
			expect(fresh.roadQuote?.pricingBreakdown?.policyVersion).toBe(
				draft.version,
			);
		} finally {
			w.close();
		}
	});
	test("a price cap refuses an unfunded route rather than lowering courier pay", async () => {
		const w = world();
		try {
			const { caller: admin } = await pricingAdmin(w);
			const draft = await admin.admin.savePricingPolicyDraft({
				terms: { ...terms, customerPriceCapCRC: 1000 },
				expectedVersion: "express-v1",
				reason,
			});
			await admin.admin.updatePricingPolicy({
				draftId: draft.id,
				expectedVersion: "express-v1",
				reason,
			});
			const buyer = await checkout(w);
			expect(
				(await refused(buyer.caller.cart.quote(buyer.input))).message,
			).toBe("checkout.refusal.deliveryQuoteUnavailable");
			expect(
				w.sqlite.query("SELECT id FROM delivery_quote").all(),
			).toHaveLength(0);
		} finally {
			w.close();
		}
	});
	test("only Business, with an active accepted courier, can set a manual delivery fee", async () => {
		const w = world();
		try {
			const courier = await seedUser(w.db, { id: "usr_fee_courier" });
			for (const plan of PLANS) {
				const businessId = await seedBusiness(w.db, {
					id: `biz_fee_${plan}`,
					plan,
				});
				await seedMembership(w.db, courier.id, businessId, "COURIER");
				expect(await canSetDeliveryFee(w.db, businessId)).toBe(
					plan === "BUSINESS",
				);
			}
		} finally {
			w.close();
		}
	});
});
