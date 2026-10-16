import { expect, test } from "bun:test";
import { business, membership } from "@pymeshub/db";
import { eq } from "drizzle-orm";
import { appRouter } from "../src/routers";
import {
	canSetDeliveryFee,
	usesExpressCalculator,
} from "../src/services/delivery-policy";
import { roadFeeEnabled } from "../src/services/delivery-quote";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

test("Express is the default; only Business with an accepted courier may agree a fee", async () => {
	const fixture = world();
	try {
		delete fixture.env.ROUTE_FEE_ENABLED;
		expect(roadFeeEnabled(fixture.env, "CRC")).toBe(true);
		const businessId = await seedBusiness(fixture.db, { plan: "FREE" });
		const owner = await seedUser(fixture.db, {
			id: "usr_delivery_policy_owner",
		});
		await seedMembership(fixture.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(fixture, owner));
		const update = {
			businessId,
			deliveryPricingMode: "AFFILIATED" as const,
			deliveryFeeMinor: 1500,
		};
		await expect(caller.business.update(update)).rejects.toThrow();
		await fixture.db
			.update(business)
			.set({ plan: "BUSINESS" })
			.where(eq(business.id, businessId));
		expect(await canSetDeliveryFee(fixture.db, businessId)).toBe(false);
		await expect(caller.business.update(update)).rejects.toThrow();
		const courier = await seedUser(fixture.db, {
			id: "usr_delivery_policy_courier",
		});
		await seedMembership(fixture.db, courier.id, businessId, "COURIER");
		await fixture.db
			.update(membership)
			.set({ status: "PENDING_USER_ACCEPTANCE" })
			.where(eq(membership.userId, courier.id));
		expect(await canSetDeliveryFee(fixture.db, businessId)).toBe(false);
		await fixture.db
			.update(membership)
			.set({ status: "ACTIVE" })
			.where(eq(membership.userId, courier.id));
		const freshCaller = appRouter.createCaller(await authed(fixture, owner));
		const settings = await freshCaller.business.update(update);
		expect(settings.deliveryPricingMode).toBe("AFFILIATED");
		expect(settings.canSetDeliveryFee).toBe(true);
		expect(
			await usesExpressCalculator(fixture.db, {
				id: businessId,
				deliveryPricingMode: "AFFILIATED",
			}),
		).toBe(false);
		await fixture.db
			.update(membership)
			.set({ status: "REVOKED" })
			.where(eq(membership.userId, courier.id));
		expect(
			await usesExpressCalculator(fixture.db, {
				id: businessId,
				deliveryPricingMode: "AFFILIATED",
			}),
		).toBe(true);
	} finally {
		fixture.close();
	}
});
