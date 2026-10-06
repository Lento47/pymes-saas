import { describe, expect, test } from "bun:test";

import {
	isPurchaseRoute,
	purchaseStage,
	shouldBreathe,
	shouldPlayDeliveryCompletion,
	stageForOrder,
} from "./purchase-state";

describe("purchase journey", () => {
	test("delivery completion plays only for the live order transition", () => {
		expect(
			shouldPlayDeliveryCompletion(
				{ id: "order-1", status: "OUT_FOR_DELIVERY" },
				{ id: "order-1", status: "COMPLETED" },
			),
		).toBe(true);
		expect(
			shouldPlayDeliveryCompletion(null, {
				id: "order-1",
				status: "COMPLETED",
			}),
		).toBe(false);
		expect(
			shouldPlayDeliveryCompletion(
				{ id: "order-2", status: "OUT_FOR_DELIVERY" },
				{ id: "order-1", status: "COMPLETED" },
			),
		).toBe(false);
		expect(
			shouldPlayDeliveryCompletion(
				{ id: "order-1", status: "OUT_FOR_DELIVERY" },
				{ id: "order-1", status: "CANCELLED" },
			),
		).toBe(false);
	});

	test("only confirmed payment turns the order green", () => {
		expect(stageForOrder({ status: "PENDING", paymentStatus: "UNPAID" })).toBe(
			"confirmed",
		);
		expect(
			stageForOrder({ status: "ACCEPTED", paymentStatus: "PENDING" }),
		).toBe("confirmed");
		expect(stageForOrder({ status: "PENDING", paymentStatus: "PAID" })).toBe(
			"paid",
		);
		expect(stageForOrder({ status: "PREPARING", paymentStatus: "PAID" })).toBe(
			"paid",
		);
		expect(stageForOrder({ status: "ACCEPTED", paymentStatus: "PAID" })).toBe(
			"paid",
		);
		expect(stageForOrder({ status: "READY", paymentStatus: "UNPAID" })).toBe(
			"confirmed",
		);
	});

	test("delivery breath outranks payment, terminal states carry no band", () => {
		expect(
			stageForOrder({ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" }),
		).toBe("delivery");
		expect(
			stageForOrder({ status: "OUT_FOR_DELIVERY", paymentStatus: "UNPAID" }),
		).toBe("delivery");
		for (const status of ["COMPLETED", "CANCELLED", "REJECTED"] as const) {
			expect(stageForOrder({ status, paymentStatus: "PAID" })).toBeNull();
		}
	});

	test("only delivery breathes, and reduced motion keeps it static", () => {
		expect(shouldBreathe("delivery", false)).toBe(true);
		expect(shouldBreathe("delivery", true)).toBe(false);
		for (const stage of [
			"browsing",
			"basket",
			"inCart",
			"checkout",
			"confirmed",
			"paid",
		] as const) {
			expect(shouldBreathe(stage, false)).toBe(false);
		}
	});

	test("cart and checkout have separate colours without overriding a live order", () => {
		const activeOrders = [
			{ status: "PENDING", paymentStatus: "UNPAID" },
		] as const;
		expect(
			purchaseStage({ pathname: "/", itemCount: 0, activeOrders: [] }),
		).toBe("browsing");
		expect(
			purchaseStage({
				pathname: "/product/one",
				itemCount: 1,
				activeOrders: [],
			}),
		).toBe("basket");
		expect(
			purchaseStage({ pathname: "/cart", itemCount: 1, activeOrders: [] }),
		).toBe("inCart");
		expect(
			purchaseStage({ pathname: "/cart", itemCount: 1, activeOrders }),
		).toBe("confirmed");
		expect(
			purchaseStage({ pathname: "/checkout", itemCount: 1, activeOrders }),
		).toBe("checkout");
	});

	test("newest live order wins while a viewed order uses its own status", () => {
		const activeOrders = [
			{ status: "CANCELLED", paymentStatus: "UNPAID" },
			{ status: "READY", paymentStatus: "PAID" },
		] as const;
		expect(purchaseStage({ pathname: "/", itemCount: 1, activeOrders })).toBe(
			"paid",
		);
		expect(
			purchaseStage({
				pathname: "/order/another",
				itemCount: 1,
				activeOrders,
				viewedOrder: { status: "OUT_FOR_DELIVERY", paymentStatus: "UNPAID" },
			}),
		).toBe("delivery");
		expect(
			purchaseStage({ pathname: "/order/another", itemCount: 1, activeOrders }),
		).toBeNull();
	});

	test("multiple live orders use the newest server-listed order", () => {
		const activeOrders = [
			{ status: "ACCEPTED", paymentStatus: "UNPAID" },
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;
		expect(purchaseStage({ pathname: "/", itemCount: 0, activeOrders })).toBe(
			"confirmed",
		);
		expect(
			purchaseStage({
				pathname: "/",
				itemCount: 0,
				activeOrders: [...activeOrders].reverse(),
			}),
		).toBe("delivery");
	});

	test("terminal orders fall back to the cart or browsing stage", () => {
		const activeOrders = [
			{ status: "COMPLETED", paymentStatus: "PAID" },
			{ status: "REJECTED", paymentStatus: "UNPAID" },
		] as const;
		expect(purchaseStage({ pathname: "/", itemCount: 2, activeOrders })).toBe(
			"basket",
		);
		expect(purchaseStage({ pathname: "/", itemCount: 0, activeOrders })).toBe(
			"browsing",
		);
		expect(
			purchaseStage({ pathname: "/cart", itemCount: 0, activeOrders }),
		).toBe("inCart");
	});

	test("loading order or cart queries never invents a colour", () => {
		expect(purchaseStage({ pathname: "/", itemCount: 1 })).toBeNull();
		expect(purchaseStage({ pathname: "/", activeOrders: [] })).toBeNull();
		expect(purchaseStage({ pathname: "/cart", itemCount: 1 })).toBeNull();
		expect(purchaseStage({ pathname: "/checkout" })).toBe("checkout");
		expect(
			purchaseStage({
				pathname: "/",
				activeOrders: [{ status: "PENDING", paymentStatus: "UNPAID" }],
			}),
		).toBe("confirmed");
	});

	/**
	 * Two questions, two functions, and the tests are split to match.
	 *
	 * - `isPurchaseRoute` — does this route draw a band **of its own accord**? Unchanged, and
	 *   pinned below exactly as it was, because the browsing ramp reaching `/settings` and
	 *   `/account` is a visual change nobody asked for.
	 * - the delivery band follows the order **only while an order is in transit**, and that is
	 *   `purchaseStage`'s job, not this file's.
	 */
	test("routes that draw a band of their own accord are unchanged", () => {
		expect(isPurchaseRoute("/")).toBe(true);
		expect(isPurchaseRoute("/search")).toBe(true);
		expect(isPurchaseRoute("/cart")).toBe(true);
		expect(isPurchaseRoute("/checkout")).toBe(true);
		expect(isPurchaseRoute("/categories")).toBe(true);
		expect(isPurchaseRoute("/favorites")).toBe(true);
		expect(isPurchaseRoute("/featured")).toBe(true);
		expect(isPurchaseRoute("/nearby")).toBe(true);
		expect(isPurchaseRoute("/store/one")).toBe(true);
		expect(isPurchaseRoute("/product/one")).toBe(true);
		expect(isPurchaseRoute("/category/two")).toBe(true);
		expect(isPurchaseRoute("/category-products/three")).toBe(true);
		expect(isPurchaseRoute("/order/four")).toBe(true);

		// Operational and account screens keep their plain backgrounds. This is the assertion
		// that was here before, and it is still true with nothing in transit.
		expect(isPurchaseRoute("/orders")).toBe(false);
		expect(isPurchaseRoute("/account")).toBe(false);
		expect(isPurchaseRoute("/settings")).toBe(false);
		expect(isPurchaseRoute("/inbox")).toBe(false);
		expect(isPurchaseRoute("/merchant-order/one")).toBe(false);
	});

	/**
	 * The delivery band follows the order across the whole app, and only while it is in transit.
	 *
	 * This is the change: a parcel in the van is visible from `/settings`, `/account`,
	 * `/inbox` and the rest of the root routes, which sit outside `(customer)` and had no band at
	 * all. When the order is delivered the stage goes back to `null` on those routes and they
	 * return to the plain background they have always drawn.
	 */
	test("an order in transit is visible from every customer route", () => {
		const inTransit = [
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;

		// The routes that follow an order but draw no band of their own.
		for (const path of [
			"/settings",
			"/account",
			"/profile",
			"/addresses",
			"/inbox",
			"/help",
			"/safety",
			"/change-password",
			"/delete-account",
			"/orders",
		]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 0,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: "delivery" });
		}

		// And the ones that always drew a band keep answering to the order first.
		for (const path of ["/", "/cart", "/product/one", "/store/one"]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 2,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: "delivery" });
		}
	});

	test("delivered hands the ordinary band back, and the plain routes to the plain background", () => {
		// The order left `activeOnly`, so there is nothing in transit.
		// A route that always drew a band goes back to it, driven by the cart.
		expect(
			purchaseStage({ pathname: "/", itemCount: 2, activeOrders: [] }),
		).toBe("basket");
		expect(
			purchaseStage({ pathname: "/", itemCount: 0, activeOrders: [] }),
		).toBe("browsing");
		// A route that never drew a band goes back to no band at all. This is the assertion that
		// keeps the change from leaking the browsing ramp onto nine screens.
		for (const path of ["/settings", "/account", "/inbox", "/orders"]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 2,
					activeOrders: [],
				}),
			}).toEqual({ path, stage: null });
		}
		// A terminal order is terminal on its own screen too.
		expect(
			purchaseStage({
				pathname: "/order/one",
				viewedOrder: { status: "COMPLETED", paymentStatus: "PAID" },
			}),
		).toBeNull();
	});

	/**
	 * The other roles' trees are excluded, whatever is in flight — a courier is the one carrying
	 * the order, and a merchant console is someone else's screen.
	 */
	test("another role's tree never carries a customer's delivery band", () => {
		const inTransit = [
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;
		// `(auth)` - no signed-in reader, so there is no order to be out for.
		for (const path of ["/sign-in", "/sign-up", "/welcome"]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 0,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: null });
		}
		// `(business)` - the whole tree.
		for (const path of [
			"/business",
			"/business-hours",
			"/analytics",
			"/activity",
			"/locations",
			"/menu",
			"/merchant-settings",
			"/payments",
			"/payouts",
			"/product-form",
			"/products",
			"/promotion-form",
			"/promotions",
			"/reviews",
			"/settlements",
			"/shop-hours",
			"/shop-location",
			"/shop-settings",
			"/store-profile",
			"/team",
			"/support",
			"/audit-history",
			"/merchant-order/one",
			"/new-business",
		]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 0,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: null });
		}
		// `(delivery)`, plus role switches and admin at the root.
		for (const path of [
			"/delivery",
			"/delivery/one",
			"/courier-profile",
			"/business-delivery",
			"/courier-invites",
			"/admin",
		]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 0,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: null });
		}
	});

	/**
	 * The exclusion is a *boundary* match, not `startsWith`. A loose `startsWith` on
	 * `/product` would swallow the customer's own product screen, and one on `/delivery` would
	 * swallow any customer page that happened to share the prefix.
	 */
	test("an exclusion does not swallow a customer route that shares its prefix", () => {
		const inTransit = [
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;
		for (const path of [
			"/product/one",
			"/products-today",
			"/delivery-notes",
			"/business-hours-today",
			"/administer",
			"/reviews-for-you",
		]) {
			expect({
				path,
				stage: purchaseStage({
					pathname: path,
					itemCount: 0,
					activeOrders: inTransit,
				}),
			}).toEqual({ path, stage: "delivery" });
		}
		// While the trees themselves, and anything under them, still do not.
		expect(
			purchaseStage({ pathname: "/products", activeOrders: inTransit }),
		).toBeNull();
		expect(
			purchaseStage({
				pathname: "/delivery/anything/under/it",
				activeOrders: inTransit,
			}),
		).toBeNull();
		expect(
			purchaseStage({
				pathname: "/business/anything",
				activeOrders: inTransit,
			}),
		).toBeNull();
	});

	/**
	 * `/account` is the trap: `app/(business)/account.tsx` and `app/account.tsx` both want that
	 * path, and the root file is the one the customer reaches. Excluding it on the strength of a
	 * same-named file in another tree would drop the band from the hub five trees link to.
	 */
	test("a route name shared with another tree still belongs to the customer", () => {
		const inTransit = [
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;
		expect(
			purchaseStage({
				pathname: "/account",
				itemCount: 0,
				activeOrders: inTransit,
			}),
		).toBe("delivery");
		expect(
			purchaseStage({ pathname: "/account", itemCount: 2, activeOrders: [] }),
		).toBeNull();
		// The business tree's own names, which differ from the customer's by a plural.
		expect(
			purchaseStage({ pathname: "/products", activeOrders: inTransit }),
		).toBeNull();
		expect(
			purchaseStage({ pathname: "/product/one", activeOrders: inTransit }),
		).toBe("delivery");
	});

	/**
	 * Checkout keeps its own colour even with an order in flight, and `/cart` does not. The
	 * distinction is foreground against background: checkout is a transaction the reader is
	 * *in*, and a band about a different order on that screen is worse than no band. A cart is
	 * not a transaction, so a live order repaints it.
	 */
	test("checkout keeps its own colour; a live order repaints everything else", () => {
		const inTransit = [
			{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
		] as const;
		expect(
			purchaseStage({
				pathname: "/checkout",
				itemCount: 3,
				activeOrders: inTransit,
			}),
		).toBe("checkout");
		expect(
			purchaseStage({
				pathname: "/cart",
				itemCount: 3,
				activeOrders: inTransit,
			}),
		).toBe("delivery");
		expect(
			purchaseStage({
				pathname: "/settings",
				itemCount: 3,
				activeOrders: inTransit,
			}),
		).toBe("delivery");
	});

	test("the order's own screen is the one whose stage matters", () => {
		// Above the live-order lookup deliberately: on an order's own screen the order being
		// read is the one whose stage is answered, not whatever else is in flight.
		expect(
			purchaseStage({
				pathname: "/order/one",
				viewedOrder: { status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
				activeOrders: [{ status: "PENDING", paymentStatus: "UNPAID" }] as const,
			}),
		).toBe("delivery");
		expect(
			purchaseStage({
				pathname: "/order/one",
				viewedOrder: { status: "COMPLETED", paymentStatus: "PAID" },
				activeOrders: [
					{ status: "OUT_FOR_DELIVERY", paymentStatus: "PAID" },
				] as const,
			}),
		).toBeNull();
	});

	test("loading order or cart queries still never invents a band", () => {
		// The provider now sits at the root, so it mounts on routes that previously had no
		// provider at all. Before its queries resolve it must draw nothing, not a browsing ramp.
		for (const path of ["/", "/settings", "/account", "/orders"]) {
			expect({
				path,
				stage: purchaseStage({ pathname: path, itemCount: 1 }),
			}).toEqual({
				path,
				stage: null,
			});
			expect({
				path,
				stage: purchaseStage({ pathname: path, activeOrders: [] }),
			}).toEqual({ path, stage: null });
		}
		// `/checkout` is the one route that names its own stage without a query.
		expect(purchaseStage({ pathname: "/checkout" })).toBe("checkout");
	});
});
