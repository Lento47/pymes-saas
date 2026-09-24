import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import {
	authed,
	contextFor,
	seedBusiness,
	seedCategory,
	seedMembership,
	seedProduct,
	seedReview,
	seedUser,
	world,
} from "./harness";

/**
 * The aggregates that read an **outer** row from inside a subquery.
 *
 * Every one of these is written `table.table.column` in the service — `admin`'s block of
 * scalar subqueries and `catalog.categories`' `productCount` — and the doubled name looks
 * like a typo a reader should tidy up. It is not, and this file is what says so.
 *
 * Drizzle renders an interpolated Column inside a `sql` template as its own bare name:
 * `${businessTable.id}` becomes `"id"`, with no table prefix, because the fragment is
 * opaque to the query builder. SQLite then resolves that name against the **innermost**
 * table of the subquery. Written the obvious way, `PRODUCT_COUNT_SQL` compared
 * `product.business_id = product.id` — false for every row — and the console reported
 * **0 products for every business on the platform** while D1 held them. `catalog.categories`
 * had the same shape and put "0 productos" on every tile of the app's category grid, over
 * a stocked catalogue. Two fragments were worse still: `OWNER_NAME_SQL`'s inner join puts
 * `"id"` in a scope holding both `membership` and `user`, and SQLite refuses that outright
 * with `ambiguous column name: id` rather than answering.
 *
 * The counts alone would catch it, but each assertion here is chosen so the *buggy* value
 * cannot pass by accident: every count asserted is non-zero and every pair asserted is
 * distinct, because the broken form returned a uniform 0 and a spec that asked for
 * "0 products" would have gone green on the defect it was written for.
 *
 * Nothing here pins the doubling itself — no test can see a service's private string. It
 * pins the behaviour the doubling buys, which is the part a future cleanup would break.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const anonymous = async (test: Test): Promise<Caller> =>
	appRouter.createCaller(await contextFor(test, null)) as Caller;

describe("aggregates that read their outer row", () => {
	test("catalog.categories counts each category's own products, and not zero", async () => {
		const test = world();
		const drinks = await seedCategory(test.db, "cat_drinks");
		const bread = await seedCategory(test.db, "cat_bread");
		const shop = await seedBusiness(test.db);

		await seedProduct(test.db, {
			id: "prd_scope_a",
			businessId: shop,
			categoryId: drinks,
		});
		await seedProduct(test.db, {
			id: "prd_scope_b",
			businessId: shop,
			categoryId: drinks,
		});
		await seedProduct(test.db, {
			id: "prd_scope_c",
			businessId: shop,
			categoryId: bread,
		});

		const rows = await (await anonymous(test)).catalog.categories();
		const counts = new Map(rows.map((row) => [row.slug, row.productCount]));

		expect(counts.get(`categoria-${drinks}`)).toBe(2);
		expect(counts.get(`categoria-${bread}`)).toBe(1);
	});

	test("admin.businesses names the owner and counts what the shop holds", async () => {
		const test = world();
		const admin = await seedUser(test.db, {
			id: "usr_scope_admin",
			isAdmin: true,
		});
		const owner = await seedUser(test.db, {
			id: "usr_scope_owner",
			name: "Dueña de Prueba",
			email: "duena@example.test",
		});
		const shop = await seedBusiness(test.db, { id: "biz_scope_shop" });
		await seedMembership(test.db, owner.id, shop, "OWNER");

		await seedProduct(test.db, { id: "prd_scope_one", businessId: shop });
		await seedProduct(test.db, { id: "prd_scope_two", businessId: shop });

		// One order, worth 1500, placed by the review fixture — so the volume assertion is
		// a number the subquery had to read rather than a zero the defect would also give.
		const reviewer = await seedUser(test.db, { id: "usr_scope_reviewer" });
		await seedReview(test.db, {
			id: "rev_scope_one",
			businessId: shop,
			customerId: reviewer.id,
			rating: 4,
		});

		const page = await (
			await authed(test, admin).then((ctx) => appRouter.createCaller(ctx))
		).admin.businesses({});
		const row = page.rows.find((candidate) => candidate.id === shop);

		expect(row?.ownerName).toBe("Dueña de Prueba");
		expect(row?.ownerEmail).toBe("duena@example.test");
		expect(row?.productCount).toBe(2);
		expect(row?.orderCount).toBe(1);
		expect(row?.grossVolumeMinor).toBe(1500);
	});

	test("admin.users counts the orders placed against the customer's own id", async () => {
		const test = world();
		const admin = await seedUser(test.db, {
			id: "usr_scope_boss",
			isAdmin: true,
		});
		const buyer = await seedUser(test.db, { id: "usr_scope_buyer" });
		const other = await seedUser(test.db, { id: "usr_scope_other" });
		const shop = await seedBusiness(test.db, { id: "biz_scope_users" });

		await seedReview(test.db, {
			id: "rev_scope_buyer",
			businessId: shop,
			customerId: buyer.id,
		});
		await seedReview(test.db, {
			id: "rev_scope_other_one",
			businessId: shop,
			customerId: other.id,
		});
		await seedReview(test.db, {
			id: "rev_scope_other_two",
			businessId: shop,
			customerId: other.id,
		});

		const page = await (
			await authed(test, admin).then((ctx) => appRouter.createCaller(ctx))
		).admin.users({});
		const counts = new Map(
			page.rows.map((row) => [row.id, row.orderCount] as const),
		);

		expect(counts.get(buyer.id)).toBe(1);
		expect(counts.get(other.id)).toBe(2);
	});
});
