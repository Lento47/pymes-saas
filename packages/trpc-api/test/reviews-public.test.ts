import { describe, expect, test } from "bun:test";

import { appRouter } from "../src/routers";
import {
	contextFor,
	seedBusiness,
	seedMembership,
	seedReview,
	seedUser,
	world,
} from "./harness";

/**
 * The storefront's page of reviews — the rows behind the rating it already prints.
 *
 * `businesses.bySlug` answers `ratingAvg` and `ratingCount` and no rows, and
 * `reviews.listForBusiness` cannot stand in for them: it is `businessProcedure("orders:read")`,
 * so the middleware reads the caller's membership and answers a shop's staff rather than the
 * customer reading the page. `docs/api-surface.md` carried that as a missing procedure.
 *
 * Two ways the read can be wrong, and the first is the one a refusal-only spec misses:
 * it can refuse a stranger — the entire point of it — and it can hand out a shop the
 * marketplace cannot see. The second is the leak `products.list` had before task #8, and the
 * predicate that closed it there is the one this read reuses.
 *
 * The last two specs are not about visibility: a cursor that repeats or skips a row is
 * invisible until a customer reads one review twice, and a reader that assumes the author row
 * still exists crashes a page that has nothing to do with the deleted account.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

/** A caller with no session at all, which is what a storefront's visitor is. */
async function anonymous(test: Test): Promise<Caller> {
	return appRouter.createCaller(await contextFor(test, null)) as Caller;
}

describe("reviews.list — the public read", () => {
	test("a stranger reads the rows behind a visible shop's rating", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, {
			id: "biz_rev_open",
			slug: "soda-abierta",
		});
		const author = await seedUser(test.db, {
			id: "usr_rev_ana",
			name: "Ana",
		});
		const review = await seedReview(test.db, {
			id: "rev_rev_visible",
			businessId: shop,
			customerId: author.id,
			rating: 5,
			comment: "Muy rico todo",
		});

		const page = await (await anonymous(test)).reviews.list({
			businessId: shop,
			limit: 50,
		});

		// The whole point of the procedure: the caller has no session and still gets rows.
		expect(page.items.map((item) => item.id)).toEqual([review.id]);
		expect(page.items[0]?.rating).toBe(5);
		expect(page.items[0]?.authorName).toBe("Ana");
	});

	test("a stranger is told no more about the reviewer than the name on the review", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, { id: "biz_rev_private" });
		const author = await seedUser(test.db, {
			id: "usr_rev_carlos",
			name: "Carlos",
			email: "carlos@example.test",
			phone: "+50688888888",
		});
		await seedReview(test.db, {
			id: "rev_rev_private",
			businessId: shop,
			customerId: author.id,
		});

		const page = await (await anonymous(test)).reviews.list({
			businessId: shop,
		});
		const payload = JSON.stringify(page.items);

		// The identity fields live on `user` and are never selected by the hydration: the
		// author arrives as `{ name, image }`, and `Review` has no `userId` to carry.
		expect(payload).not.toContain(author.email);
		expect(payload).not.toContain(author.phone ?? "no-phone-seeded");
		expect(page.items[0]).not.toHaveProperty("userId");
	});

	for (const status of ["SUSPENDED", "DRAFT"] as const) {
		test(`a ${status} shop's reviews are not readable, the same way its products are not`, async () => {
			const test = world();
			const shop = await seedBusiness(test.db, {
				id: `biz_rev_${status.toLowerCase()}`,
				status,
			});
			const author = await seedUser(test.db, {
				id: `usr_rev_${status.toLowerCase()}`,
			});
			const review = await seedReview(test.db, {
				id: `rev_rev_${status.toLowerCase()}`,
				businessId: shop,
				customerId: author.id,
			});

			const page = await (await anonymous(test)).reviews.list({
				businessId: shop,
				limit: 50,
			});

			// An empty page rather than a refusal, which is what `products.list` answers for the
			// same shop: the caller has no relationship with the business to be refused *from*.
			// The filter is `publicBusiness()` in the `where`, so the row is never loaded.
			expect(page.items).toEqual([]);
			expect(page.nextCursor).toBeNull();
			expect(page.items.map((item) => item.id)).not.toContain(review.id);
		});
	}

	test("the shop's own staff still read a suspended shop's reviews, or the dashboard breaks", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, {
			id: "biz_rev_suspended",
			status: "SUSPENDED",
		});
		const author = await seedUser(test.db, { id: "usr_rev_ana2" });
		const review = await seedReview(test.db, {
			id: "rev_rev_by_member",
			businessId: shop,
			customerId: author.id,
		});

		const owner = await seedUser(test.db, { id: "usr_rev_owner" });
		await seedMembership(test.db, owner.id, shop, "OWNER");
		const asOwner = appRouter.createCaller(
			await contextFor(test, owner),
		) as Caller;

		// The public read's filter must not close the shop's own page — that is why the two
		// readers are two procedures rather than one with a flag. The person who can fix a
		// suspended shop is the one who would otherwise be looking at an empty list.
		const page = await asOwner.reviews.listForBusiness({ businessId: shop });

		expect(page.items.map((item) => item.id)).toContain(review.id);
	});
});

describe("reviews.list — the cursor", () => {
	test("pages a shop's reviews without repeating or skipping one", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, { id: "biz_rev_paged" });
		const author = await seedUser(test.db, { id: "usr_rev_paged" });
		const base = Date.UTC(2026, 0, 1, 12, 0, 0);

		// Five rows over four distinct milliseconds, so one pair shares a `createdAt` — the tie
		// the `(createdAt, id)` tuple exists for. Ordering is newest first, and the id breaks
		// the tie descending.
		const seeded = [
			{ id: "rev_page_1", at: base + 4000 },
			{ id: "rev_page_2", at: base + 3000 },
			{ id: "rev_page_3", at: base + 2000 },
			{ id: "rev_page_5", at: base + 1000 },
			{ id: "rev_page_4", at: base + 1000 },
		];
		for (const row of seeded) {
			await seedReview(test.db, {
				id: row.id,
				businessId: shop,
				customerId: author.id,
				createdAt: new Date(row.at),
			});
		}

		const caller = await anonymous(test);
		const seen: string[] = [];
		let cursor: string | undefined;
		let pages = 0;

		do {
			const page = await caller.reviews.list({
				businessId: shop,
				limit: 2,
				...(cursor ? { cursor } : {}),
			});
			seen.push(...page.items.map((item) => item.id));
			cursor = page.nextCursor ?? undefined;
			pages += 1;
			// A cursor that never advances would loop forever rather than fail, so the walk
			// is bounded by the rows there are to see.
		} while (cursor && pages < seeded.length + 1);

		expect(seen).toHaveLength(seeded.length);
		expect(new Set(seen).size).toBe(seeded.length);
		expect(seen).toEqual([
			"rev_page_1",
			"rev_page_2",
			"rev_page_3",
			"rev_page_5",
			"rev_page_4",
		]);
		expect(cursor).toBeUndefined();
	});

	test("a review whose author was deleted still reads, under the fallback name", async () => {
		const test = world();
		const shop = await seedBusiness(test.db, { id: "biz_rev_orphan" });
		const author = await seedUser(test.db, {
			id: "usr_rev_gone",
			name: "Quien Sea",
		});
		const review = await seedReview(test.db, {
			id: "rev_rev_orphan",
			businessId: shop,
			customerId: author.id,
		});

		// `review.customer_id` is `on delete restrict`, so the API cannot reach this state
		// today — the delete is refused. The read must still tolerate it, because the join is
		// what fails and not the row: this is the state a database whose foreign keys were
		// added after its rows were is already in, and `hydrate` answers it with a fallback
		// name instead of a crash. Enforcement is lifted for the one statement that writes it.
		test.sqlite.exec("pragma foreign_keys = off");
		test.sqlite.exec(`delete from user where id = '${author.id}'`);
		test.sqlite.exec("pragma foreign_keys = on");

		const page = await (await anonymous(test)).reviews.list({
			businessId: shop,
		});

		expect(page.items.map((item) => item.id)).toEqual([review.id]);
		expect(page.items[0]?.authorName).toBe("Cliente");
		expect(page.items[0]?.authorImage).toBeNull();
	});
});
