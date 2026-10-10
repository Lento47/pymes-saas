import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedUser,
	world,
} from "./harness";

/**
 * A promotion's banner picture, and the narrowing that turns it into a named state.
 *
 * `promotion.image_url` is a nullable column and `promotionCardSchema.art` is a
 * discriminated union, and the conversion between them lives in one function in
 * `mappers.ts`. That function is the whole of this feature's API surface, so these
 * specs are about the two halves of it rather than about the promotion service, which
 * `promotions.ts` and the rest of this suite already covers for its own columns:
 *
 * 1. **A promotion with no picture is `kind: "none"`, not an absent field.** A client
 *    that cannot tell "the shop chose the plain banner" from "nobody has decided yet"
 *    invents a placeholder, which is the failure the union was introduced to prevent.
 * 2. **The card carries the picture the column holds**, and the card is a *different
 *    read* from the detail — the feed joins and filters while the detail is scoped by
 *    membership — so the narrowing has to hold on both paths or a customer's banner
 *    and a shop's own screen disagree about the same row.
 * 3. **An update that says nothing about the picture leaves it alone.** This is the
 *    one with teeth: a form that saves a changed discount and silently drops the
 *    banner the shop uploaded last month is the bug, and `assign`'s "absent means
 *    leave it" rule is the only thing preventing it.
 *
 * The URL is not validated for being *reachable* — there is no such notion here, and
 * `imageUrlSchema` is the only contract: a root-relative `/files/:id` or an https URL.
 * Anything else is refused at the schema, which is asserted directly because a value
 * that reached the column would be rendered as a broken image on a customer's feed.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/** `/files/` is what `uploads.create` answers, and what `imageUrlSchema` expects. */
const SERVE_PATH = "/files/upl_00000000-0000-4000-8000-000000000000";

/** A signed-in owner of one shop, which is the only caller that may write a promotion. */
async function owner(test: ReturnType<typeof world>) {
	const user = await seedUser(test.db, { id: "usr_promo_art" });
	const businessId = await seedBusiness(test.db, { id: "biz_promo_art" });
	await seedMembership(test.db, user.id, businessId, "OWNER");
	const caller = appRouter.createCaller(await authed(test, user)) as Caller;
	return { caller, businessId };
}

/** A live `PERCENT` code, which is the minimum the feed's four conditions accept. */
function codeInput(
	businessId: string,
	imageUrl?: string | null,
	description?: string | null,
) {
	return {
		businessId,
		code: "SAVE10",
		kind: "PERCENT" as const,
		value: 10,
		...(imageUrl === undefined ? {} : { imageUrl }),
		...(description === undefined ? {} : { description }),
	};
}

describe("a promotion's banner", () => {
	test("carries the code's minimum order amount onto the public card", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		await caller.promotions.create({
			...codeInput(businessId),
			minOrderMinor: 5000,
		});

		const feed = await caller.catalog.feed({ limit: 20 });
		const card = feed.promotions.find(
			(promotion) => promotion.code === "SAVE10",
		);
		expect(card?.minOrderMinor).toBe(5000);
		expect(card?.currency).toBe("CRC");

		test.close();
	});

	test("is `none` when the shop never chose one", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		const created = await caller.promotions.create(codeInput(businessId));
		expect(created.imageUrl).toBeNull();

		// The column really is null rather than empty-string, because `promotionArtOf`
		// branches on `=== null` and an empty string would be narrowed into a `photo`
		// with nothing to draw.
		const row = test.sqlite
			.prepare("select image_url from promotion where id = ?")
			.get(created.id) as { image_url: string | null };
		expect(row.image_url).toBeNull();

		test.close();
	});

	test("carries the stored picture on both the card and the detail", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		await caller.promotions.create(codeInput(businessId, SERVE_PATH));

		// The merchant's own screen: the column, verbatim.
		const listed = await caller.promotions.list({ businessId });
		expect(listed[0]?.imageUrl).toBe(SERVE_PATH);

		// The customer's screen: the same row, narrowed. This is the assertion the whole
		// union exists for — the feed's read is a different query from the detail's, so
		// "the mapper works" is only true if it was checked on both.
		const feed = await caller.catalog.feed({ limit: 20 });
		const card = feed.promotions.find(
			(promotion) => promotion.code === "SAVE10",
		);
		expect(card?.art).toEqual({ kind: "photo", imageUrl: SERVE_PATH });

		test.close();
	});

	test("narrows a promotion with no picture to `none` on the card too", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		await caller.promotions.create(codeInput(businessId));

		const feed = await caller.catalog.feed({ limit: 20 });
		const card = feed.promotions.find(
			(promotion) => promotion.code === "SAVE10",
		);
		expect(card?.art).toEqual({ kind: "none" });
		expect(card?.minOrderMinor).toBeNull();

		test.close();
	});

	test("an update that omits the picture keeps it, and an explicit null takes it off", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		const created = await caller.promotions.create(
			codeInput(businessId, SERVE_PATH),
		);

		// The dangerous one: saving a changed discount must not cost the shop its
		// banner. Nothing about `value` mentions a picture, and `assign` skips an absent
		// key rather than writing null over it.
		const renamed = await caller.promotions.update({
			businessId,
			id: created.id,
			value: 25,
		});
		expect(renamed.imageUrl).toBe(SERVE_PATH);
		expect(renamed.value).toBe(25);

		// And the way off, which has to be explicit — "absent means leave it" is only
		// useful if something can also say "no".
		const cleared = await caller.promotions.update({
			businessId,
			id: created.id,
			imageUrl: null,
		});
		expect(cleared.imageUrl).toBeNull();

		const feed = await caller.catalog.feed({ limit: 20 });
		const card = feed.promotions.find(
			(promotion) => promotion.code === "SAVE10",
		);
		expect(card?.art).toEqual({ kind: "none" });

		test.close();
	});

	test("refuses a URL that is neither a serve path nor https", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		// `http://` is refused, not downgraded: the serve route is the only place a
		// picture comes from and an arbitrary origin on a card is a tracking pixel.
		await expect(
			caller.promotions.create(
				codeInput(businessId, "http://example.test/promo.png"),
			),
		).rejects.toThrow();

		// A `javascript:` or `data:` payload is the same refusal for a sharper reason.
		await expect(
			caller.promotions.create(
				codeInput(businessId, "javascript:alert(1)") as never,
			),
		).rejects.toThrow();

		const stored = test.sqlite
			.prepare("select count(*) as n from promotion")
			.get() as { n: number };
		expect(stored.n).toBe(0);

		test.close();
	});

	test("carries a short description on the card and the detail", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		const created = await caller.promotions.create(
			codeInput(businessId, undefined, "Half off lunch on weekdays"),
		);
		expect(created.description).toBe("Half off lunch on weekdays");

		const listed = await caller.promotions.list({ businessId });
		expect(listed[0]?.description).toBe("Half off lunch on weekdays");

		const feed = await caller.catalog.feed({ limit: 20 });
		const card = feed.promotions.find(
			(promotion) => promotion.code === "SAVE10",
		);
		expect(card?.description).toBe("Half off lunch on weekdays");

		test.close();
	});

	test("refuses a description longer than forty words", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);
		const tooLong = Array.from({ length: 41 }, () => "word").join(" ");

		await expect(
			caller.promotions.create(codeInput(businessId, undefined, tooLong)),
		).rejects.toThrow();

		const stored = test.sqlite
			.prepare("select count(*) as n from promotion")
			.get() as { n: number };
		expect(stored.n).toBe(0);

		test.close();
	});

	test("an update that omits the description keeps it, and an empty one clears it", async () => {
		const test = world();
		const { caller, businessId } = await owner(test);

		const created = await caller.promotions.create(
			codeInput(businessId, undefined, "Weekday lunch"),
		);

		const renamed = await caller.promotions.update({
			businessId,
			id: created.id,
			value: 20,
		});
		expect(renamed.description).toBe("Weekday lunch");

		const cleared = await caller.promotions.update({
			businessId,
			id: created.id,
			description: null,
		});
		expect(cleared.description).toBeNull();

		test.close();
	});
});
