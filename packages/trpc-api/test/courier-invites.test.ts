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

	/**
	 * The courier is told.
	 *
	 * The client's `couriers.myInvites` has no poll interval on purpose — a board that re-reads
	 * its invitations every five seconds is a board that lies about being quiet — so the
	 * invitation has to announce itself the way an offer already does through
	 * `offerStatements`. These are the claims that announcement rests on: the row is written,
	 * it is addressed to the courier rather than to the shop, it survives the internal-kind
	 * filter, it deep-links, and a refused invitation rings nothing.
	 */
	describe("an invitation tells the courier", () => {
		async function invited(tag: string) {
			const test = world();
			const businessId = await seedBusiness(test.db, {
				id: `biz_invite_bell_${tag}`,
				name: "Soderia Bellavista",
			});
			const owner = await seedUser(test.db, {
				id: `usr_invite_bell_${tag}_owner`,
			});
			const courier = await seedUser(test.db, {
				id: `usr_invite_bell_${tag}_rider`,
			});
			await seedMembership(test.db, owner.id, businessId, "OWNER");
			const ownerCaller = appRouter.createCaller(
				await authed(test, owner),
			) as Caller;
			const courierCaller = appRouter.createCaller(
				await authed(test, courier),
			) as Caller;

			const profile = await courierCaller.couriers.saveProfile({
				displayName: "Bellavista Rider",
				serviceArea: "San José",
				isAvailable: true,
			});
			const admin = await seedUser(test.db, {
				id: `usr_invite_bell_${tag}_admin`,
				isAdmin: true,
			});
			await (
				appRouter.createCaller(await authed(test, admin)) as Caller
			).admin.reviewCourier({
				profileId: profile.id,
				decision: "VERIFIED",
			});

			return {
				test,
				businessId,
				courier,
				ownerCaller,
				courierCaller,
				profile,
			};
		}

		test("one row reaches the courier's own bell, addressed and deep-linked", async () => {
			const w = await invited("one");
			const invite = await w.ownerCaller.couriers.invite({
				businessId: w.businessId,
				profileId: w.profile.id,
			});

			// **Read through the bell, not the table.** The claim is that the courier sees it,
			// and `listNotifications` is what drops the internal kinds — so asking the table
			// would pass even for a `kind` the bell refuses to show.
			const bell = await w.courierCaller.notifications.list({ limit: 10 });
			expect(bell.items).toHaveLength(1);
			expect(bell.items[0]).toMatchObject({
				kind: "DELIVERY",
				title: "Nueva invitación de reparto",
				body: "Soderia Bellavista te invitó a repartir sus pedidos",
				data: {
					type: "COURIER_INVITED",
					inviteId: invite.id,
					businessId: w.businessId,
				},
				readAt: null,
			});

			// The shop is not told about its own invitation; it made it.
			expect(
				(await w.ownerCaller.notifications.list({ limit: 10 })).items,
			).toHaveLength(0);

			w.test.close();
		});

		test("the key is the invite id, and a refused second invite rings no bell", async () => {
			const w = await invited("key");
			const invite = await w.ownerCaller.couriers.invite({
				businessId: w.businessId,
				profileId: w.profile.id,
			});

			// **The invite id, not a timestamp.** The column's own docblock says a timestamped
			// key would make every row unique and the unique index would buy nothing; this is
			// the assertion that the key is the event.
			expect(
				w.test.sqlite
					.prepare("select dedupe_key from notification where user_id = ?")
					.all(w.courier.id),
			).toEqual([{ dedupe_key: `courier-invite:${invite.id}` }]);

			// **A live pending invitation refuses a second one**, so the bell cannot gain a row
			// for an invitation the courier will never be able to answer. A notification
			// written before the refusal — or the insert landing outside the transaction —
			// would leave a courier with two invitations in their list and one in the shop's.
			const again = await refused(
				w.ownerCaller.couriers.invite({
					businessId: w.businessId,
					profileId: w.profile.id,
				}),
			);
			expect(again.code).toBe("CONFLICT");
			expect(
				(await w.courierCaller.notifications.list({ limit: 10 })).items,
			).toHaveLength(1);

			w.test.close();
		});

		test("a refused invitation writes nothing", async () => {
			const w = await invited("refused");

			// No profile at all: `invite` is refused before it reaches the insert, and a
			// notification for an invitation that does not exist is the worst version of this
			// feature — a bell entry that opens an empty list.
			const error = await refused(
				w.ownerCaller.couriers.invite({
					businessId: w.businessId,
					profileId: "cpr_does_not_exist",
				}),
			);
			expect(error.code).toBe("NOT_FOUND");
			expect(
				(await w.courierCaller.notifications.list({ limit: 10 })).items,
			).toHaveLength(0);

			w.test.close();
		});
	});
});
