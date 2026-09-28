import { describe, expect, test } from "bun:test";
import {
	address as addressTable,
	devicePushToken as tokenTable,
	user as userTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { sweepAccountDeletions } from "../src/services/account-deletion";
import {
	authed,
	refused,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

describe("account deletion", () => {
	test("a scheduled request is visible and cancellable", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_delete_cancel" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		const requested = await caller.users.requestDeletion();
		expect(requested.status).toBe("SCHEDULED");
		expect(await caller.users.deletionStatus()).not.toBeNull();
		await caller.users.cancelDeletion();
		expect(await caller.users.deletionStatus()).toBeNull();

		test.close();
	});

	test("the last owner must transfer the business first", async () => {
		const test = world();
		const owner = await seedUser(test.db, { id: "usr_delete_owner" });
		const businessId = await seedBusiness(test.db, { id: "biz_delete_owner" });
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(test, owner)) as Caller;

		const error = await refused(caller.users.requestDeletion());
		expect(error.code).toBe("CONFLICT");

		test.close();
	});

	test("the due sweep removes private rows and anonymizes the retained identity", async () => {
		const test = world();
		const user = await seedUser(test.db, {
			id: "usr_delete_due",
			name: "Persona Privada",
			email: "private@example.test",
			phone: "+50688888888",
		});
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;
		await test.db.insert(addressTable).values({
			id: "adr_delete_due",
			userId: user.id,
			line1: "Calle privada",
			city: "San José",
			country: "CR",
		});
		await caller.devices.register({
			token: "ExpoPushToken[test_delete_due]",
			platform: "android",
		});
		await caller.users.requestDeletion();
		test.sqlite
			.prepare(
				'update "account_deletion_request" set "scheduled_for" = 0 where "user_id" = ?',
			)
			.run(user.id);

		const swept = await sweepAccountDeletions(test.db, new Date());
		expect(swept.completed).toBe(1);

		const [retained] = await test.db
			.select()
			.from(userTable)
			.where(eq(userTable.id, user.id));
		expect(retained?.name).toBe("Cuenta eliminada");
		expect(retained?.email).toBe("usr_delete_due@deleted.pymeshub.invalid");
		expect(retained?.phone).toBeNull();
		expect(
			await test.db
				.select()
				.from(addressTable)
				.where(eq(addressTable.userId, user.id)),
		).toHaveLength(0);
		expect(
			await test.db
				.select()
				.from(tokenTable)
				.where(eq(tokenTable.userId, user.id)),
		).toHaveLength(0);

		test.close();
	});
});
