import { describe, expect, test } from "bun:test";

import { product as productTable } from "@pymeshub/db";
import { eq } from "drizzle-orm";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, seedProduct, world } from "./harness";

describe("home product discovery", () => {
	test("shows only public, in-stock products when no item was featured", async () => {
		const test = world();
		const active = await seedBusiness(test.db, {
			id: "biz_discover_active",
			status: "ACTIVE",
		});
		const suspended = await seedBusiness(test.db, {
			id: "biz_discover_suspended",
			status: "SUSPENDED",
		});
		await seedProduct(test.db, {
			id: "prd_discover_stocked",
			businessId: active,
			trackInventory: true,
			stockQuantity: 3,
		});
		await seedProduct(test.db, {
			id: "prd_discover_untracked",
			businessId: active,
			trackInventory: false,
		});
		await seedProduct(test.db, {
			id: "prd_discover_sold_out",
			businessId: active,
			trackInventory: true,
			stockQuantity: 0,
		});
		await seedProduct(test.db, {
			id: "prd_discover_draft",
			businessId: active,
			status: "DRAFT",
		});
		await seedProduct(test.db, {
			id: "prd_discover_suspended",
			businessId: suspended,
		});

		const caller = appRouter.createCaller(await contextFor(test, null));
		const feed = await caller.catalog.feed({});

		expect(feed.featured).toEqual([]);
		expect(feed.discover.map((product) => product.id).sort()).toEqual([
			"prd_discover_stocked",
			"prd_discover_untracked",
		]);
		expect(feed.discover.every((product) => product.availability.inStock)).toBe(
			true,
		);
	});

	test("limits discovery to the three best-selling available products", async () => {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_discover_ranked",
		});
		for (const [index, soldCount] of [2, 8, 5, 1].entries()) {
			const id = `prd_discover_ranked_${index}`;
			await seedProduct(test.db, { id, businessId });
			await test.db
				.update(productTable)
				.set({ soldCount })
				.where(eq(productTable.id, id));
		}

		const caller = appRouter.createCaller(await contextFor(test, null));
		const feed = await caller.catalog.feed({});
		expect(feed.discover.map((product) => product.id)).toEqual([
			"prd_discover_ranked_1",
			"prd_discover_ranked_2",
			"prd_discover_ranked_0",
		]);
	});
});
