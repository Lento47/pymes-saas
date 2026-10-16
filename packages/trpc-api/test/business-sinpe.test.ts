import { describe, expect, test } from "bun:test";
import { business } from "@pymeshub/db";
import { eq } from "drizzle-orm";
import { appRouter } from "../src/routers";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

async function fixture() {
	const w = world();
	const businessId = await seedBusiness(w.db);
	const owner = await seedUser(w.db, { id: "usr_sinpe_settings_owner" });
	await seedMembership(w.db, owner.id, businessId, "OWNER");
	const caller = appRouter.createCaller(await authed(w, owner));
	return { w, businessId, caller };
}

describe("merchant contact phone for SINPE", () => {
	test("one save configures contact and SINPE, later edits reuse the number, omission preserves and explicit disable removes", async () => {
		const { w, businessId, caller } = await fixture();
		try {
			await caller.business.update({
				businessId,
				phone: "8888-1111",
				sinpeAccount: { recipientName: "Titular banco" },
			});
			expect((await caller.business.settings({ businessId })).phone).toBe(
				"88881111",
			);
			expect(
				(await caller.orders.paymentAccount({ businessId })).account,
			).toEqual({ phone: "+50688881111", recipientName: "Titular banco" });
			await caller.business.update({
				businessId,
				phone: "+50688882222",
				sinpeAccount: { recipientName: "Titular banco" },
			});
			expect(
				(await caller.orders.paymentAccount({ businessId })).account?.phone,
			).toBe("+50688882222");
			await caller.business.update({ businessId, name: "Nombre nuevo" });
			expect(
				(await caller.orders.paymentAccount({ businessId })).account?.phone,
			).toBe("+50688882222");
			await caller.business.update({
				businessId,
				sinpeAccount: { recipientName: "Otro titular" },
			});
			expect(
				(await caller.orders.paymentAccount({ businessId })).account
					?.recipientName,
			).toBe("Otro titular");
			await caller.business.update({ businessId, sinpeAccount: null });
			expect(
				(await caller.orders.paymentAccount({ businessId })).account,
			).toBeNull();
			expect((await caller.business.settings({ businessId })).phone).toBe(
				"+50688882222",
			);
		} finally {
			w.close();
		}
	});
	test("invalid SINPE telephone refuses the whole edit and leaves the old account intact", async () => {
		const { w, businessId, caller } = await fixture();
		try {
			await caller.business.update({
				businessId,
				phone: "88881111",
				sinpeAccount: { recipientName: "Titular banco" },
			});
			const error = await refused(
				caller.business.update({
					businessId,
					name: "Must not save",
					phone: "+15551234567",
					sinpeAccount: { recipientName: "Titular banco" },
				}),
			);
			expect(error.message).toBe("payments.accountInvalid");
			expect((await caller.business.settings({ businessId })).name).not.toBe(
				"Must not save",
			);
			expect(
				(await caller.orders.paymentAccount({ businessId })).account?.phone,
			).toBe("+50688881111");
		} finally {
			w.close();
		}
	});
	test("database failure rolls back both phone and payment-account changes", async () => {
		const { w, businessId, caller } = await fixture();
		try {
			await w.db
				.update(business)
				.set({ phone: "88881111" })
				.where(eq(business.id, businessId));
			w.sqlite.exec(
				"CREATE TRIGGER fail_sinpe_insert BEFORE INSERT ON payment_account BEGIN SELECT RAISE(ABORT, 'forced account failure'); END",
			);
			await expect(
				caller.business.update({
					businessId,
					phone: "88882222",
					sinpeAccount: { recipientName: "Titular banco" },
				}),
			).rejects.toThrow("forced account failure");
			expect((await caller.business.settings({ businessId })).phone).toBe(
				"88881111",
			);
			expect(
				(await caller.orders.paymentAccount({ businessId })).account,
			).toBeNull();
			expect(
				w.sqlite
					.query("SELECT id FROM audit_log WHERE action='payment.account'")
					.all(),
			).toHaveLength(0);
		} finally {
			w.close();
		}
	});
	test("staff and other businesses cannot change the merchant's SINPE account; managers can", async () => {
		const { w, businessId, caller } = await fixture();
		try {
			const staff = await seedUser(w.db, { id: "usr_sinpe_settings_staff" });
			await seedMembership(w.db, staff.id, businessId, "STAFF");
			const staffApi = appRouter.createCaller(await authed(w, staff));
			expect(
				(
					await refused(
						staffApi.business.update({
							businessId,
							phone: "88881111",
							sinpeAccount: { recipientName: "Titular banco" },
						}),
					)
				).code,
			).toBe("FORBIDDEN");
			const other = await seedBusiness(w.db, {
				id: "biz_sinpe_other",
				slug: "sinpe-other",
			});
			await refused(
				caller.business.update({
					businessId: other,
					phone: "88881111",
					sinpeAccount: { recipientName: "Titular banco" },
				}),
			);
			const manager = await seedUser(w.db, {
				id: "usr_sinpe_settings_manager",
			});
			await seedMembership(w.db, manager.id, businessId, "MANAGER");
			const managerApi = appRouter.createCaller(await authed(w, manager));
			await managerApi.business.update({
				businessId,
				phone: "88881111",
				sinpeAccount: { recipientName: "Titular banco" },
			});
			expect(
				(await caller.orders.paymentAccount({ businessId })).account?.phone,
			).toBe("+50688881111");
		} finally {
			w.close();
		}
	});
});
