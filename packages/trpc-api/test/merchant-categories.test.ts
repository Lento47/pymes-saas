import { describe, expect, test } from "bun:test";
import { business as businessTable } from "@pymeshub/db";
import { eq } from "drizzle-orm";
import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

describe("merchant menu categories", () => {
	test("scopes groups to a business and filters its products", async () => {
		const testWorld = world();
		const first = await seedBusiness(testWorld.db, {
			id: "biz_categories_first",
			slug: "categories-first",
			name: "First",
		});
		const second = await seedBusiness(testWorld.db, {
			id: "biz_categories_second",
			slug: "categories-second",
			name: "Second",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_categories_owner" });
		await seedMembership(testWorld.db, owner.id, first, "OWNER");
		const caller = appRouter.createCaller(await authed(testWorld, owner));
		const item = await seedProduct(testWorld.db, {
			id: "prd_categories_item",
			businessId: first,
			name: "Coffee",
			priceMinor: 2000,
		});
		const { id } = await caller.products.createMerchantCategory({
			businessId: first,
			name: "Drinks",
		});
		await caller.products.update({
			businessId: first,
			id: item.id,
			merchantCategoryId: id,
		});
		expect(
			(await caller.products.merchantCategories({ businessId: first }))[0]
				?.productCount,
		).toBe(1);
		expect(
			(
				await caller.products.list({
					businessId: first,
					merchantCategoryId: id,
				})
			).items.map((p) => p.id),
		).toContain(item.id);
		await expect(
			caller.products.merchantCategories({ businessId: second }),
		).rejects.toThrow();
		await expect(
			caller.products.createMerchantCategory({
				businessId: second,
				name: "Other",
			}),
		).rejects.toThrow();
	});

	test("requires reassignment before deleting a group with products", async () => {
		const testWorld = world();
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_categories_delete",
			slug: "categories-delete",
			name: "Delete",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_categories_delete" });
		await seedMembership(testWorld.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(testWorld, owner));
		const item = await seedProduct(testWorld.db, {
			id: "prd_categories_delete",
			businessId,
			name: "Tea",
			priceMinor: 1500,
		});
		const source = await caller.products.createMerchantCategory({
			businessId,
			name: "Drinks",
		});
		const target = await caller.products.createMerchantCategory({
			businessId,
			name: "Beverages",
		});
		await caller.products.update({
			businessId,
			id: item.id,
			merchantCategoryId: source.id,
		});
		await expect(
			caller.products.deleteMerchantCategory({ businessId, id: source.id }),
		).rejects.toThrow();
		await caller.products.deleteMerchantCategory({
			businessId,
			id: source.id,
			reassignToId: target.id,
		});
		expect(
			(await caller.products.detail({ businessId, id: item.id }))
				.merchantCategoryId,
		).toBe(target.id);
		expect(
			(await caller.products.merchantCategories({ businessId })).map(
				(c) => c.id,
			),
		).toEqual([target.id]);
	});
	test("rejects cross-business category assignments", async () => {
		const testWorld = world();
		const first = await seedBusiness(testWorld.db, {
			id: "biz_category_owner",
			slug: "category-owner",
			name: "Owner",
		});
		const second = await seedBusiness(testWorld.db, {
			id: "biz_category_other",
			slug: "category-other",
			name: "Other",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_category_both" });
		await seedMembership(testWorld.db, owner.id, first, "OWNER");
		await seedMembership(testWorld.db, owner.id, second, "OWNER");
		const caller = appRouter.createCaller(await authed(testWorld, owner));
		const own = await caller.products.createMerchantCategory({
			businessId: first,
			name: "Bread",
		});
		const foreign = await caller.products.createMerchantCategory({
			businessId: second,
			name: "Other",
		});
		await caller.products.renameMerchantCategory({
			businessId: first,
			id: own.id,
			name: "Bakery",
		});
		expect(
			(await caller.products.merchantCategories({ businessId: first }))[0]
				?.name,
		).toBe("Bakery");
		await expect(
			caller.products.createMerchantCategory({
				businessId: first,
				name: "BAKERY",
			}),
		).rejects.toThrow();
		await expect(
			caller.products.renameMerchantCategory({
				businessId: first,
				id: foreign.id,
				name: "Wrong",
			}),
		).rejects.toThrow();
		await expect(
			caller.products.deleteMerchantCategory({
				businessId: first,
				id: foreign.id,
			}),
		).rejects.toThrow();
		const item = await seedProduct(testWorld.db, {
			id: "prd_category_cross",
			businessId: first,
			name: "Loaf",
			priceMinor: 1000,
		});
		await expect(
			caller.products.update({
				businessId: first,
				id: item.id,
				merchantCategoryId: foreign.id,
			}),
		).rejects.toThrow();
	});
	test("business deletion cascades through grouped products", async () => {
		const testWorld = world();
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_category_cascade",
			slug: "category-cascade",
			name: "Cascade",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_category_cascade" });
		await seedMembership(testWorld.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(testWorld, owner));
		const group = await caller.products.createMerchantCategory({
			businessId,
			name: "Food",
		});
		const item = await seedProduct(testWorld.db, {
			id: "prd_category_cascade",
			businessId,
			name: "Soup",
			priceMinor: 1000,
		});
		await caller.products.update({
			businessId,
			id: item.id,
			merchantCategoryId: group.id,
		});
		await testWorld.db
			.delete(businessTable)
			.where(eq(businessTable.id, businessId));
	});
});
