import { describe, expect, test } from "bun:test";

import { orderListInput, productListInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import { contextFor, seedBusiness, seedProduct, world } from "./harness";

/**
 * A cursor feed's sort direction, and the key the transport steals.
 *
 * `@trpc/tanstack-react-query` builds an infinite query's input itself: it fills `cursor`
 * from the page param, and it writes **`direction`** — `"forward"` or `"backward"` —
 * overwriting whatever the caller passed. So while these inputs said `direction` for their
 * sort, every read through `infiniteQueryOptions` sent `"forward"` where the schema wanted
 * `"asc" | "desc"` and the API answered a validation error instead of rows. That was not one
 * screen: it was `/orders`, the shop's own product list and the mobile store, and the web
 * suite could not see it because the pages it covered do not scroll.
 *
 * Two halves, because either alone would pass on the bug. The first pins the contract — the
 * reserved key is stripped rather than read, and the old name is gone. The second proves the
 * service still orders by the new one, which is what a rename with no test would break
 * quietly: a caller left saying `direction` has its key discarded, the field falls back to
 * `desc`, and every page renders a plausible list in the wrong order.
 *
 * `orderListInput` is covered by the schema half only. Seeding an order needs the whole
 * place-order path, and the ordering itself is `pageOf` — one function both list
 * procedures share, exercised here through products.
 */

describe("a feed's input and the transport's reserved keys", () => {
	test("strips `direction` instead of reading it as a sort", () => {
		// The exact payload the browser sends: the transport's key, beside the real one.
		const parsed = productListInput.parse({
			sortDirection: "asc",
			cursor: "eyJ2IjoxLCJpZCI6InByZF8xIn0=",
			direction: "forward",
		});

		expect(parsed.sortDirection).toBe("asc");
		expect("direction" in parsed).toBe(false);
	});

	test("falls back to `desc` when `direction` is the only key sent", () => {
		// The first page of an infinite query: no cursor yet, and `direction: "forward"`.
		expect(productListInput.parse({ direction: "forward" }).sortDirection).toBe(
			"desc",
		);
	});

	test("does not accept the reserved name as a sort direction", () => {
		// If a rename ever misses a call site, this is the failure that hides: the key is
		// silently dropped and nothing throws.
		const parsed = productListInput.parse({ direction: "asc" });
		expect("direction" in parsed).toBe(false);
		expect(parsed.sortDirection).toBe("desc");
	});

	test("orderListInput carries the same contract", () => {
		const parsed = orderListInput.parse({
			sortDirection: "asc",
			direction: "backward",
		});

		expect(parsed.sortDirection).toBe("asc");
		expect("direction" in parsed).toBe(false);
	});
});

describe("a cursor feed ordered by sortDirection", () => {
	/**
	 * Three products, three prices, and nothing else in the shop — so the expected order is
	 * arithmetic rather than a guess about the seed.
	 */
	async function shopWithThreePrices() {
		const test = world();
		const businessId = await seedBusiness(test.db, {
			id: "biz_sort_shop",
			slug: "pulperia-ordenada",
			name: "Pulpería Ordenada",
		});

		for (const [index, priceMinor] of [1000, 2000, 3000].entries()) {
			await seedProduct(test.db, {
				id: `prd_sort_${index}`,
				businessId,
				name: `Producto ${index}`,
				priceMinor,
			});
		}

		const caller = appRouter.createCaller(
			await contextFor(test, null),
		) as ReturnType<typeof appRouter.createCaller>;

		return { businessId, caller };
	}

	test("returns the cheapest first when asked ascending", async () => {
		const { businessId, caller } = await shopWithThreePrices();

		const page = await caller.products.list({
			businessId,
			sort: "price",
			sortDirection: "asc",
			limit: 50,
		});

		expect(page.items.map((item) => item.priceMinor)).toEqual([
			1000, 2000, 3000,
		]);
	});

	test("returns the dearest first when asked descending", async () => {
		const { businessId, caller } = await shopWithThreePrices();

		const page = await caller.products.list({
			businessId,
			sort: "price",
			sortDirection: "desc",
			limit: 50,
		});

		expect(page.items.map((item) => item.priceMinor)).toEqual([
			3000, 2000, 1000,
		]);
	});

	test("walks the cursor in the direction it was asked for", async () => {
		const { businessId, caller } = await shopWithThreePrices();

		const first = await caller.products.list({
			businessId,
			sort: "price",
			sortDirection: "asc",
			limit: 1,
		});

		expect(first.items[0]?.priceMinor).toBe(1000);
		expect(first.nextCursor).not.toBeNull();

		const second = await caller.products.list({
			businessId,
			sort: "price",
			sortDirection: "asc",
			limit: 1,
			cursor: first.nextCursor ?? undefined,
		});

		// Ascending means the boundary is "greater than the last row", so the next page is
		// the more expensive one. Read the other way the same cursor serves the same product
		// on both pages and skips its neighbour.
		expect(second.items[0]?.priceMinor).toBe(2000);
	});
});
