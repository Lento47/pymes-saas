import { describe, expect, test } from "bun:test";
import {
	DEFAULT_DASHBOARD_PREFERENCES,
	DEFAULT_STOREFRONT_APPEARANCE,
} from "@pymeshub/shared";
import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

describe("mobile customization", () => {
	test("dashboard settings belong to one user and business, and reject stale saves", async () => {
		const testWorld = world();
		const first = await seedBusiness(testWorld.db, {
			id: "biz_custom_a",
			slug: "custom-a",
		});
		const second = await seedBusiness(testWorld.db, {
			id: "biz_custom_b",
			slug: "custom-b",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_custom_owner" });
		const staff = await seedUser(testWorld.db, { id: "usr_custom_staff" });
		await seedMembership(testWorld.db, owner.id, first, "OWNER");
		await seedMembership(testWorld.db, owner.id, second, "OWNER");
		await seedMembership(testWorld.db, staff.id, first, "STAFF");
		const mine = appRouter.createCaller(await authed(testWorld, owner));
		const coworker = appRouter.createCaller(await authed(testWorld, staff));
		const configuration = {
			...DEFAULT_DASHBOARD_PREFERENCES,
			hidden: ["insights" as const],
			productPreviewCount: 6 as const,
		};
		expect(
			(await mine.business.dashboardPreferences({ businessId: first }))
				.configuration,
		).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
		const saved = await mine.business.saveDashboardPreferences({
			businessId: first,
			revision: 0,
			configuration,
		});
		expect(saved.revision).toBe(1);
		expect(
			(await mine.business.dashboardPreferences({ businessId: first }))
				.configuration,
		).toEqual(configuration);
		expect(
			(await mine.business.dashboardPreferences({ businessId: second }))
				.configuration,
		).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
		expect(
			(await coworker.business.dashboardPreferences({ businessId: first }))
				.configuration,
		).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
		await expect(
			mine.business.saveDashboardPreferences({
				businessId: first,
				revision: 0,
				configuration,
			}),
		).rejects.toThrow();
		await expect(
			coworker.business.dashboardPreferences({ businessId: second }),
		).rejects.toThrow();
	});

	test("dashboard save accepts seven widgets, pulse layouts, and paint maps", async () => {
		const testWorld = world();
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_custom_paint",
			slug: "custom-paint",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_custom_paint" });
		await seedMembership(testWorld.db, owner.id, businessId, "OWNER");
		const mine = appRouter.createCaller(await authed(testWorld, owner));
		const configuration = {
			...DEFAULT_DASHBOARD_PREFERENCES,
			layouts: {
				...DEFAULT_DASHBOARD_PREFERENCES.layouts,
				pulse: "hero" as const,
			},
			widgetThemes: {
				...DEFAULT_DASHBOARD_PREFERENCES.widgetThemes,
				pulse: "coral" as const,
			},
			commandColors: {
				...DEFAULT_DASHBOARD_PREFERENCES.commandColors,
				"add-product": "lime" as const,
			},
		};
		const saved = await mine.business.saveDashboardPreferences({
			businessId,
			revision: 0,
			configuration,
		});
		expect(saved.configuration.widgets).toHaveLength(7);
		expect(saved.configuration.layouts.pulse).toBe("hero");
		expect(saved.configuration.widgetThemes.pulse).toBe("coral");
		expect(saved.configuration.commandColors["add-product"]).toBe("lime");
	});

	test("shop drafts are private, publishing changes the public response, and staff cannot edit", async () => {
		const testWorld = world();
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_custom_shop",
			slug: "custom-shop",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_custom_shop_owner" });
		const manager = await seedUser(testWorld.db, {
			id: "usr_custom_shop_manager",
		});
		const staff = await seedUser(testWorld.db, { id: "usr_custom_shop_staff" });
		await seedMembership(testWorld.db, owner.id, businessId, "OWNER");
		await seedMembership(testWorld.db, manager.id, businessId, "MANAGER");
		await seedMembership(testWorld.db, staff.id, businessId, "STAFF");
		const mine = appRouter.createCaller(await authed(testWorld, owner));
		const managerCaller = appRouter.createCaller(
			await authed(testWorld, manager),
		);
		const staffCaller = appRouter.createCaller(await authed(testWorld, staff));
		const design = {
			...DEFAULT_STOREFRONT_APPEARANCE,
			header: "compact" as const,
			accentColor: "#777777",
			hidden: ["information" as const],
		};
		const saved = await mine.business.saveShopDraft({
			businessId,
			revision: 0,
			configuration: design,
		});
		expect(saved.draft).toEqual(design);
		expect(
			(await mine.businesses.bySlug({ slug: "custom-shop" })).appearance,
		).toBeUndefined();
		expect(
			(await managerCaller.business.shopAppearance({ businessId })).draft,
		).toEqual(design);
		await expect(
			staffCaller.business.shopAppearance({ businessId }),
		).rejects.toThrow();
		await expect(
			staffCaller.business.saveShopDraft({
				businessId,
				revision: 1,
				configuration: design,
			}),
		).rejects.toThrow();
		await mine.business.publishShopDraft({ businessId, revision: 1 });
		expect(
			(await mine.businesses.bySlug({ slug: "custom-shop" })).appearance,
		).toEqual(design);
		const reset = await managerCaller.business.restoreShopDefault({
			businessId,
			revision: 2,
		});
		expect(reset.draft).toEqual(DEFAULT_STOREFRONT_APPEARANCE);
		expect(
			(await mine.businesses.bySlug({ slug: "custom-shop" })).appearance,
		).toEqual(design);
		await managerCaller.business.discardShopDraft({ businessId, revision: 3 });
		expect(
			(await mine.business.shopAppearance({ businessId })).draft,
		).toBeNull();
	});

	test("unpublished shops can preview, and an unreadable brand color is refused", async () => {
		const testWorld = world();
		const businessId = await seedBusiness(testWorld.db, {
			id: "biz_custom_draft",
			slug: "custom-draft",
			status: "DRAFT",
		});
		const owner = await seedUser(testWorld.db, { id: "usr_custom_draft" });
		await seedMembership(testWorld.db, owner.id, businessId, "OWNER");
		const caller = appRouter.createCaller(await authed(testWorld, owner));
		expect((await caller.business.shopPreview({ businessId })).card.id).toBe(
			businessId,
		);
		await expect(
			caller.businesses.bySlug({ slug: "custom-draft" }),
		).rejects.toThrow();
		await expect(
			caller.business.saveShopDraft({
				businessId,
				revision: 0,
				configuration: {
					...DEFAULT_STOREFRONT_APPEARANCE,
					accentColor: "#FFFFFF",
				},
			}),
		).rejects.toThrow();
	});
});
