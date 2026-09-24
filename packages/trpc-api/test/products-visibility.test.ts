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
 * A closed shop's catalogue is nobody's business but its own.
 *
 * `products.list` was the one public read that answered with a `SUSPENDED` shop's
 * products. It joins `business` to build the seller card and never filtered on its
 * status, while `products.byId`, `cart.addItem`, `catalog.search`, `businesses.bySlug`
 * and the home feed all refused the same rows — so the customer-visible symptom was a
 * product they could see, could not open, and could not add. `helpers.ts` says the rule
 * out loud: "both must be filtered the same way in every public read".
 *
 * The second half of the file is the half that makes the first half safe to ship. This
 * procedure is also the business dashboard's own list, and a suspended shop still has to
 * see its own menu — the person who can fix a suspended shop is the one who would
 * otherwise be looking at an empty page.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/**
 * A suspended shop with a product, an open shop with a product, and the owner of the
 * suspended one. The owner is seeded as a *member*, because that is the only thing the
 * exemption reads.
 */
async function twoShops(test: Test) {
	const closed = await seedBusiness(test.db, {
		id: "biz_vis_closed",
		slug: "fruteria-cerrada",
		name: "Frutería Cerrada",
		status: "SUSPENDED",
	});
	const open = await seedBusiness(test.db, {
		id: "biz_vis_open",
		slug: "soda-abierta",
		name: "Soda Abierta",
	});

	const hidden = await seedProduct(test.db, {
		id: "prd_vis_hidden",
		businessId: closed,
		name: "Aguacate",
		priceMinor: 2400,
	});
	const shown = await seedProduct(test.db, {
		id: "prd_vis_shown",
		businessId: open,
		name: "Café",
		priceMinor: 1500,
	});

	const owner = await seedUser(test.db, { id: "usr_vis_owner" });
	await seedMembership(test.db, owner.id, closed, "OWNER");

	const stranger = await seedUser(test.db, { id: "usr_vis_stranger" });
	await seedMembership(test.db, stranger.id, open, "OWNER");

	const anonymous = appRouter.createCaller(
		await contextFor(test, null),
	) as Caller;
	const asOwner = appRouter.createCaller(await authed(test, owner)) as Caller;
	const asStranger = appRouter.createCaller(
		await authed(test, stranger),
	) as Caller;

	return { closed, open, hidden, shown, owner, anonymous, asOwner, asStranger };
}

/** Just the ids, because the assertions are about which rows came back. */
async function idsOf(
	call: Promise<{ items: { id: string }[] }>,
): Promise<string[]> {
	const page = await call;
	return page.items.map((item) => item.id);
}

describe("a suspended shop's products", () => {
	test("are not in the cross-business list a stranger reads", async () => {
		const { hidden, anonymous } = await twoShops(world());

		const ids = await idsOf(anonymous.products.list({ limit: 50 }));

		expect(ids).not.toContain(hidden.id);
	});

	test("are not reachable by asking for that shop's catalogue", async () => {
		const { closed, anonymous } = await twoShops(world());

		const ids = await idsOf(
			anonymous.products.list({ businessId: closed, limit: 50 }),
		);

		// An empty page rather than a refusal: the caller has no relationship with the
		// business to be refused *from*, which is the same reason `byId` answers 404.
		expect(ids).toEqual([]);
	});

	test("are not reachable by searching for them by name", async () => {
		const { hidden, anonymous } = await twoShops(world());

		const ids = await idsOf(
			anonymous.products.list({ search: "Aguacate", limit: 50 }),
		);

		expect(ids).not.toContain(hidden.id);
	});

	test("stay hidden from somebody else's staff", async () => {
		const { closed, hidden, asStranger } = await twoShops(world());

		const ids = await idsOf(
			asStranger.products.list({ businessId: closed, limit: 50 }),
		);

		expect(ids).not.toContain(hidden.id);
	});

	test("are still returned to the shop's own owner, or the dashboard is unusable", async () => {
		const { closed, hidden, asOwner } = await twoShops(world());

		const ids = await idsOf(
			asOwner.products.list({ businessId: closed, limit: 50 }),
		);

		expect(ids).toContain(hidden.id);
	});

	test("are not smuggled out by the same owner's cross-business read", async () => {
		const { hidden, asOwner } = await twoShops(world());

		// The exemption is per *shop asked for*, not per person: an owner browsing the
		// marketplace sees exactly what a stranger sees.
		const ids = await idsOf(asOwner.products.list({ limit: 50 }));

		expect(ids).not.toContain(hidden.id);
	});
});

describe("an open shop's products", () => {
	test("are still what an anonymous caller gets", async () => {
		const { shown, anonymous } = await twoShops(world());

		const ids = await idsOf(anonymous.products.list({ limit: 50 }));

		// The filter that closes the leak must not close the marketplace with it.
		expect(ids).toContain(shown.id);
	});
});
