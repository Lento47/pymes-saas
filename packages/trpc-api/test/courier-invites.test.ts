import { describe, expect, test } from "bun:test";

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

type Caller = ReturnType<typeof appRouter.createCaller>;

describe("in-app courier trust and invitations", () => {
	test("a profile is reviewed before a business can invite it", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, { id: "biz_courier_flow" });
		await seedProduct(test.db, {
			id: "prd_courier_flow",
			businessId,
			name: "Producto de prueba",
		});
		const owner = await seedUser(test.db, { id: "usr_courier_flow_owner" });
		const courier = await seedUser(test.db, {
			id: "usr_courier_flow_rider",
			name: "Rider Uno",
			email: "rider@example.test",
		});
		const admin = await seedUser(test.db, {
			id: "usr_courier_flow_admin",
			isAdmin: true,
		});
		await seedMembership(test.db, owner.id, businessId, "OWNER");

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const courierCaller = appRouter.createCaller(
			await authed(test, courier),
		) as Caller;
		const adminCaller = appRouter.createCaller(
			await authed(test, admin),
		) as Caller;

		const profile = await courierCaller.couriers.saveProfile({
			displayName: "Rider Uno",
			serviceArea: "San José",
			bio: "Bicicleta y Santiago.",
			isAvailable: true,
		});
		expect(profile.verificationStatus).toBe("PENDING");

		const hidden = await ownerCaller.couriers.directory({
			businessId,
			search: "Rider",
		});
		expect(hidden).toEqual([]);

		const reviewed = await adminCaller.admin.reviewCourier({
			profileId: profile.id,
			decision: "VERIFIED",
		});
		expect(reviewed.verificationStatus).toBe("VERIFIED");

		const detail = await adminCaller.admin.user({ id: courier.id });
		expect(detail.user.id).toBe(courier.id);
		expect(detail.courierProfile?.verificationStatus).toBe("VERIFIED");

		const products = await adminCaller.admin.products({
			search: "Producto",
			limit: 10,
		});
		expect(products.total).toBe(1);
		expect(products.rows[0]?.id).toBe("prd_courier_flow");
		expect((await adminCaller.admin.promotions({ limit: 10 })).total).toBe(0);
		expect((await adminCaller.admin.reviews({ limit: 10 })).total).toBe(0);

		const missingReason = await refused(
			adminCaller.admin.unpublishProduct({
				targetId: "prd_courier_flow",
			}),
		);
		expect(missingReason.code).toBe("BAD_REQUEST");

		const unpublished = await adminCaller.admin.unpublishProduct({
			targetId: "prd_courier_flow",
			reason: "Contenido inapropiado",
		});
		expect(unpublished).toEqual({ ok: true });
		expect(
			test.sqlite
				.prepare("select status from product where id = ?")
				.get("prd_courier_flow"),
		).toMatchObject({ status: "ARCHIVED" });

		const directory = await ownerCaller.couriers.directory({
			businessId,
			search: "Rider",
		});
		expect(directory).toHaveLength(1);
		expect(directory[0]).toMatchObject({
			profileId: profile.id,
			displayName: "Rider Uno",
			isVerified: true,
		});
		expect(directory[0]).not.toHaveProperty("email");

		const pendingList = await adminCaller.admin.courierProfiles({
			status: "PENDING",
			limit: 10,
		});
		expect(pendingList.total).toBe(0);

		const invite = await ownerCaller.couriers.invite({
			businessId,
			profileId: profile.id,
		});
		expect(invite.status).toBe("PENDING");

		const inviteList = await adminCaller.admin.courierInvites({ limit: 10 });
		expect(inviteList.total).toBe(1);
		expect(inviteList.rows[0]?.courierName).toBe("Rider Uno");
		expect(
			test.sqlite
				.prepare(
					"select role from membership where business_id = ? and user_id = ?",
				)
				.get(businessId, courier.id),
		).toBeNull();

		const accepted = await courierCaller.couriers.respond({
			inviteId: invite.id,
			response: "ACCEPTED",
		});
		expect(accepted.status).toBe("ACCEPTED");
		const me = await courierCaller.users.me();
		expect(me.memberships).toContainEqual({
			businessId,
			businessName: "Tienda de Prueba",
			businessSlug: "tienda-biz_courier_flow",
			logoUrl: null,
			role: "COURIER",
		});

		test.close();
	});

	test("the old email and role shortcuts cannot create a courier", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, { id: "biz_courier_abuse" });
		const owner = await seedUser(test.db, { id: "usr_courier_abuse_owner" });
		const staff = await seedUser(test.db, { id: "usr_courier_abuse_staff" });
		const rider = await seedUser(test.db, { id: "usr_courier_abuse_rider" });
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		await seedMembership(test.db, staff.id, businessId, "STAFF");
		await seedMembership(test.db, rider.id, businessId, "STAFF");

		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const staffCaller = appRouter.createCaller(
			await authed(test, staff),
		) as Caller;

		const direct = await refused(
			ownerCaller.business.inviteStaff({
				businessId,
				email: "rider@example.test",
				role: "COURIER",
			}),
		);
		expect(direct.code).toBe("BAD_REQUEST");

		const roleShortcut = await refused(
			ownerCaller.business.updateStaffRole({
				businessId,
				userId: rider.id,
				role: "COURIER",
			}),
		);
		expect(roleShortcut.code).toBe("BAD_REQUEST");

		const directory = await refused(
			staffCaller.couriers.directory({ businessId, search: "rider" }),
		);
		expect(directory.code).toBe("FORBIDDEN");

		test.close();
	});

	test("a courier can answer only their own invitation", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_courier_private",
		});
		const owner = await seedUser(test.db, { id: "usr_courier_private_owner" });
		const courier = await seedUser(test.db, {
			id: "usr_courier_private_rider",
		});
		const stranger = await seedUser(test.db, {
			id: "usr_courier_private_stranger",
		});
		await seedMembership(test.db, owner.id, businessId, "OWNER");
		const ownerCaller = appRouter.createCaller(
			await authed(test, owner),
		) as Caller;
		const courierCaller = appRouter.createCaller(
			await authed(test, courier),
		) as Caller;
		const strangerCaller = appRouter.createCaller(
			await authed(test, stranger),
		) as Caller;

		const profile = await courierCaller.couriers.saveProfile({
			displayName: "Private Rider",
			serviceArea: "Heredia",
			isAvailable: true,
		});
		const admin = await seedUser(test.db, {
			id: "usr_courier_private_admin",
			isAdmin: true,
		});
		const adminCaller = appRouter.createCaller(
			await authed(test, admin),
		) as Caller;
		await adminCaller.admin.reviewCourier({
			profileId: profile.id,
			decision: "VERIFIED",
		});
		const invite = await ownerCaller.couriers.invite({
			businessId,
			profileId: profile.id,
		});

		const error = await refused(
			strangerCaller.couriers.respond({
				inviteId: invite.id,
				response: "ACCEPTED",
			}),
		);
		expect(error.code).toBe("NOT_FOUND");

		test.close();
	});
});
