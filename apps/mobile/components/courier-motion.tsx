import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { formatOfferCountdown, remainingOfferMs } from "@/lib/courier-motion";
import { useT } from "@/lib/i18n";
import {
	type CourierMotionTokens,
	courierDisplay,
	courierMotionSpace,
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	weight,
} from "@/theme";

import { Image } from "./image";
import { hitSlopFor, Pressable } from "./pressable";
import { Spinner } from "./spinner";
import { Switch } from "./switch";
import { Text } from "./text";

export function CourierWordmark({ color }: { color: string }) {
	const { t } = useT();
	return (
		<Text
			variant="heading"
			bold
			style={[styles.wordmark, { color }]}
			accessibilityRole="header"
		>
			{t("delivery.motion.wordmark")}
		</Text>
	);
}

export function CourierAvailabilityControl({
	available,
	motion,
	onChange,
	disabled,
}: {
	available: boolean;
	motion: CourierMotionTokens;
	onChange: (next: boolean) => void;
	disabled: boolean;
}) {
	const { t } = useT();
	const label = t("delivery.motion.acceptOffers");
	return (
		<View style={styles.availability}>
			<Text
				variant="label"
				style={[styles.availabilityLabel, { color: motion.muted }]}
			>
				{label}
			</Text>
			<Switch
				checked={available}
				onChange={onChange}
				label={label}
				disabled={disabled}
			/>
		</View>
	);
}

export function CourierAvatarButton({
	name,
	uri,
	motion,
	onPress,
}: {
	name: string | null;
	uri: string | null;
	motion: CourierMotionTokens;
	onPress: () => void;
}) {
	const { t } = useT();
	const initials = name
		? name
				.trim()
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part.charAt(0).toUpperCase())
				.join("")
		: "?";
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={t("delivery.motion.account")}
			hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
			style={[
				styles.avatar,
				{ backgroundColor: motion.elevated, borderColor: motion.border },
			]}
		>
			{uri ? (
				<Image uri={uri} style={styles.avatarFill} />
			) : (
				<Text variant="caption" bold style={{ color: motion.ink }}>
					{initials}
				</Text>
			)}
		</Pressable>
	);
}

export function EditorialDispatchHero({
	motion,
}: {
	motion: CourierMotionTokens;
}) {
	const { t } = useT();
	const { width } = useWindowDimensions();
	const displaySize = Math.round(
		Math.min(courierDisplay.xl.fontSize, width * 0.082),
	);
	const display = {
		fontSize: displaySize,
		lineHeight: Math.round(displaySize * 1.06),
		letterSpacing: courierDisplay.xl.letterSpacing,
		fontWeight: weight.bold,
	} as const;
	return (
		<View style={styles.hero}>
			<View
				pointerEvents="none"
				style={[styles.geometryA, { backgroundColor: motion.geometry }]}
			/>
			<View
				pointerEvents="none"
				style={[styles.geometryB, { backgroundColor: motion.geometry }]}
			/>
			<Text variant="display" bold style={[display, { color: motion.ink }]}>
				{t("delivery.motion.hero.connect")}
			</Text>
			<Text variant="display" bold style={display}>
				<Text
					variant="display"
					style={[
						display,
						{ fontWeight: weight.semibold, color: motion.muted },
					]}
				>
					{t("delivery.motion.hero.with")}
				</Text>
				<Text variant="display" bold style={[display, { color: motion.brand }]}>
					{t("delivery.motion.hero.city")}
				</Text>
			</Text>
		</View>
	);
}

export function CourierPerformanceMetrics({
	month,
	rating,
	deliveries,
	motion,
}: {
	month: string;
	rating: string;
	deliveries: string;
	motion: CourierMotionTokens;
}) {
	const { t } = useT();
	return (
		<View style={styles.metrics}>
			<Metric
				value={month}
				caption={t("delivery.motion.metric.month")}
				motion={motion}
			/>
			<View style={[styles.metricRule, { backgroundColor: motion.border }]} />
			<Metric
				value={rating}
				caption={t("delivery.motion.metric.rating")}
				motion={motion}
			/>
			<View style={[styles.metricRule, { backgroundColor: motion.border }]} />
			<Metric
				value={deliveries}
				caption={t("delivery.motion.metric.deliveries")}
				motion={motion}
			/>
		</View>
	);
}

function Metric({
	value,
	caption,
	motion,
}: {
	value: string;
	caption: string;
	motion: CourierMotionTokens;
}) {
	return (
		<View style={styles.metric}>
			<Text
				variant="title"
				bold
				tabular
				style={[styles.metricValue, { color: motion.ink }]}
			>
				{value}
			</Text>
			<Text
				variant="caption"
				style={[styles.metricCaption, { color: motion.subtle }]}
			>
				{caption}
			</Text>
		</View>
	);
}

export function ActiveZoneControl({
	label,
	motion,
	onPress,
}: {
	label: string;
	motion: CourierMotionTokens;
	onPress: () => void;
}) {
	const { t } = useT();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${t("delivery.motion.zone")}. ${label}`}
			style={[
				styles.zone,
				{ borderColor: motion.border, backgroundColor: motion.elevated },
			]}
		>
			<Ionicons
				name="navigate-outline"
				size={icon.inline}
				color={motion.brand}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<View style={styles.zoneCopy}>
				<Text
					variant="caption"
					style={[styles.zoneEyebrow, { color: motion.muted }]}
				>
					{t("delivery.motion.zone")}
				</Text>
				<Text
					variant="body"
					bold
					style={{ color: motion.ink }}
					numberOfLines={1}
				>
					{label}
				</Text>
			</View>
			<Ionicons
				name="chevron-forward"
				size={icon.control}
				color={motion.muted}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
		</Pressable>
	);
}

export function OfferCountdown({
	expiresAt,
	color,
}: {
	expiresAt: Date | string;
	color: string;
}) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(tick);
	}, []);
	const remaining = remainingOfferMs(expiresAt, now);
	return (
		<Text variant="title" bold tabular style={[styles.countdown, { color }]}>
			{formatOfferCountdown(remaining)}
		</Text>
	);
}

export function CircleIconButton({
	name,
	label,
	color,
	background,
	border,
	onPress,
}: {
	name: React.ComponentProps<typeof Ionicons>["name"];
	label: string;
	color: string;
	background: string;
	border: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
			style={[
				styles.circle,
				{ backgroundColor: background, borderColor: border },
			]}
		>
			<Ionicons
				name={name}
				size={icon.control}
				color={color}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
		</Pressable>
	);
}

export function MerchantMark({
	name,
	uri,
	size = 48,
	color,
}: {
	name: string;
	uri?: string | null;
	size?: number;
	color: string;
}) {
	const letter = name.trim().charAt(0).toUpperCase() || "?";
	return (
		<View
			style={[
				styles.mark,
				{ width: size, height: size, borderRadius: radius.md },
			]}
		>
			{uri ? (
				<Image uri={uri} style={styles.avatarFill} />
			) : (
				<Text variant="heading" bold style={{ color }}>
					{letter}
				</Text>
			)}
		</View>
	);
}

export function OfferDestination({
	area,
	motion,
}: {
	area: string;
	motion: CourierMotionTokens;
}) {
	const { t } = useT();
	return (
		<View style={styles.journey}>
			<View style={styles.journeyRail}>
				<View
					style={[styles.journeyDot, { backgroundColor: motion.sheetMuted }]}
				/>
				<View
					style={[styles.journeyLine, { backgroundColor: motion.sheetBorder }]}
				/>
				<View style={[styles.journeyPin, { backgroundColor: motion.brand }]} />
			</View>
			<View style={styles.journeyCopy}>
				<Text
					variant="caption"
					style={[styles.journeyEyebrow, { color: motion.sheetMuted }]}
				>
					{t("delivery.motion.offer.drop")}
				</Text>
				<Text variant="heading" bold style={{ color: motion.sheetInk }}>
					{area}
				</Text>
			</View>
		</View>
	);
}

export function SheetHandle({ color }: { color: string }) {
	return (
		<View style={styles.handleWrap} accessibilityElementsHidden>
			<View style={[styles.handle, { backgroundColor: color }]} />
		</View>
	);
}

export function CourierSheetSecondary({
	label,
	onPress,
	loading,
	disabled,
	motion,
}: {
	label: string;
	onPress: () => void;
	loading?: boolean;
	disabled?: boolean;
	motion: CourierMotionTokens;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={Boolean(disabled || loading)}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: Boolean(disabled), busy: loading }}
			style={[
				styles.sheetSecondary,
				{
					backgroundColor: motion.sheetControl,
					borderColor: motion.sheetBorder,
				},
			]}
		>
			{loading ? <Spinner color={motion.sheetInk} /> : null}
			<Text variant="heading" bold style={{ color: motion.sheetInk }}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	wordmark: {
		fontSize: 15,
		lineHeight: 18,
		letterSpacing: -0.5,
		textTransform: "lowercase",
		fontWeight: weight.semibold,
	},
	availability: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
		minHeight: MIN_TOUCH_TARGET,
	},
	availabilityLabel: {
		fontWeight: weight.semibold,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	avatarFill: { width: "100%", height: "100%" },
	hero: {
		paddingTop: space.lg,
		paddingBottom: space.sm,
		overflow: "hidden",
	},
	geometryA: {
		position: "absolute",
		width: 88,
		height: 88,
		right: -28,
		top: 4,
		borderRadius: 16,
		transform: [{ rotate: "22deg" }],
		opacity: 0.22,
	},
	geometryB: {
		position: "absolute",
		width: 56,
		height: 96,
		right: 36,
		top: 20,
		borderRadius: 12,
		transform: [{ rotate: "-14deg" }],
		opacity: 0.12,
	},
	metrics: {
		flexDirection: "row",
		alignItems: "stretch",
		paddingTop: space.md,
		paddingBottom: space.lg,
	},
	metric: { flex: 1, gap: 4 },
	metricValue: {
		...courierDisplay.metric,
		fontWeight: weight.bold,
		fontVariant: ["tabular-nums"],
	},
	metricCaption: {
		...courierDisplay.eyebrow,
	},
	metricRule: { width: StyleSheet.hairlineWidth, marginVertical: 6 },
	zone: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		paddingHorizontal: space.lg,
		paddingVertical: 10,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
	},
	zoneCopy: { flex: 1, gap: 1 },
	zoneEyebrow: { ...courierDisplay.eyebrow },
	circle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	mark: {
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		backgroundColor: "#F3F4F6",
	},
	countdown: {
		fontSize: 22,
		lineHeight: 26,
		letterSpacing: -0.4,
		fontVariant: ["tabular-nums"],
	},
	journey: { flexDirection: "row", gap: space.md, alignItems: "stretch" },
	journeyRail: { width: 16, alignItems: "center" },
	journeyDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
	journeyLine: { width: 1.5, flex: 1, minHeight: 18, marginVertical: 4 },
	journeyPin: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
	journeyCopy: { flex: 1, gap: 2, paddingBottom: space.xs },
	journeyEyebrow: { ...courierDisplay.eyebrow },
	handleWrap: {
		alignItems: "center",
		paddingBottom: space.md,
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
	},
	sheetSecondary: {
		minHeight: courierMotionSpace.control,
		borderRadius: radius.full,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: space.sm,
		paddingHorizontal: space.xxl,
	},
});
