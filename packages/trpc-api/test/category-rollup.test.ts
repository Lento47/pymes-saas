import { describe, expect, test } from "bun:test";

import {
	business as businessTable,
	category as categoryTable,
} from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { seedBusiness, seedProduct, world } from "./harness";

/**
 * A sector means the categories under it, on both filtered lists.
 *
 * The taxonomy is two levels — a sector and the categories it holds — and a shop or a
 * product is filed under a *leaf*. Both `products.list` and `businesses.list` matched
 * `category_id` with an equality, which is true of no row at all when the customer taps a
 * sector: the home rail's "Alimentos y Bebidas" answered an empty list over a stocked
 * catalogue, and the only way to see it was to compare the count on the chip with the
 * screen behind it.
 *
 * `helpers.ts`'s `inCategory` is the fix and this file is what holds it: the equality is
 * still the first half — a leaf still matches itself — and the subquery is the second.
 * Two procedures, one rule, and a sector that holds nothing is still empty rather than
 * everything, which is the failure a rollup written as "drop the filter" would produce.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

async function caller(test: Test): Promise<Caller> {
	return appRouter.createCaller({
		env: test.env,
		db: test.db,
		logger: {
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
		},
		requestId: "test",
		auth: null,
		user: null,
		memberships: [],
		client: "web",
	} as never);
}

/**
 * A sector holding one child category that holds everything, a second child that holds
 * nothing, and an unrelated sector nobody filed anything under.
 */
async function taxonomy(test: Test) {
	await test.db.insert(categoryTable).values([
		{ id: "cat_sector", slug: "sector", name: "Sector", sortOrder: 100 },
		{
			id: "cat_child",
			slug: "child",
			name: "Hijo",
			parentId: "cat_sector",
			sortOrder: 101,
		},
		{
			id: "cat_empty",
			slug: "empty",
			name: "Vacío",
			parentId: "cat_sector",
			sortOrder: 102,
		},
		{ id: "cat_other", slug: "other", name: "Otro", sortOrder: 200 },
	]);

	const businessId = await seedBusiness(test.db, {
		id: "biz_rollup",
		slug: "soda-rollup",
		name: "Soda Rollup",
	});
	await test.db
		.update(businessTable)
		.set({ categoryId: "cat_child" })
		.where(eq(businessTable.id, businessId));

	await seedProduct(test.db, {
		id: "prd_rollup",
		businessId,
		name: "Producto Rollup",
		categoryId: "cat_child",
	});
}

describe("a sector filter reaches its children", () => {
	test("products.list answers a product filed under a child", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const rows = await (await caller(test)).products.list({
				categoryId: "cat_sector",
				limit: 20,
			});
			expect(rows.items.map((row) => row.id)).toEqual(["prd_rollup"]);
		} finally {
			test.close();
		}
	});

	test("businesses.list answers a shop filed under a child", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const rows = await (await caller(test)).businesses.list({
				categoryId: "cat_sector",
			});
			expect(rows.items.map((row) => row.id)).toEqual(["biz_rollup"]);
		} finally {
			test.close();
		}
	});

	test("a leaf still matches itself", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const rows = await (await caller(test)).products.list({
				categoryId: "cat_child",
				limit: 20,
			});
			expect(rows.items.map((row) => row.id)).toEqual(["prd_rollup"]);
		} finally {
			test.close();
		}
	});

	test("a child holding nothing answers nothing, not its sector's stock", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const rows = await (await caller(test)).products.list({
				categoryId: "cat_empty",
				limit: 20,
			});
			expect(rows.items).toEqual([]);
		} finally {
			test.close();
		}
	});

	test("an unrelated sector answers nothing", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const rows = await (await caller(test)).products.list({
				categoryId: "cat_other",
				limit: 20,
			});
			expect(rows.items).toEqual([]);
		} finally {
			test.close();
		}
	});
});
