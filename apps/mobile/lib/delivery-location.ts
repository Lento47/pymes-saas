import type { Address, AddressInput } from "@pymeshub/shared";

type Point = { lat: number; lng: number };

/** About one metre: native map coordinates may round slightly between saves. */
export function sameDeliveryPoint(
	address: { lat?: number; lng?: number },
	point: Point,
) {
	return (
		address.lat != null &&
		address.lng != null &&
		Math.abs(address.lat - point.lat) < 0.00001 &&
		Math.abs(address.lng - point.lng) < 0.00001
	);
}

/** Reuse a saved point or complete the customer's unpinned default; keep other places intact. */
export function deliveryAddressForPin(
	addresses: readonly Address[],
	point: Point,
	label: string,
): AddressInput & { id?: string } {
	const existing =
		addresses.find((address) => sameDeliveryPoint(address, point)) ??
		addresses.find(
			(address) =>
				address.isDefault && address.lat == null && address.lng == null,
		);
	return {
		id: existing?.id,
		label: existing?.label || label,
		line1: existing?.line1 || label,
		line2: existing?.line2,
		city: existing?.city ?? "",
		region: existing?.region ?? "",
		country: existing?.country ?? "CR",
		postalCode: existing?.postalCode,
		phone: existing?.phone,
		instructions: existing?.instructions,
		lat: point.lat,
		lng: point.lng,
		isDefault: true,
	};
}
