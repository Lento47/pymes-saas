import type { PromotionCard } from "@pymeshub/shared";
import { useSyncExternalStore } from "react";

export type OfferSelection = Pick<
	PromotionCard,
	"code" | "kind" | "value" | "currency" | "minOrderMinor"
> & {
	businessId: string;
	selectedAt: number;
};

const OFFER_LIFETIME_MS = 20 * 60 * 1000;
const listeners = new Set<() => void>();
let selected: OfferSelection | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getOfferSelection(): OfferSelection | null {
	return selected;
}

export function useOfferSelection(): OfferSelection | null {
	return useSyncExternalStore(subscribe, getOfferSelection, () => null);
}

export function rememberOfferSelection(
	businessId: string,
	promotion: Pick<
		PromotionCard,
		"code" | "kind" | "value" | "currency" | "minOrderMinor"
	>,
): void {
	if (expiryTimer) clearTimeout(expiryTimer);
	selected = {
		businessId,
		code: promotion.code,
		kind: promotion.kind,
		value: promotion.value,
		currency: promotion.currency,
		minOrderMinor: promotion.minOrderMinor,
		selectedAt: Date.now(),
	};
	expiryTimer = setTimeout(clearOfferSelection, OFFER_LIFETIME_MS);
	notify();
}

export function clearOfferSelection(): void {
	if (expiryTimer) clearTimeout(expiryTimer);
	expiryTimer = null;
	if (!selected) return;
	selected = null;
	notify();
}

export function offerForBusiness(
	offer: OfferSelection | null,
	businessId: string | null | undefined,
	now = Date.now(),
): OfferSelection | null {
	if (!offer || !businessId || offer.businessId !== businessId) return null;
	if (now - offer.selectedAt >= OFFER_LIFETIME_MS) return null;
	return offer;
}
