import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import {
	authed,
	contextFor,
	seedBusiness,
	seedMembership,
	seedReview,
	seedUser,
	world,
} from "./harness";

/**
 * The switches behind settings' Avisos and Privacidad sections.
 *
 * Three rules, each with a test that would catch the attractive wrong version:
 *
 * 1. **Defaults are today's behaviour.** Every column defaults true, so a reader
 *    who never opened settings gets exactly the inbox they always got — and a
 *    migration that flipped one would be a silent product change wearing a
 *    schema change's clothes.
 * 2. **The reply switch gates the telling, not the answering.** The answer
 *    lives on the review; the inbox row is only the bell. A switch that
 *    deleted the answer would erase the reply from the storefront too.
 * 3. **The avatar switch hides the picture, never the name.** An unattributed
 *    review is a different product from an anonymous one.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/** A caller with no session at all, which is what a storefront's visitor is. */
async function anonymous(test: Test): Promise<Caller> {
	return appRouter.createCaller(await contextFor(test, null)) as Caller;
}

function notificationCount(
	test: Test,
	where: string,
	args: (string | number)[] = [],
): number {
	const row = test.sqlite
		.prepare(`select count(*) as n from "notification" ${where}`)
		.get(...args) as { n: number };
	return row.n;
}

describe("users.notificationPrefs", () => {
	test("a reader who never opened settings gets today's inbox: all true", async () => {
		const test = world();
		const customer = await seedUser(test.db, { id: "usr_pref_fresh" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		expect(await caller.users.notificationPrefs()).toEqual({
			notifyOrderUpdates: true,
			notifyReviewReplies: true,
			showReviewAvatar: true,
		});

		test.close();
	});

	test("a partial write answers the stored row, and an empty one changes nothing", async () => {
		const test = world();
		const customer = await seedUser(test.db, { id: "usr_pref_partial" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;

		expect(
			await caller.users.updatePreferences({ notifyOrderUpdates: false }),
		).toEqual({
			notifyOrderUpdates: false,
			notifyReviewReplies: true,
			showReviewAvatar: true,
		});
		expect(await caller.users.updatePreferences({})).toEqual({
			notifyOrderUpdates: false,
			notifyReviewReplies: true,
			showReviewAvatar: true,
		});

		test.close();
	});
});

describe("reply alerts", () => {
	async function answered(test: Test, customerId: string) {
		const shop = await seedBusiness(test.db, { id: "biz_pref_reply" });
		const { id: reviewId } = await seedReview(test.db, {
			id: `rev_pref_${customerId}`,
			businessId: shop,
			customerId,
		});
		const owner = await seedUser(test.db, {
			id: `usr_pref_owner_${customerId}`,
		});
		await seedMembership(test.db, owner.id, shop, "OWNER");
		const staff = appRouter.createCaller(await authed(test, owner)) as Caller;
		await staff.reviews.reply({
			businessId: shop,
			reviewId,
			reply: "Gracias por visitarnos",
		});
		return shop;
	}

	test("opted in, the answer lands in the inbox", async () => {
		const test = world();
		const customer = await seedUser(test.db, { id: "usr_pref_bell" });
		await answered(test, customer.id);

		expect(
			notificationCount(test, "where kind = 'REVIEW_REPLY' and user_id = ?", [
				customer.id,
			]),
		).toBe(1);

		test.close();
	});

	test("opted out, the answer stays on the review and out of the inbox", async () => {
		const test = world();
		const customer = await seedUser(test.db, { id: "usr_pref_quiet" });
		const caller = appRouter.createCaller(
			await authed(test, customer),
		) as Caller;
		await caller.users.updatePreferences({ notifyReviewReplies: false });
		const shop = await answered(test, customer.id);

		expect(
			notificationCount(test, "where kind = 'REVIEW_REPLY' and user_id = ?", [
				customer.id,
			]),
		).toBe(0);

		// The switch is about the telling, not the answering: the storefront
		// still shows what the shop wrote.
		const page = await (await anonymous(test)).reviews.list({
			businessId: shop,
		});
		expect(page.items[0]?.reply).toBe("Gracias por visitarnos");

		test.close();
	});
});

describe("review avatar visibility", () => {
	test("hidden means no picture, and the name stays", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, { id: "biz_pref_avatar" });
		const author = await seedUser(test.db, {
			id: "usr_pref_shy",
			name: "Rosa",
			image: "https://cdn.example.test/rosa.jpg",
		});
		const caller = appRouter.createCaller(await authed(test, author)) as Caller;
		await caller.users.updatePreferences({ showReviewAvatar: false });
		await seedReview(test.db, {
			id: "rev_pref_shy",
			businessId: shop,
			customerId: author.id,
		});

		const page = await (await anonymous(test)).reviews.list({
			businessId: shop,
		});
		expect(page.items[0]?.authorName).toBe("Rosa");
		expect(page.items[0]?.authorImage).toBeNull();

		test.close();
	});
});
