import { describe, expect, test } from "bun:test";
import { appRouter } from "../src/routers";
import {
	authed,
	contextFor,
	seedBusiness,
	seedMembership,
	seedProduct,
	seedUser,
	world,
} from "./harness";

/**
 * The shop's own menu, as its team reads it.
 *
 * `products.list` answers ACTIVE rows to everybody — the marketplace shelf —
 * and the `status` parameter opens the back room, but only to a member of the
 * shop asked for. A stranger passing `status: ["DRAFT"]` is answered with the
 * published shelf, because a filter a stranger could set would be a window
 * into unpublished work. `products.detail` is the member's read of one row
 * (drafts included) behind `products:read`; the public `byId` keeps refusing
 * them, which the last test pins so the two reads cannot drift into one.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

async function oneShop(test: Test) {
	const shop = await seedBusiness(test.db, {
		id: "biz_mgmt_shop",
		slug: "soda-propia",
		name: "Soda Propia",
	});

	const live = await seedProduct(test.db, {
		id: "prd_mgmt_live",
		businessId: shop,
		name: "Casado",
		priceMinor: 3500,
	});
	const draft = await seedProduct(test.db, {
		id: "prd_mgmt_draft",
		businessId: shop,
		name: "Borrador de gallo pinto",
		priceMinor: 2800,
		status: "DRAFT",
	});

	const owner = await seedUser(test.db, { id: "usr_mgmt_owner" });
	await seedMembership(test.db, owner.id, shop, "OWNER");

	const stranger = await seedUser(test.db, { id: "usr_mgmt_stranger" });
	const anonymous = appRouter.createCaller(
		await contextFor(test, null),
	) as Caller;
	const asOwner = appRouter.createCaller(await authed(test, owner)) as Caller;
	const asStranger = appRouter.createCaller(
		await authed(test, stranger),
	) as Caller;

	return { shop, live, draft, anonymous, asOwner, asStranger };
}

/** Just the ids, because the assertions are about which rows came back. */
async function idsOf(
	call: Promise<{ items: { id: string }[] }>,
): Promise<string[]> {
	const page = await call;
	return page.items.map((item) => item.id);
}

describe("a shop's own menu", () => {
	test("lists drafts to a member who asks for them", async () => {
		const { shop, live, draft, asOwner } = await oneShop(world());

		const ids = await idsOf(
			asOwner.products.list({
				businessId: shop,
				status: ["DRAFT", "ACTIVE"],
				limit: 50,
			}),
		);

		expect(ids).toContain(live.id);
		expect(ids).toContain(draft.id);
	});

	test("answers the published shelf when no status is asked for", async () => {
		const { shop, live, draft, asOwner } = await oneShop(world());

		const ids = await idsOf(
			asOwner.products.list({ businessId: shop, limit: 50 }),
		);

		expect(ids).toContain(live.id);
		expect(ids).not.toContain(draft.id);
	});

	test("ignores a stranger's status ask", async () => {
		const { shop, live, draft, asStranger } = await oneShop(world());

		const ids = await idsOf(
			asStranger.products.list({
				businessId: shop,
				status: ["DRAFT", "ACTIVE"],
				limit: 50,
			}),
		);

		expect(ids).toContain(live.id);
		expect(ids).not.toContain(draft.id);
	});

	test("ignores an anonymous status ask", async () => {
		const { shop, live, draft, anonymous } = await oneShop(world());

		const ids = await idsOf(
			anonymous.products.list({
				businessId: shop,
				status: ["DRAFT"],
				limit: 50,
			}),
		);

		expect(ids).toContain(live.id);
		expect(ids).not.toContain(draft.id);
	});

	test("opens a draft to a member through the member's read", async () => {
		const { shop, draft, asOwner } = await oneShop(world());

		const detail = await asOwner.products.detail({
			businessId: shop,
			id: draft.id,
		});

		expect(detail.id).toBe(draft.id);
	});

	test("refuses a stranger at the member's read", async () => {
		const { shop, draft, asStranger } = await oneShop(world());

		await expect(
			asStranger.products.detail({ businessId: shop, id: draft.id }),
		).rejects.toThrow();
	});

	test("keeps refusing drafts at the public read", async () => {
		const { draft, asOwner } = await oneShop(world());

		// Even the owner: `byId` is the public contract, and the member's door
		// is `detail`. One read that sometimes refuses is a read nobody can
		// reason about.
		await expect(asOwner.products.byId({ id: draft.id })).rejects.toThrow();
	});
});
