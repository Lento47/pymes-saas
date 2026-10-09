import { describe, expect, test } from "bun:test";
import { courierProfile } from "@pymeshub/db";
import { courierProfileInput } from "@pymeshub/shared";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { authed, seedUser, world } from "./harness";

/**
 * The courier's own profile: create, edit, and the review mark on both.
 *
 * The profile is an identity with no authority — it is read with
 * `protectedProcedure`, never a role gate, because the first profile is written
 * *before* any membership exists. What that means for the tests: they need a
 * plain signed-in user and nothing else, and the assertions that matter are
 * about the two states a review system lives on — `verificationStatus` and the
 * one edit that must not touch it.
 *
 * Four rules, each with the test that pins the abuse it prevents:
 *
 * 1. **No profile is `null`, not a default.** A courier who never filled the
 *    form must not appear to have one the platform never reviewed.
 * 2. **The vehicle round-trips.** Plate, name and photo path are the three
 *    facts a shop checks against a counter — a save that silently dropped one
 *    would show a real person's profile as incomplete.
 * 3. **A meaningful edit sends a reviewed profile back to PENDING.** Identity
 *    facts (name, area, bio, vehicle) are what a review checked; leaving them
 *    `VERIFIED` after they changed is a review that no longer describes the row.
 * 4. **Availability is the exception.** A courier turning off for the day must
 *    not wait for a reviewer to turn back on — the one edit that keeps the
 *    mark, which is what makes rule 3 an intentional rule and not a blanket
 *    reset.
 *
 * Rule 4 is also the one a "reset on every save" implementation would fail:
 * that version passes tests 2 and 3 and still strands every courier who
 * toggled availability overnight.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

function profileInput(
	overrides: Record<string, unknown> = {},
): ReturnType<typeof courierProfileInput.parse> {
	return courierProfileInput.parse({
		displayName: "Ana Entrega",
		serviceArea: "San José centro",
		bio: "Moto propia, trato amable.",
		vehicleName: "Honda PCX",
		vehiclePlate: "ABC 123",
		vehiclePhotoUrl: "/uploads/images/courier-vehicle/usr_demo/upl_demo.png",
		isAvailable: true,
		...overrides,
	});
}

describe("couriers.profile", () => {
	test("changing the operational zone keeps a verified profile approved", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_profile_zone" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;
		await caller.couriers.saveProfile(profileInput());
		await test.db
			.update(courierProfile)
			.set({ verificationStatus: "VERIFIED" })
			.where(eq(courierProfile.userId, user.id));
		const saved = await caller.couriers.saveZone({
			lat: 9.93,
			lng: -84.08,
			radiusKm: 15,
			label: "San José",
		});
		expect(saved.verificationStatus).toBe("VERIFIED");
		expect(saved.zoneRadiusKm).toBe(15);
		expect((await caller.couriers.profile())?.zoneLat).toBe(9.93);
		test.close();
	});
	test("a person who never filled the form has no profile at all", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_profile_none" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		// `null` and not an empty-but-present row: "has not been reviewed" and
		// "was never submitted" are different facts to the screen that draws the
		// pending card.
		expect(await caller.couriers.profile()).toBeNull();

		test.close();
	});

	test("the first save creates the profile with its vehicle, PENDING", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_profile_first" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;

		const saved = await caller.couriers.saveProfile(
			profileInput({ zone: { lat: 9.93, lng: -84.08, radiusKm: 15 } }),
		);

		expect(saved.verificationStatus).toBe("PENDING");
		expect(saved.displayName).toBe("Ana Entrega");
		expect(saved.serviceArea).toBe("San José centro");
		expect(saved.zoneLat).toBe(9.93);
		expect(saved.zoneRadiusKm).toBe(15);
		// The three vehicle facts, asserted by value: a save that dropped the
		// plate or the photo path would still return 200 and a happy screen.
		expect(saved.vehicleName).toBe("Honda PCX");
		expect(saved.vehiclePlate).toBe("ABC 123");
		expect(saved.vehiclePhotoUrl).toBe(
			"/uploads/images/courier-vehicle/usr_demo/upl_demo.png",
		);
		expect(saved.isAvailable).toBe(true);

		// And it is what the read returns — the write path and the read path are
		// separate service functions, so one passing without the other is real.
		const reread = await caller.couriers.profile();
		expect(reread).toEqual(saved);

		test.close();
	});

	test("a meaningful edit returns a reviewed profile to PENDING", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_profile_review" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;
		await caller.couriers.saveProfile(profileInput());

		// The review the service cannot perform itself: a platform reviewer
		// approved this row, which is exactly the state the next assertion needs.
		await test.db
			.update(courierProfile)
			.set({ verificationStatus: "VERIFIED" })
			.where(eq(courierProfile.userId, user.id));

		const before = await caller.couriers.profile();
		expect(before?.verificationStatus).toBe("VERIFIED");

		// A new plate — the identity fact a shop most needs the reviewer to have
		// checked. Everything else identical: the status must still fall.
		const after = await caller.couriers.saveProfile(
			profileInput({ vehiclePlate: "XYZ 789" }),
		);
		expect(after.verificationStatus).toBe("PENDING");
		expect(after.vehiclePlate).toBe("XYZ 789");

		test.close();
	});

	test("turning availability off and on keeps the review mark", async () => {
		const test = world();
		const user = await seedUser(test.db, { id: "usr_profile_toggle" });
		const caller = appRouter.createCaller(await authed(test, user)) as Caller;
		await caller.couriers.saveProfile(profileInput());

		await test.db
			.update(courierProfile)
			.set({ verificationStatus: "VERIFIED" })
			.where(eq(courierProfile.userId, user.id));

		// Off for the evening…
		const off = await caller.couriers.saveProfile(
			profileInput({ isAvailable: false }),
		);
		expect(off.isAvailable).toBe(false);
		expect(off.verificationStatus).toBe("VERIFIED");

		// …and back on, still reviewed. Every other field was resent unchanged,
		// so this also pins that *unchanged* identity facts do not reset the
		// mark: only a difference does.
		const on = await caller.couriers.saveProfile(
			profileInput({ isAvailable: true }),
		);
		expect(on.isAvailable).toBe(true);
		expect(on.verificationStatus).toBe("VERIFIED");

		test.close();
	});

	test("each profile is the signed-in person's own", async () => {
		const test = world();
		const ana = await seedUser(test.db, { id: "usr_profile_ana" });
		const bea = await seedUser(test.db, { id: "usr_profile_bea" });
		const anaCaller = appRouter.createCaller(await authed(test, ana)) as Caller;
		const beaCaller = appRouter.createCaller(await authed(test, bea)) as Caller;

		await anaCaller.couriers.saveProfile(profileInput());

		// No handle for another user's profile exists in the router at all, and
		// this is the read that would leak one if the service ever keyed off
		// anything but `ctx.user.id`.
		expect(await beaCaller.couriers.profile()).toBeNull();

		test.close();
	});
});
