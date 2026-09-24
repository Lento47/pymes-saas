import { describe, expect, test } from "bun:test";

import { business as businessTable, order as orderTable } from "@pymeshub/db";
import { addToCartInput, productCardSchema } from "@pymeshub/shared";
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

/**
 * The "Order again" shelf: the products a customer has bought before.
 *
 * Seven claims, and each one is a sentence the contract makes that nothing else in the
 * suite pins - `orders.list` returns `OrderSummary` and never a product row, so this
 * procedure is the only thing standing between the home screen and a client-side join
 * against rows the client does not have:
 *
 * 1. **No purchases, no shelf.** `[]`, not a refusal and not `null` - an empty shelf is
 *    the ordinary state of a new account and renders as such.
 * 2. **A purchase produces its product, as a `ProductCard`.** The live card - today's
 *    name and price through `productCardOf` - and not the order's snapshot (invariant 2:
 *    an order never reads live product data; the shelf deliberately does the opposite).
 * 3. **Dedupe and recency.** Bought twice, shown once, at the position of the most
 *    recent purchase; and two different products come back in the opposite of the order
 *    they were bought in.
 * 4. **An order that bought nothing contributes nothing.** `CANCELLED` and `REJECTED`
 *    are not purchases, and a shelf built from one advertises products the customer
 *    walked away from.
 * 5. **Visibility.** A `SUSPENDED` shop's product is off the shelf - the same
 *    `publicBusiness()` rule `products.list` was fixed to carry. Proven non-vacuous:
 *    with that one clause removed from `purchasedProducts`, the case below fails on
 *    `expect(ids).toEqual([])` (the card comes back); with it restored, it passes.
 * 6. **`limit` caps the cards**, after the dedupe and the visibility filter - so
 *    `limit: 2` is two *shown* products, not two candidates with one already dropped.
 * 7. **The caller's scope, at every privilege.** Another customer's purchase never
 *    appears, and a shop's staff and an admin see their own purchases and nobody
 *    else's - there is no cross-customer shelf to read through any role.
 *
 * What no case here covers, because the fixture cannot reach it honestly: an
 * `order_item` line whose product row is gone. `product_id` is `not null` and
 * `on delete restrict`, so a line always names a product and the product cannot leave
 * while one names it - the join's skip is defence for a state the schema forbids, and a
 * spec that forced one would be asserting against a foreign key rather than against the
 * procedure.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;
type Test = ReturnType<typeof world>;

const CASH = "CASH" as const;
const MINUTE_MS = 60_000;

/**
 * The fixture clock the purchases are stamped with.
 *
 * Two placements can land in the same millisecond, and a shelf whose order is a coin
 * flip is a shelf that reshuffles between two reads - so `buy` stamps each purchase with
 * the next minute after `T0`, in call order, the same way `seedReview` takes `createdAt`
 * so a spec can decide its own ordering.
 */
const T0 = new Date("2026-08-01T09:00:00Z");
let purchases = 0;
function nextPurchaseTime(): Date {
	purchases += 1;
	return new Date(T0.getTime() + purchases * MINUTE_MS);
}

/**
 * One shop, one customer, and their caller.
 *
 * Purchases go through the real path - `cart.addItem` then `orders.place` - because
 * those are the rows this procedure reads, and a fabricated `order_item` would be
 * testing a table shape instead of what the API actually writes.
 */
async function shopAndShopper(test: Test) {
	const shop = await seedBusiness(test.db, { id: "biz_again_shop" });
	const customer = await seedUser(test.db, { id: "usr_again_customer" });
	const caller = appRouter.createCaller(await authed(test, customer)) as Caller;
	return { shop, customer, caller };
}

/** Buy one of the product, and hand back the order id. */
async function buy(
	test: Test,
	caller: Caller,
	productId: string,
	request: string,
): Promise<string> {
	await caller.cart.addItem(
		addToCartInput.parse({ productId, quantity: 1, optionIds: [] }),
	);
	const order = await caller.orders.place({
		fulfilment: "PICKUP",
		paymentMethod: CASH,
		clientRequestId: request,
	});
	await test.db
		.update(orderTable)
		.set({ placedAt: nextPurchaseTime() })
		.where(eq(orderTable.id, order.id));
	return order.id;
}

/** Just the ids, because the assertions are about which products came back and when. */
async function idsOf(call: Promise<{ id: string }[]>): Promise<string[]> {
	const cards = await call;
	return cards.map((card) => card.id);
}

describe("the shelf of a customer who has bought nothing", () => {
	test("is empty, not a refusal", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		expect(ids).toEqual([]);
	});
});

describe("the shelf after a purchase", () => {
	test("carries the product, mapped as a ProductCard", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const product = await seedProduct(test.db, {
			id: "prd_again_coffee",
			businessId: "biz_again_shop",
			name: "Café chorreado",
			priceMinor: 1500,
		});
		await buy(test, caller, product.id, "req_again_first_0001");

		const [card] = await caller.orders.purchasedProducts({ limit: 8 });

		expect(card?.id).toBe(product.id);
		expect(card?.title).toBe("Café chorreado");
		expect(card?.priceMinor).toBe(1500);
		// The whole shape, not three fields: the shelf renders a `ProductCard` like any
		// other rail, and a card that drifts from the schema is a rail that misrenders.
		expect(productCardSchema.safeParse(card).success).toBe(true);
	});
});

describe("the shelf's dedupe and ordering", () => {
	test("shows a product bought twice once, at its most recent purchase", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const first = await seedProduct(test.db, {
			id: "prd_again_rice",
			businessId: "biz_again_shop",
			name: "Arroz",
			priceMinor: 1200,
		});
		const second = await seedProduct(test.db, {
			id: "prd_again_beans",
			businessId: "biz_again_shop",
			name: "Frijoles",
			priceMinor: 900,
		});

		await buy(test, caller, first.id, "req_again_rice_000001");
		await buy(test, caller, second.id, "req_again_beans_0001");
		await buy(test, caller, first.id, "req_again_rice_000002");

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		// `Arroz` bought twice, shown once - and first, because its second purchase is
		// the newest one on the shelf. `Frijoles` keeps the slot its own purchase earned.
		expect(ids).toEqual([first.id, second.id]);
	});

	test("shows two products newest-purchase first, the opposite of the order they were bought in", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const older = await seedProduct(test.db, {
			id: "prd_again_older",
			businessId: "biz_again_shop",
			name: "Empanada",
			priceMinor: 700,
		});
		const newer = await seedProduct(test.db, {
			id: "prd_again_newer",
			businessId: "biz_again_shop",
			name: "Casado",
			priceMinor: 3500,
		});

		await buy(test, caller, older.id, "req_again_older_0001");
		await buy(test, caller, newer.id, "req_again_newer_0001");

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		expect(ids).toEqual([newer.id, older.id]);
	});
});

describe("orders that bought nothing", () => {
	test("a CANCELLED order contributes nothing", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const product = await seedProduct(test.db, {
			id: "prd_again_cancelled",
			businessId: "biz_again_shop",
			name: "Torta",
			priceMinor: 4000,
		});
		const orderId = await buy(
			test,
			caller,
			product.id,
			"req_again_cancel_0001",
		);
		// The customer walks away while the order is still PENDING, through the real
		// transition, so the row ends in a status the machine actually wrote.
		await caller.orders.cancel({ orderId });

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		expect(ids).toEqual([]);
	});

	test("a REJECTED order contributes nothing", async () => {
		const test = world();
		const { shop, caller } = await shopAndShopper(test);
		const product = await seedProduct(test.db, {
			id: "prd_again_rejected",
			businessId: "biz_again_shop",
			name: "Batido",
			priceMinor: 2000,
		});
		const orderId = await buy(
			test,
			caller,
			product.id,
			"req_again_reject_0001",
		);

		// The shop refuses it, through the real transition: `canTransition` allows
		// PENDING → REJECTED for the business, and the fixture does not fake a status
		// the machine would never have written.
		const staff = await seedUser(test.db, { id: "usr_again_staff" });
		await seedMembership(test.db, staff.id, shop, "STAFF");
		const asStaff = appRouter.createCaller(await authed(test, staff)) as Caller;
		await asStaff.orders.advance({ orderId, to: "REJECTED" });

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		expect(ids).toEqual([]);
	});
});

describe("a suspended shop's products", () => {
	test("are off the shelf of the customer who bought them", async () => {
		const test = world();
		const { shop, caller } = await shopAndShopper(test);
		const product = await seedProduct(test.db, {
			id: "prd_again_hidden",
			businessId: shop,
			name: "Aguacate",
			priceMinor: 2400,
		});
		// Bought while the shop was open - the `Frutería La Cosecha` story: the customer
		// ordered before the platform closed the shop, and the shelf must not keep
		// advertising what nobody can buy.
		await buy(test, caller, product.id, "req_again_hidden_0001");
		await test.db
			.update(businessTable)
			.set({ status: "SUSPENDED" })
			.where(eq(businessTable.id, shop));

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 8 }));

		// Non-vacuous: this is the assertion that fails when the `publicBusiness()`
		// clause is taken out of `purchasedProducts` - with the filter removed the card
		// comes back and `[]` becomes `[product.id]`.
		expect(ids).toEqual([]);
	});
});

describe("the shelf's limit", () => {
	test("caps the cards after the dedupe and the visibility filter", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const oldest = await seedProduct(test.db, {
			id: "prd_again_third",
			businessId: "biz_again_shop",
			name: "Pan",
			priceMinor: 500,
		});
		const middle = await seedProduct(test.db, {
			id: "prd_again_second",
			businessId: "biz_again_shop",
			name: "Leche",
			priceMinor: 1100,
		});
		const newest = await seedProduct(test.db, {
			id: "prd_again_first",
			businessId: "biz_again_shop",
			name: "Huevos",
			priceMinor: 1800,
		});

		await buy(test, caller, oldest.id, "req_again_limit_0001");
		await buy(test, caller, middle.id, "req_again_limit_0002");
		await buy(test, caller, newest.id, "req_again_limit_0003");

		const ids = await idsOf(caller.orders.purchasedProducts({ limit: 2 }));

		// Two cards - and the two newest purchases, which is what makes the cap a
		// truncation of the shelf rather than a sampling of it.
		expect(ids).toEqual([newest.id, middle.id]);
	});
});

describe("the caller's scope", () => {
	test("another customer's purchase is never on it", async () => {
		const test = world();
		const { caller } = await shopAndShopper(test);
		const mine = await seedProduct(test.db, {
			id: "prd_again_mine",
			businessId: "biz_again_shop",
			name: "Queso",
			priceMinor: 2600,
		});
		const theirs = await seedProduct(test.db, {
			id: "prd_again_theirs",
			businessId: "biz_again_shop",
			name: "Natilla",
			priceMinor: 800,
		});
		await buy(test, caller, mine.id, "req_again_mine_0000001");

		const other = await seedUser(test.db, { id: "usr_again_other" });
		const asOther = appRouter.createCaller(await authed(test, other)) as Caller;
		await buy(test, asOther, theirs.id, "req_again_theirs_0001");

		// Two shelves, two answers: each caller's own purchase and never the other's.
		expect(await idsOf(caller.orders.purchasedProducts({ limit: 8 }))).toEqual([
			mine.id,
		]);
		expect(await idsOf(asOther.orders.purchasedProducts({ limit: 8 }))).toEqual(
			[theirs.id],
		);
	});

	test("is not widened for a shop's staff or for an admin", async () => {
		const test = world();
		const { shop, caller } = await shopAndShopper(test);
		const product = await seedProduct(test.db, {
			id: "prd_again_customer",
			businessId: shop,
			name: "Miel",
			priceMinor: 5000,
		});
		await buy(test, caller, product.id, "req_again_scope_000001");

		const owner = await seedUser(test.db, { id: "usr_again_owner" });
		await seedMembership(test.db, owner.id, shop, "OWNER");
		const admin = await seedUser(test.db, {
			id: "usr_again_admin",
			isAdmin: true,
		});

		// Both could read the customer's *order* - one as the fulfilling shop, one as the
		// platform - and neither reads their shelf: the scope is the session's own
		// `customerId`, and no privilege adds a second one.
		const asOwner = appRouter.createCaller(await authed(test, owner)) as Caller;
		const asAdmin = appRouter.createCaller(await authed(test, admin)) as Caller;

		expect(await idsOf(asOwner.orders.purchasedProducts({ limit: 8 }))).toEqual(
			[],
		);
		expect(await idsOf(asAdmin.orders.purchasedProducts({ limit: 8 }))).toEqual(
			[],
		);
	});
});
