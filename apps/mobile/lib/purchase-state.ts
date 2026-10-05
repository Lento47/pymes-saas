import { isTerminalStatus, type OrderSummary } from "@pymeshub/shared";

export type PurchaseStage =
	| "browsing"
	| "basket"
	| "inCart"
	| "checkout"
	| "confirmed"
	| "paid"
	| "delivery";

type OrderState = Pick<OrderSummary, "status" | "paymentStatus">;
type CompletionOrderState = Pick<OrderSummary, "id" | "status">;

export function shouldPlayDeliveryCompletion(
	previous: CompletionOrderState | null,
	current: CompletionOrderState,
): boolean {
	return (
		previous?.id === current.id &&
		previous.status === "OUT_FOR_DELIVERY" &&
		current.status === "COMPLETED"
	);
}

export function stageForOrder(order: OrderState): PurchaseStage | null {
	if (isTerminalStatus(order.status)) return null;
	if (order.status === "OUT_FOR_DELIVERY") return "delivery";
	if (order.paymentStatus === "PAID") return "paid";
	return "confirmed";
}

export function shouldBreathe(
	stage: PurchaseStage,
	reduceMotion: boolean,
): boolean {
	return stage === "delivery" && !reduceMotion;
}

export function isPurchaseRoute(pathname: string): boolean {
	return (
		pathname === "/" ||
		pathname === "/search" ||
		pathname === "/cart" ||
		pathname === "/checkout" ||
		pathname === "/categories" ||
		pathname === "/favorites" ||
		pathname === "/featured" ||
		pathname === "/nearby" ||
		[
			"/category/",
			"/category-products/",
			"/product/",
			"/store/",
			"/order/",
		].some((prefix) => pathname.startsWith(prefix))
	);
}

export function purchaseStage({
	pathname,
	itemCount,
	activeOrders,
	viewedOrder,
}: {
	pathname: string;
	itemCount?: number;
	activeOrders?: readonly OrderState[];
	viewedOrder?: OrderState;
}): PurchaseStage | null {
	if (!isPurchaseRoute(pathname)) return null;
	if (pathname.startsWith("/order/"))
		return viewedOrder ? stageForOrder(viewedOrder) : null;
	if (pathname === "/checkout") return "checkout";

	const liveOrder = activeOrders?.find(
		(order) => !isTerminalStatus(order.status),
	);
	if (liveOrder) return stageForOrder(liveOrder);
	if (!activeOrders) return null;
	if (pathname === "/cart") return "inCart";
	if (itemCount === undefined) return null;
	return itemCount > 0 ? "basket" : "browsing";
}
