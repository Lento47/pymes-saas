import type { MessageKey } from "@pymeshub/i18n";
import {
	type BusinessSettings,
	businessUpdateInput,
	currencyExponent,
	parseMoney,
} from "@pymeshub/shared";

export type DeliveryDraft = {
	deliveryEnabled: boolean;
	pickupEnabled: boolean;
	deliveryPricingMode: "EXPRESS" | "AFFILIATED";
	merchantCoversDelivery: boolean;
	deliveryFeeMinor: string;
	deliveryRadiusKm: string;
	prepTimeMinutes: string;
	minOrderMinor: string;
};

export function deliveryDraft(
	settings: Pick<
		BusinessSettings,
		keyof DeliveryDraft | "currency" | "canSetDeliveryFee"
	>,
): DeliveryDraft {
	const money = (value: number) =>
		(value / 10 ** currencyExponent(settings.currency)).toFixed(
			currencyExponent(settings.currency),
		);
	return {
		deliveryEnabled: settings.deliveryEnabled,
		pickupEnabled: settings.pickupEnabled,
		deliveryPricingMode: settings.canSetDeliveryFee
			? (settings.deliveryPricingMode ?? "EXPRESS")
			: "EXPRESS",
		merchantCoversDelivery: settings.merchantCoversDelivery ?? false,
		deliveryFeeMinor: money(settings.deliveryFeeMinor),
		deliveryRadiusKm: settings.deliveryRadiusKm?.toString() ?? "",
		prepTimeMinutes: settings.prepTimeMinutes.toString(),
		minOrderMinor: money(settings.minOrderMinor),
	};
}

const deliveryInput = businessUpdateInput.pick({
	deliveryEnabled: true,
	pickupEnabled: true,
	deliveryPricingMode: true,
	merchantCoversDelivery: true,
	deliveryFeeMinor: true,
	deliveryRadiusKm: true,
	prepTimeMinutes: true,
	minOrderMinor: true,
});

export function deliveryUpdate(
	draft: DeliveryDraft,
	currency: BusinessSettings["currency"],
	canSetDeliveryFee: boolean,
) {
	const pricing = canSetDeliveryFee ? draft.deliveryPricingMode : "EXPRESS";
	const money = (value: string) =>
		value.trim() ? (parseMoney(value, currency) ?? Number.NaN) : 0;
	const result = deliveryInput.safeParse({
		deliveryEnabled: draft.deliveryEnabled,
		pickupEnabled: draft.pickupEnabled,
		deliveryPricingMode: pricing,
		merchantCoversDelivery: draft.merchantCoversDelivery,
		...(draft.deliveryEnabled && pricing === "AFFILIATED"
			? { deliveryFeeMinor: money(draft.deliveryFeeMinor) }
			: {}),
		...(draft.deliveryEnabled && draft.deliveryRadiusKm.trim()
			? { deliveryRadiusKm: Number(draft.deliveryRadiusKm.replace(",", ".")) }
			: {}),
		prepTimeMinutes: Number(draft.prepTimeMinutes),
		minOrderMinor: money(draft.minOrderMinor),
	});
	const errors: Partial<Record<keyof DeliveryDraft, MessageKey>> = {};
	if (!result.success) {
		for (const issue of result.error.issues) {
			const field = issue.path[0] as keyof DeliveryDraft;
			errors[field] =
				field === "deliveryFeeMinor" || field === "minOrderMinor"
					? "biz.new.amount.unreadable"
					: "biz.new.number.unreadable";
		}
	}
	if (!draft.deliveryEnabled && !draft.pickupEnabled)
		errors.pickupEnabled = "biz.new.kind.required";
	if (
		pricing === "AFFILIATED" &&
		draft.deliveryEnabled &&
		!errors.deliveryFeeMinor &&
		money(draft.deliveryFeeMinor) <= 0
	)
		errors.deliveryFeeMinor = "biz.settings.delivery.courierFeeRequired";
	return { data: result.success ? result.data : undefined, errors };
}
