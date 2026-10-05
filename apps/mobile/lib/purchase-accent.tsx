import { useQuery } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { createContext, type ReactNode, useContext } from "react";

import { useSession } from "@/lib/auth/session";
import { useTRPC } from "@/lib/trpc/context";

import { type PurchaseStage, purchaseStage } from "./purchase-state";

const PurchaseAccentContext = createContext<PurchaseStage | null>(null);
const ORDER_POLL_MS = 30_000;

export function PurchaseAccentProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const trpc = useTRPC();
	const { status } = useSession();
	const signedIn = status === "signed-in";
	const cart = useQuery(
		trpc.cart.get.queryOptions(undefined, { enabled: signedIn }),
	);
	const orders = useQuery(
		trpc.orders.list.queryOptions(
			{ role: "CUSTOMER", activeOnly: true, limit: 20 },
			{ enabled: signedIn, refetchInterval: ORDER_POLL_MS },
		),
	);
	const orderId = pathname.startsWith("/order/")
		? pathname.slice("/order/".length)
		: null;
	const viewed = useQuery(
		trpc.orders.byId.queryOptions(
			{ id: orderId ?? "" },
			{ enabled: signedIn && Boolean(orderId) },
		),
	);
	const stage = purchaseStage({
		pathname,
		itemCount: signedIn ? cart.data?.items.length : 0,
		activeOrders: signedIn ? orders.data?.items : [],
		viewedOrder: signedIn ? viewed.data : undefined,
	});

	return (
		<PurchaseAccentContext.Provider value={stage}>
			{children}
		</PurchaseAccentContext.Provider>
	);
}

export function usePurchaseAccent(): PurchaseStage | null {
	return useContext(PurchaseAccentContext);
}
