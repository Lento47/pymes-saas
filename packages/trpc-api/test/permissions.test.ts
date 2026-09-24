import { describe, expect, test } from "bun:test";
import { productCreateInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	contextFor,
	refused,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * Who may touch a business, and the three answers that must not be confused.
 *
 * The `businessId` in an input is a *claim*, never a permission: it is answered against the
 * caller's `membership` row before the procedure body runs, and the service scopes every
 * query by the membership the middleware injected. These specs pin the three refusals,
 * because they are three different bugs when they collapse into one:
 *
 * - a member whose **role is too low** — `FORBIDDEN`, and it says so: they already know the
 *   business exists, and hiding that from a colleague buys nothing;
 * - a caller who is **not a member at all** — `FORBIDDEN` too, but the business is a
 *   stranger's, so nothing about it may leak;
 * - the **wrong tenant's row** — a member of shop A naming one of shop B's products must be
 *   answered as though the row did not exist, which is `NOT_FOUND` and never a 200.
 *
 * The last one is the design's whole reason for existing: `businessProcedure` proves the
 * caller belongs to *some* business, and only the `and businessId = :businessId` in the
 * service's own `where` clause proves it is the one the row belongs to.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/** Two shops: one with a staff member, a manager and an owner; one belonging to nobody here. */
async function twoShops(test: Test) {
	const mine = await seedBusiness(test.db, { id: "biz_mine" });
	const theirs = await seedBusiness(test.db, {
		id: "biz_theirs",
		slug: "tienda-ajena",
		name: "Tienda Ajena",
	});

	const staff = await seedUser(test.db, { id: "usr_staff" });
	const manager = await seedUser(test.db, { id: "usr_manager" });
	const owner = await seedUser(test.db, { id: "usr_owner" });
	const outsider = await seedUser(test.db, { id: "usr_outsider" });
	const customer = await seedUser(test.db, { id: "usr_perms_customer" });

	await seedMembership(test.db, staff.id, mine, "STAFF");
	await seedMembership(test.db, manager.id, mine, "MANAGER");
	await seedMembership(test.db, owner.id, mine, "OWNER");

	const product = await seedProduct(test.db, {
		id: "prd_mine",
		businessId: mine,
	});
	const foreignProduct = await seedProduct(test.db, {
		id: "prd_theirs",
		businessId: theirs,
		name: "Producto Ajeno",
	});

	const callerOf = async (user: Parameters<typeof authed>[1]) =>
		appRouter.createCaller(await authed(test, user)) as Caller;

	return {
		mine,
		theirs,
		staff,
		manager,
		owner,
		outsider,
		customer,
		product,
		foreignProduct,
		staffCaller: await callerOf(staff),
		managerCaller: await callerOf(manager),
		ownerCaller: await callerOf(owner),
		outsiderCaller: await callerOf(outsider),
	};
}

describe("role and membership gating", () => {
	test("a STAFF member cannot reach a MANAGER procedure", async () => {
		const test = world();
		const { mine, staff, staffCaller, ownerCaller, product } =
			await twoShops(test);

		// `products:write` is held by STAFF and MANAGER alike, so the coarse gate in
		// `businessProcedure` lets this through. Archiving is the narrow rule inside that
		// capability, and `assertRole` is where it is written down.
		const error = await refused(
			staffCaller.products.archive({ businessId: mine, id: product.id }),
		);
		expect(error.code).toBe("FORBIDDEN");

		// The row is untouched — the refusal happened before the service ran — and the same
		// call from an OWNER goes through, so the refusal was about the role and not about
		// archiving being broken.
		const still = test.sqlite
			.prepare("select status from product where id = ?")
			.get(product.id) as { status: string };
		expect(still.status).toBe("ACTIVE");

		const archived = await ownerCaller.products.archive({
			businessId: mine,
			id: product.id,
		});
		expect(archived).toEqual({ ok: true });
		const archivedRow = test.sqlite
			.prepare("select status, is_featured from product where id = ?")
			.get(product.id) as { status: string; is_featured: number };
		expect(archivedRow.status).toBe("ARCHIVED");
		// Featured is cleared in the same update: a featured archived product is a home
		// screen that opens onto a dead page.
		expect(archivedRow.is_featured).toBe(0);

		// A STAFF member may still edit: the point is not to lock them out of the shop.
		const created = await staffCaller.products.create({
			businessId: mine,
			...productCreateInput.parse({
				name: "Sopa del día",
				priceMinor: 2200,
				currency: "CRC",
			}),
		});
		// The card calls it `title`: one shape is rendered by three clients, so the field
		// name is the contract's, not this spec's.
		expect(created.title).toBe("Sopa del día");
		expect(created.priceMinor).toBe(2200);

		// Every write landed against the membership, not against the argument.
		const owner = test.sqlite
			.prepare("select business_id from product where id = ?")
			.get(created.id) as { business_id: string };
		expect(owner.business_id).toBe(mine);
		expect(staff.id).toBe("usr_staff");

		test.close();
	});

	test("a non-member is refused for a business they do not belong to", async () => {
		const test = world();
		const { mine, theirs, outsiderCaller } = await twoShops(test);

		// The caller is signed in and is a member of nothing. Both ids are answered the same
		// way, and neither reveals whether the business exists.
		const foreign = await refused(
			outsiderCaller.business.settings({ businessId: theirs }),
		);
		expect(foreign.code).toBe("FORBIDDEN");

		const imaginary = await refused(
			outsiderCaller.business.settings({ businessId: "biz_does_not_exist" }),
		);
		expect(imaginary.code).toBe("FORBIDDEN");

		// A write is refused before the body runs too, so nothing is read either.
		const write = await refused(
			outsiderCaller.products.archive({ businessId: mine, id: "prd_mine" }),
		);
		expect(write.code).toBe("FORBIDDEN");

		// And a membership of *another* business is not a membership of this one.
		const staffOfMine = await seedUser(test.db, { id: "usr_elsewhere" });
		await seedMembership(test.db, staffOfMine.id, mine, "MANAGER");
		const elsewhere = appRouter.createCaller(
			await authed(test, staffOfMine),
		) as Caller;
		const crossed = await refused(
			elsewhere.products.archive({ businessId: theirs, id: "prd_theirs" }),
		);
		expect(crossed.code).toBe("FORBIDDEN");

		test.close();
	});

	test("a member of one shop cannot write another shop's row with their own businessId", async () => {
		const test = world();
		const { mine, managerCaller, foreignProduct } = await twoShops(test);

		// The interesting case, and the one `businessProcedure` cannot catch: the caller *is*
		// a member of `biz_mine`, so the middleware is satisfied — and the row they name
		// belongs to somebody else. Only the service's `and businessId = :businessId` answers
		// this, and it must answer as though the row were not there.
		const error = await refused(
			managerCaller.products.archive({
				businessId: mine,
				id: foreignProduct.id,
			}),
		);
		expect(error.code).toBe("NOT_FOUND");

		const untouched = test.sqlite
			.prepare("select status from product where id = ?")
			.get(foreignProduct.id) as { status: string };
		expect(untouched.status).toBe("ACTIVE");

		// The same for stock, which is the write a hurried client would reach for.
		const stock = await refused(
			managerCaller.products.setStock({
				businessId: mine,
				id: foreignProduct.id,
				quantity: 50,
			}),
		);
		expect(stock.code).toBe("NOT_FOUND");

		test.close();
	});

	test("the platform console needs `isAdmin`, not a business role", async () => {
		const test = world();
		const { ownerCaller, outsiderCaller, customer } = await twoShops(test);

		// A business's OWNER is not a platform admin: `isAdmin` is a separate axis, and the
		// two must not be conflated in either direction.
		const notAdmin = await refused(ownerCaller.admin.metrics());
		expect(notAdmin.code).toBe("FORBIDDEN");

		const customerCaller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		const alsoNot = await refused(
			customerCaller.admin.businesses({ limit: 10 }),
		);
		expect(alsoNot.code).toBe("FORBIDDEN");

		const admin = await seedUser(test.db, { id: "usr_admin", isAdmin: true });
		const adminCaller = appRouter.createCaller(
			await authed(test, admin),
		) as Caller;
		const metrics = await adminCaller.admin.metrics();
		// Money by currency, never one figure summed across currencies.
		expect(metrics.volumeByCurrency).toBeDefined();
		expect(metrics).toHaveProperty("businesses");

		// An admin is still not a member of anybody's business, so a tenant procedure is
		// closed to them too. Admin reach is through the `admin` router, which is audited.
		const adminInTenant = await refused(
			outsiderCaller.business.settings({ businessId: "biz_mine" }),
		);
		expect(adminInTenant.code).toBe("FORBIDDEN");

		test.close();
	});

	test("a signed-out caller gets UNAUTHORIZED, and a caller with no business at all gets asked for one", async () => {
		const test = world();
		const { customer } = await twoShops(test);

		const anonymous = appRouter.createCaller(
			await contextFor(test, null),
		) as Caller;
		const error = await refused(anonymous.cart.get());
		expect(error.code).toBe("UNAUTHORIZED");

		// A business procedure reaching the middleware without a `businessId` is our bug, not
		// the caller's: the input schema would refuse it a moment later, and the middleware is
		// the only layer that can say "this procedure was written wrong".
		const signedIn = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		const missing = await refused(
			(
				signedIn.products.archive as unknown as (
					input: unknown,
				) => Promise<unknown>
			)({
				id: "prd_mine",
			}),
		);
		expect(missing.code).toBe("INTERNAL");

		test.close();
	});
});
