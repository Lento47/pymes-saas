import {
	type DashboardPreferences,
	DEFAULT_DASHBOARD_WIDGETS,
} from "@pymeshub/shared";

/** The minimal preset can keep its own palette and density choices. */
export function isSimpleMerchantHome(
	preferences: DashboardPreferences,
): boolean {
	return (
		preferences.metrics.length === 1 &&
		preferences.metrics[0] === "orders" &&
		preferences.hidden.includes("insights") &&
		preferences.hidden.includes("catalog")
	);
}

export function merchantHomeWidgets(preferences: DashboardPreferences) {
	const keepsDefaultOrder = preferences.widgets.every(
		(id, index) => id === DEFAULT_DASHBOARD_WIDGETS[index],
	);
	const order =
		isSimpleMerchantHome(preferences) && keepsDefaultOrder
			? ([
					"attention",
					"queue",
					"pulse",
					"shortcuts",
					"commands",
					"insights",
					"catalog",
				] as const)
			: preferences.widgets;
	return order.filter((id) => !preferences.hidden.includes(id));
}

/** A shortcut and a command must not advertise the same destination twice. */
export function showMerchantHomeCommand(
	key: string,
	preferences: DashboardPreferences,
	hasOperatingControl: boolean,
) {
	if (!isSimpleMerchantHome(preferences)) return true;
	if (key === "pause") return !hasOperatingControl;
	if (preferences.hidden.includes("shortcuts")) return true;
	const shortcut =
		key === "promo"
			? "promotions"
			: key === "stock"
				? "catalog"
				: key === "hours"
					? "hours"
					: null;
	return shortcut === null || !preferences.shortcutIds.includes(shortcut);
}

export function isMerchantOrderNotification(
	data: Record<string, unknown> | undefined,
	businessId: string,
) {
	return (
		typeof data?.orderId === "string" &&
		data.orderId.startsWith("ord_") &&
		(typeof data.businessId !== "string" || data.businessId === businessId)
	);
}
