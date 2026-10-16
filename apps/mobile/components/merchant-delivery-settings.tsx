import { StyleSheet, View } from "react-native";
import { useT } from "@/lib/i18n";
import type { DeliveryDraft } from "@/lib/merchant-delivery-settings";
import { space } from "@/theme";

import { Field } from "./field";
import { Segmented } from "./segmented";
import { Switch } from "./switch";
import { Text } from "./text";

export function MerchantDeliverySettings({
	value,
	onChange,
	errors,
	canSetDeliveryFee,
	disabled,
	currency,
}: {
	value: DeliveryDraft;
	onChange: (value: DeliveryDraft) => void;
	errors: Partial<Record<keyof DeliveryDraft, string>>;
	canSetDeliveryFee: boolean;
	disabled: boolean;
	currency: string;
}) {
	const { t } = useT();
	const change = <K extends keyof DeliveryDraft>(
		key: K,
		next: DeliveryDraft[K],
	) => onChange({ ...value, [key]: next });
	return (
		<View style={styles.fields}>
			{(["deliveryEnabled", "pickupEnabled"] as const).map((key) => {
				const label = t(
					key === "deliveryEnabled"
						? "biz.settings.delivery.enabled"
						: "biz.settings.pickup.enabled",
				);
				return (
					<View key={key} style={styles.toggle}>
						<Text style={styles.label}>{label}</Text>
						<Switch
							label={label}
							checked={value[key]}
							onChange={(next) => change(key, next)}
							disabled={disabled}
						/>
					</View>
				);
			})}
			{errors.pickupEnabled ? (
				<Text tone="destructive" accessibilityRole="alert">
					{errors.pickupEnabled}
				</Text>
			) : null}
			{value.deliveryEnabled ? (
				<>
					{canSetDeliveryFee ? (
						<Segmented
							label={t("biz.settings.delivery.pricing")}
							value={value.deliveryPricingMode}
							onChange={(next) =>
								change(
									"deliveryPricingMode",
									next as DeliveryDraft["deliveryPricingMode"],
								)
							}
							options={[
								{
									value: "EXPRESS",
									label: t("biz.settings.delivery.automatic"),
								},
								{
									value: "AFFILIATED",
									label: t("biz.settings.delivery.agreed"),
								},
							]}
							disabled={disabled}
						/>
					) : null}
					{!canSetDeliveryFee || value.deliveryPricingMode === "EXPRESS" ? (
						<Text variant="caption" tone="muted">
							{t("biz.settings.delivery.expressHelp")}
						</Text>
					) : null}
					{canSetDeliveryFee && value.deliveryPricingMode === "AFFILIATED" ? (
						<Field
							label={`${t("biz.settings.delivery.fee")} (${currency})`}
							value={value.deliveryFeeMinor}
							onChangeText={(next) => change("deliveryFeeMinor", next)}
							error={errors.deliveryFeeMinor}
							help={t("biz.settings.delivery.fee.help")}
							keyboardType="decimal-pad"
							editable={!disabled}
						/>
					) : null}
					<View style={styles.toggle}>
						<Text style={styles.label}>{t("biz.settings.delivery.cover")}</Text>
						<Switch
							label={t("biz.settings.delivery.cover")}
							checked={value.merchantCoversDelivery}
							onChange={(next) => change("merchantCoversDelivery", next)}
							disabled={disabled}
						/>
					</View>
					<Text variant="caption" tone="muted">
						{t(
							value.merchantCoversDelivery
								? "biz.settings.delivery.cover.help"
								: "biz.settings.delivery.cover.customerHelp",
						)}
					</Text>
					<Field
						label={`${t("biz.settings.delivery.radius")} (km)`}
						value={value.deliveryRadiusKm}
						onChangeText={(next) => change("deliveryRadiusKm", next)}
						error={errors.deliveryRadiusKm}
						keyboardType="decimal-pad"
						editable={!disabled}
					/>
				</>
			) : null}
			<Field
				label={`${t("biz.settings.delivery.minOrder")} (${currency})`}
				value={value.minOrderMinor}
				onChangeText={(next) => change("minOrderMinor", next)}
				error={errors.minOrderMinor}
				keyboardType="decimal-pad"
				editable={!disabled}
			/>
			<Field
				label={`${t("biz.settings.delivery.prepTime")} (min)`}
				value={value.prepTimeMinutes}
				onChangeText={(next) => change("prepTimeMinutes", next)}
				error={errors.prepTimeMinutes}
				keyboardType="number-pad"
				editable={!disabled}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	fields: { gap: space.lg },
	toggle: { flexDirection: "row", alignItems: "center", gap: space.md },
	label: { flex: 1 },
});
