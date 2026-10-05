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

	test("operational and account screens keep neutral backgrounds", () => {
		expect(isPurchaseRoute("/orders")).toBe(false);
		expect(isPurchaseRoute("/account")).toBe(false);
		expect(isPurchaseRoute("/merchant-order/one")).toBe(false);
		expect(isPurchaseRoute("/store/one")).toBe(true);
		expect(
			purchaseStage({ pathname: "/orders", itemCount: 2, activeOrders: [] }),
		).toBeNull();
	});
});
