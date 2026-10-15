import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import type { DashboardLayouts, DashboardWidgetId } from "@pymeshub/shared";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	cancelAnimation,
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { duration, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { moveItem } from "@/lib/reorder";
import {
	type BusinessThemeId,
	businessThemeColors,
	businessThemeOrder,
	type ColorScheme,
	MIN_TOUCH_TARGET,
	radius,
	space,
	useTheme,
} from "@/theme";

import { hitSlopFor, Pressable } from "./pressable";
import { Text } from "./text";

export { moveItem } from "@/lib/reorder";

const REMOVE_SIZE = 28;
const SWAP_DISTANCE = 36;
const PREVIEW_SLOTS = [
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
] as const;

/**
 * Home-screen tiles you hold to rearrange: they jiggle, an X removes one, and a
 * dashed well with + puts it back. No up/down buttons.
 */
export function CustomizationRows<T extends string>({
	items,
	hidden,
	labels,
	onReorder,
	onToggle,
	canHide,
	fixed = [],
	dense = false,
	onPress,
	selected,
	renderPreview,
	renderChip,
	renderToolbar,
	renderInset,
}: {
	items: readonly T[];
	hidden: readonly T[];
	labels: Record<T, MessageKey>;
	onReorder: (next: T[]) => void;
	onToggle: (item: T) => void;
	canHide?: (item: T) => boolean;
	fixed?: readonly T[];
	dense?: boolean;
	onPress?: (item: T) => void;
	selected?: T | null;
	renderPreview?: (item: T) => ReactNode;
	renderChip?: (item: T) => ReactNode;
	renderToolbar?: (item: T) => ReactNode;
	renderInset?: (item: T) => ReactNode;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const reduced = useReducedMotion();
	const [editing, setEditing] = useState(false);
	const visible = items.filter((item) => !hidden.includes(item));
	const movable = visible.filter((item) => !fixed.includes(item));
	const tucked = items.filter((item) => hidden.includes(item));

	const enterEdit = () => {
		if (editing) return;
		warning();
		setEditing(true);
	};
	const leaveEdit = () => {
		selection();
		setEditing(false);
	};

	return (
		<View style={styles.board}>
			{dense ? null : (
				<Text variant="caption" tone="muted">
					{editing ? t("customize.editing") : t("customize.holdToMove")}
				</Text>
			)}
			{visible.map((item) => (
				<WidgetTile
					key={item}
					editing={editing && !fixed.includes(item)}
					fixed={fixed.includes(item)}
					reduced={reduced}
					dense={dense}
					selected={selected === item}
					label={t(labels[item])}
					onEnterEdit={enterEdit}
					onPress={onPress ? () => onPress(item) : undefined}
					onRemove={
						!fixed.includes(item) && (!canHide || canHide(item))
							? () => onToggle(item)
							: undefined
					}
					onMove={(direction) => {
						if (fixed.includes(item)) return;
						onReorder(
							moveItem(items, items.indexOf(item), direction, [
								...hidden,
								...fixed,
							]),
						);
					}}
					canMoveUp={movable.indexOf(item) > 0}
					canMoveDown={
						movable.includes(item) && movable.indexOf(item) < movable.length - 1
					}
					chip={renderChip?.(item)}
				>
					{renderPreview?.(item) ?? null}
					{selected === item ? renderToolbar?.(item) : null}
					{selected === item ? renderInset?.(item) : null}
				</WidgetTile>
			))}
			{tucked.length > 0 ? (
				<View style={styles.tray}>
					<Text variant="caption" tone="muted">
						{t("customize.add")}
					</Text>
					<View style={styles.trayRow}>
						{tucked.map((item) => (
							<Pressable
								key={item}
								onPress={() => {
									selection();
									onToggle(item);
								}}
								accessibilityRole="button"
								accessibilityLabel={t("customize.addWidget", {
									name: t(labels[item]),
								})}
								style={[
									styles.addWell,
									{
										borderColor: colors.border,
										backgroundColor: colors.muted,
									},
								]}
							>
								<Text variant="title" tone="action">
									+
								</Text>
								<Text variant="caption">{t(labels[item])}</Text>
							</Pressable>
						))}
					</View>
				</View>
			) : null}
			{editing ? (
				<Pressable
					onPress={leaveEdit}
					accessibilityRole="button"
					accessibilityLabel={t("customize.done")}
					style={[styles.done, { backgroundColor: colors.primary }]}
				>
					<Text
						variant="label"
						bold
						style={{ color: colors.primaryForeground }}
					>
						{t("customize.done")}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function WidgetTile({
	editing,
	fixed,
	reduced,
	dense,
	selected,
	label,
	chip,
	children,
	onEnterEdit,
	onPress,
	onRemove,
	onMove,
	canMoveUp,
	canMoveDown,
}: {
	editing: boolean;
	fixed: boolean;
	reduced: boolean;
	dense: boolean;
	selected: boolean;
	label: string;
	chip?: ReactNode;
	children: ReactNode;
	onEnterEdit: () => void;
	onPress?: () => void;
	onRemove?: () => void;
	onMove: (direction: -1 | 1) => void;
	canMoveUp: boolean;
	canMoveDown: boolean;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const drag = useSharedValue(0);
	const wiggle = useSharedValue(0);

	useEffect(() => {
		if (editing && !reduced) {
			wiggle.value = withRepeat(
				withSequence(
					withTiming(-1.4, {
						duration: duration.standard,
						easing: Easing.inOut(Easing.quad),
					}),
					withTiming(1.4, {
						duration: duration.standard,
						easing: Easing.inOut(Easing.quad),
					}),
				),
				-1,
				true,
			);
		} else {
			wiggle.value = withTiming(0, { duration: duration.instant });
		}
		return () => {
			cancelAnimation(wiggle);
		};
	}, [editing, reduced, wiggle]);

	const move = (direction: -1 | 1) => {
		selection();
		onMove(direction);
	};

	const longPress = Gesture.LongPress()
		.enabled(!fixed)
		.minDuration(380)
		.onStart(() => {
			runOnJS(onEnterEdit)();
		});
	const tap = Gesture.Tap()
		.enabled(!editing && !!onPress)
		.onEnd(() => {
			if (onPress) runOnJS(onPress)();
		});
	const pan = Gesture.Pan()
		.enabled(editing)
		.onUpdate((event) => {
			drag.value = event.translationY;
		})
		.onEnd((event) => {
			const direction: -1 | 1 | 0 =
				event.translationY < -SWAP_DISTANCE && canMoveUp
					? -1
					: event.translationY > SWAP_DISTANCE && canMoveDown
						? 1
						: 0;
			drag.value = reduced ? 0 : withSpring(0, spring.layout);
			if (direction !== 0) runOnJS(move)(direction);
		});
	const gesture = editing
		? Gesture.Simultaneous(longPress, pan)
		: Gesture.Exclusive(longPress, tap);

	const animated = useAnimatedStyle(() => ({
		transform: [{ translateY: drag.value }, { rotate: `${wiggle.value}deg` }],
		zIndex: drag.value === 0 ? 0 : 2,
	}));

	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				style={[
					styles.tile,
					dense ? styles.tileDense : null,
					{
						backgroundColor: colors.card,
						borderColor: selected ? colors.primary : colors.border,
						borderWidth: selected ? 2 : 1,
					},
					animated,
				]}
				accessible={!editing}
				accessibilityRole={!editing && onPress ? "button" : undefined}
				accessibilityLabel={label}
				accessibilityHint={
					fixed
						? undefined
						: editing
							? t("customize.editing")
							: t("customize.holdToMove")
				}
				onAccessibilityTap={onPress}
				accessibilityActions={
					editing
						? undefined
						: [
								...(canMoveUp
									? [{ name: "moveUp", label: t("customize.up") }]
									: []),
								...(canMoveDown
									? [{ name: "moveDown", label: t("customize.down") }]
									: []),
								...(onRemove
									? [{ name: "hide", label: t("customize.hide") }]
									: []),
							]
				}
				onAccessibilityAction={(event) => {
					const action = event.nativeEvent.actionName;
					if (action === "moveUp") move(-1);
					if (action === "moveDown") move(1);
					if (action === "hide") onRemove?.();
				}}
			>
				<View style={styles.tileHead}>
					<Text variant="label" bold style={styles.tileTitle}>
						{label}
					</Text>
					{chip}
				</View>
				{children}
				{editing && onRemove ? (
					<Pressable
						onPress={onRemove}
						hitSlop={hitSlopFor(REMOVE_SIZE)}
						accessibilityRole="button"
						accessibilityLabel={t("customize.remove")}
						style={[styles.remove, { backgroundColor: colors.destructive }]}
					>
						<Text
							variant="label"
							bold
							style={{ color: colors.destructiveForeground }}
						>
							×
						</Text>
					</Pressable>
				) : null}
			</Animated.View>
		</GestureDetector>
	);
}

/** Tiny shop-page sketches so each block looks like a different part of the store. */
export function ShopSectionPreview({
	id,
}: {
	id: "information" | "offers" | "featured";
}) {
	const { colors } = useTheme();
	if (id === "information") {
		return (
			<View style={styles.previewRow}>
				<View style={[styles.avatar, { backgroundColor: colors.muted }]} />
				<View style={styles.previewCopy}>
					<View
						style={[
							styles.bar,
							{ width: "70%", backgroundColor: colors.border },
						]}
					/>
					<View
						style={[
							styles.bar,
							{ width: "44%", backgroundColor: colors.muted },
						]}
					/>
				</View>
			</View>
		);
	}
	if (id === "offers") {
		return (
			<View style={styles.previewRow}>
				{[0, 1].map((slot) => (
					<View
						key={slot}
						style={[
							styles.offerCard,
							{
								backgroundColor: colors.muted,
								borderColor: colors.border,
							},
						]}
					>
						<View style={[styles.pill, { backgroundColor: colors.primary }]} />
					</View>
				))}
			</View>
		);
	}
	return (
		<View style={styles.previewCopy}>
			{[0, 1].map((slot) => (
				<View key={slot} style={styles.previewRow}>
					<View
						style={[styles.productTile, { backgroundColor: colors.muted }]}
					/>
					<View style={styles.previewCopy}>
						<View
							style={[
								styles.bar,
								{ width: "80%", backgroundColor: colors.border },
							]}
						/>
						<View
							style={[
								styles.bar,
								{ width: "46%", backgroundColor: colors.muted },
							]}
						/>
					</View>
				</View>
			))}
		</View>
	);
}

/** Tiny dashboard sketches so each widget looks like a different job. */
export function DashboardWidgetPreview({
	id,
	layout,
	metricCount = 3,
	productCount = 3,
	shortcutCount = 4,
}: {
	id: DashboardWidgetId;
	layout?: DashboardLayouts[DashboardWidgetId];
	metricCount?: number;
	productCount?: number;
	shortcutCount?: number;
}) {
	const { colors } = useTheme();
	if (id === "shortcuts") {
		const count = Math.min(6, Math.max(3, shortcutCount));
		if (layout === "grid") {
			return (
				<View style={styles.previewGrid}>
					{PREVIEW_SLOTS.slice(0, count).map((slot) => (
						<View
							key={slot}
							style={[styles.shortcut, { backgroundColor: colors.muted }]}
						/>
					))}
				</View>
			);
		}
		if (layout === "list") {
			return (
				<View style={styles.previewCopy}>
					{PREVIEW_SLOTS.slice(0, Math.min(3, count)).map((slot) => (
						<View key={slot} style={styles.previewRow}>
							<View
								style={[styles.shortcut, { backgroundColor: colors.muted }]}
							/>
							<View
								style={[
									styles.bar,
									{ flex: 1, backgroundColor: colors.border },
								]}
							/>
							<Ionicons
								name="chevron-forward"
								size={12}
								color={colors.mutedForeground}
								accessibilityElementsHidden
							/>
						</View>
					))}
				</View>
			);
		}
		return (
			<View style={styles.previewRow}>
				{PREVIEW_SLOTS.slice(0, Math.min(4, count)).map((slot) => (
					<View
						key={slot}
						style={[styles.shortcut, { backgroundColor: colors.muted }]}
					/>
				))}
			</View>
		);
	}
	if (id === "pulse") {
		const count = Math.min(3, Math.max(1, metricCount));
		if (layout === "hero") {
			return (
				<View
					style={[
						styles.pulseBand,
						styles.pulseHero,
						{ backgroundColor: colors.foreground },
					]}
				>
					<View
						style={[
							styles.bar,
							{
								width: "62%",
								height: 14,
								backgroundColor: colors.background,
							},
						]}
					/>
					<View style={styles.previewRow}>
						{PREVIEW_SLOTS.slice(0, Math.max(0, count - 1)).map((slot) => (
							<View
								key={slot}
								style={[
									styles.bar,
									{
										flex: 1,
										height: 8,
										backgroundColor: colors.background,
									},
								]}
							/>
						))}
					</View>
				</View>
			);
		}
		if (layout === "stack") {
			return (
				<View style={styles.previewCopy}>
					{PREVIEW_SLOTS.slice(0, count).map((slot) => (
						<View
							key={slot}
							style={[
								styles.pulseStackRow,
								{ borderBottomColor: colors.border },
							]}
						>
							<View
								style={[
									styles.bar,
									{ width: "36%", backgroundColor: colors.muted },
								]}
							/>
							<View
								style={[
									styles.bar,
									{
										width: "28%",
										height: 10,
										backgroundColor: colors.foreground,
									},
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		if (layout === "cards") {
			return (
				<View style={styles.previewRow}>
					{PREVIEW_SLOTS.slice(0, count).map((slot) => (
						<View
							key={slot}
							style={[
								styles.metricCard,
								{
									backgroundColor: colors.card,
									borderColor: colors.border,
								},
							]}
						>
							<View
								style={[
									styles.bar,
									{ width: "40%", backgroundColor: colors.muted },
								]}
							/>
							<View
								style={[
									styles.bar,
									{
										width: "70%",
										height: 10,
										backgroundColor: colors.foreground,
									},
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		return (
			<View style={[styles.pulseBand, { backgroundColor: colors.foreground }]}>
				{PREVIEW_SLOTS.slice(0, count).map((slot) => (
					<View
						key={slot}
						style={[styles.metric, { backgroundColor: "transparent" }]}
					>
						<View
							style={[
								styles.bar,
								{ width: "50%", backgroundColor: colors.background },
							]}
						/>
						<View
							style={[
								styles.bar,
								{
									width: "78%",
									height: 8,
									backgroundColor: colors.background,
								},
							]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (id === "insights") {
		if (layout === "band") {
			return (
				<View style={[styles.pulseBand, { backgroundColor: colors.primary }]}>
					{[0, 1, 2].map((slot) => (
						<View key={slot} style={styles.insightBandCell}>
							<View
								style={[
									styles.bar,
									{ width: "70%", backgroundColor: colors.primaryForeground },
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		if (layout === "stack") {
			return (
				<View style={styles.previewCopy}>
					{[0, 1, 2].map((slot) => (
						<View
							key={slot}
							style={[
								styles.insightStackRow,
								{ borderBottomColor: colors.border },
							]}
						>
							<View
								style={[
									styles.bar,
									{ width: "36%", backgroundColor: colors.muted },
								]}
							/>
							<View
								style={[
									styles.bar,
									{ width: "58%", height: 8, backgroundColor: colors.border },
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		return (
			<View style={styles.previewRow}>
				{[0, 1, 2].map((slot) => (
					<View key={slot} style={styles.previewCopy}>
						<View
							style={[
								styles.bar,
								{ width: "88%", height: 8, backgroundColor: colors.border },
							]}
						/>
						<View
							style={[
								styles.bar,
								{ width: "62%", height: 8, backgroundColor: colors.muted },
							]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (id === "attention") {
		if (layout === "cards") {
			return (
				<View style={styles.previewCopy}>
					{[0, 1].map((slot) => (
						<View
							key={slot}
							style={[
								styles.metricCard,
								{
									backgroundColor: colors.card,
									borderColor: colors.border,
								},
							]}
						>
							<View style={styles.previewRow}>
								<Ionicons
									name="alert-circle-outline"
									size={14}
									color={colors.warning}
									accessibilityElementsHidden
								/>
								<View
									style={[
										styles.bar,
										{ flex: 1, backgroundColor: colors.border },
									]}
								/>
							</View>
							<View
								style={[
									styles.queueButton,
									{ backgroundColor: colors.primary },
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		if (layout === "chips") {
			return (
				<View style={styles.previewRow}>
					{[64, 48, 56].map((width) => (
						<View
							key={width}
							style={[styles.chip, { width, backgroundColor: colors.muted }]}
						/>
					))}
				</View>
			);
		}
		return (
			<View style={styles.previewCopy}>
				{[0, 1].map((slot) => (
					<View key={slot} style={styles.previewRow}>
						<View
							style={[
								styles.attentionRail,
								{ backgroundColor: colors.warning },
							]}
						/>
						<View
							style={[styles.bar, { flex: 1, backgroundColor: colors.border }]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (id === "queue") {
		const samples = [
			{ key: "delivery", icon: "bicycle-outline" as const },
			{ key: "pickup", icon: "storefront-outline" as const },
		];
		if (layout === "cards") {
			return (
				<View style={styles.previewCopy}>
					{samples.map((sample) => (
						<View
							key={sample.key}
							style={[
								styles.metricCard,
								{
									backgroundColor: colors.card,
									borderColor: colors.border,
								},
							]}
						>
							<View style={styles.queueRow}>
								<Ionicons
									name={sample.icon}
									size={16}
									color={colors.primary}
									accessibilityElementsHidden
								/>
								<View
									style={[
										styles.bar,
										{ flex: 1, backgroundColor: colors.border },
									]}
								/>
							</View>
							<View
								style={[
									styles.queueButton,
									{ alignSelf: "flex-start", backgroundColor: colors.primary },
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		if (layout === "compact") {
			return (
				<View style={styles.previewCopy}>
					{samples.map((sample) => (
						<View key={sample.key} style={styles.queueCompact}>
							<Ionicons
								name={sample.icon}
								size={14}
								color={colors.primary}
								accessibilityElementsHidden
							/>
							<View
								style={[
									styles.bar,
									{ flex: 1, backgroundColor: colors.border },
								]}
							/>
							<View
								style={[
									styles.queueButton,
									{ backgroundColor: colors.primary },
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		return (
			<View style={styles.previewCopy}>
				{samples.map((sample) => (
					<View key={sample.key} style={styles.queueRow}>
						<View
							style={[styles.queueMark, { backgroundColor: colors.primary }]}
						/>
						<Ionicons
							name={sample.icon}
							size={16}
							color={colors.foreground}
							accessibilityElementsHidden
						/>
						<View style={styles.previewCopy}>
							<View
								style={[
									styles.bar,
									{ width: "72%", backgroundColor: colors.border },
								]}
							/>
							<View
								style={[
									styles.bar,
									{ width: "42%", backgroundColor: colors.muted },
								]}
							/>
						</View>
						<View
							style={[styles.queueButton, { backgroundColor: colors.primary }]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (id === "commands") {
		if (layout === "stack") {
			return (
				<View style={styles.previewCopy}>
					{[0, 1, 2].map((slot) => (
						<View
							key={slot}
							style={[
								styles.commandStack,
								styles.previewRow,
								{
									backgroundColor: slot === 0 ? colors.primary : colors.muted,
									paddingHorizontal: 6,
								},
							]}
						>
							<View
								style={[
									styles.commandDot,
									{
										backgroundColor:
											slot === 0 ? colors.primaryForeground : colors.border,
									},
								]}
							/>
							<View
								style={[
									styles.bar,
									{
										flex: 1,
										backgroundColor:
											slot === 0 ? colors.primaryForeground : colors.border,
									},
								]}
							/>
						</View>
					))}
				</View>
			);
		}
		if (layout === "wrap") {
			return (
				<View style={styles.previewGrid}>
					{[0, 1, 2, 3].map((slot) => (
						<View
							key={slot}
							style={[styles.commandCell, { backgroundColor: colors.muted }]}
						/>
					))}
				</View>
			);
		}
		return (
			<View style={[styles.commandRail, { backgroundColor: colors.card }]}>
				{[0, 1, 2, 3, 4].map((slot) => (
					<View
						key={slot}
						style={[
							styles.commandDot,
							{
								backgroundColor: slot === 0 ? colors.primary : colors.muted,
							},
						]}
					/>
				))}
			</View>
		);
	}
	if (layout === "rail") {
		return (
			<View style={styles.previewRow}>
				{PREVIEW_SLOTS.slice(0, Math.min(3, productCount)).map((slot) => (
					<View key={slot} style={styles.previewCopy}>
						<View
							style={[styles.productTile, { backgroundColor: colors.muted }]}
						/>
						<View
							style={[
								styles.bar,
								{ width: "80%", backgroundColor: colors.border },
							]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (layout === "tiles") {
		return (
			<View style={styles.previewRow}>
				{PREVIEW_SLOTS.slice(0, Math.min(3, productCount)).map((slot) => (
					<View
						key={slot}
						style={[styles.productTile, { backgroundColor: colors.muted }]}
					/>
				))}
			</View>
		);
	}
	return (
		<View style={styles.previewCopy}>
			{PREVIEW_SLOTS.slice(0, Math.min(3, productCount)).map((slot) => (
				<View key={slot} style={styles.previewRow}>
					<View style={[styles.thumb, { backgroundColor: colors.muted }]} />
					<View
						style={[styles.bar, { flex: 1, backgroundColor: colors.border }]}
					/>
				</View>
			))}
		</View>
	);
}

/** Cover vs compact as two pictures of the shop header, not a pair of text buttons. */
export function HeaderStylePicker({
	value,
	onChange,
}: {
	value: "cover" | "compact";
	onChange: (next: "cover" | "compact") => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	return (
		<View style={styles.headerRow}>
			<Pressable
				onPress={() => {
					selection();
					onChange("cover");
				}}
				accessibilityRole="button"
				accessibilityState={{ selected: value === "cover" }}
				accessibilityLabel={t("customize.cover")}
				style={[
					styles.headerCard,
					{
						borderColor: value === "cover" ? colors.primary : colors.border,
						backgroundColor: colors.card,
					},
				]}
			>
				<View style={[styles.coverSketch, { backgroundColor: colors.accent }]}>
					<LinearGradient
						colors={[`${colors.background}00`, colors.background]}
						style={StyleSheet.absoluteFill}
						pointerEvents="none"
					/>
					<View style={[styles.logoDot, { backgroundColor: colors.card }]} />
				</View>
				<Text variant="caption" bold>
					{t("customize.cover")}
				</Text>
			</Pressable>
			<Pressable
				onPress={() => {
					selection();
					onChange("compact");
				}}
				accessibilityRole="button"
				accessibilityState={{ selected: value === "compact" }}
				accessibilityLabel={t("customize.compact")}
				style={[
					styles.headerCard,
					{
						borderColor: value === "compact" ? colors.primary : colors.border,
						backgroundColor: colors.card,
					},
				]}
			>
				<View
					style={[styles.compactSketch, { backgroundColor: colors.primary }]}
				>
					<View
						style={[
							styles.logoDotSmall,
							{ backgroundColor: colors.primaryForeground },
						]}
					/>
					<View style={styles.compactCopy}>
						<View
							style={[
								styles.bar,
								{
									width: "80%",
									backgroundColor: colors.primaryForeground,
								},
							]}
						/>
						<View
							style={[
								styles.bar,
								{
									width: "50%",
									backgroundColor: colors.primaryForeground,
									opacity: 0.55,
								},
							]}
						/>
					</View>
				</View>
				<Text variant="caption" bold>
					{t("customize.compact")}
				</Text>
			</Pressable>
		</View>
	);
}

const PULSE_LAYOUT_LABELS: Record<DashboardLayouts["pulse"], MessageKey> = {
	band: "customize.layout.band",
	cards: "customize.layout.cards",
	hero: "customize.layout.hero",
	stack: "customize.layout.stack",
};

export function PulseLayoutPicker({
	value,
	onChange,
	metricCount,
}: {
	value: DashboardLayouts["pulse"];
	onChange: (next: DashboardLayouts["pulse"]) => void;
	metricCount: number;
}) {
	const { t } = useT();
	const card = (layout: DashboardLayouts["pulse"]) => (
		<VisualChoiceCard
			key={layout}
			selected={value === layout}
			label={t(PULSE_LAYOUT_LABELS[layout])}
			onPress={() => onChange(layout)}
		>
			<DashboardWidgetPreview
				id="pulse"
				layout={layout}
				metricCount={metricCount}
				productCount={3}
				shortcutCount={4}
			/>
		</VisualChoiceCard>
	);
	return (
		<View style={styles.pulsePicker}>
			<View style={styles.densityRow}>
				{card("band")}
				{card("cards")}
			</View>
			<View style={styles.densityRow}>
				{card("hero")}
				{card("stack")}
			</View>
		</View>
	);
}

export function DensityToggle({
	compactSelected,
	detailedSelected = !compactSelected,
	compactPreview,
	detailedPreview,
	onCompact,
	onDetailed,
}: {
	compactSelected: boolean;
	detailedSelected?: boolean;
	compactPreview: ReactNode;
	detailedPreview: ReactNode;
	onCompact: () => void;
	onDetailed: () => void;
}) {
	const { t } = useT();
	return (
		<View style={styles.densityRow}>
			<VisualChoiceCard
				selected={compactSelected}
				label={t("customize.density.compact")}
				onPress={onCompact}
			>
				{compactPreview}
			</VisualChoiceCard>
			<VisualChoiceCard
				selected={detailedSelected}
				label={t("customize.density.detailed")}
				onPress={onDetailed}
			>
				{detailedPreview}
			</VisualChoiceCard>
		</View>
	);
}

export function WidgetLayoutPicker<T extends string>({
	value,
	options,
	onChange,
	render,
}: {
	value: T;
	options: readonly { id: T; label: MessageKey }[];
	onChange: (next: T) => void;
	render: (id: T) => ReactNode;
}) {
	const { t } = useT();
	return (
		<View style={styles.layoutGrid}>
			{options.map((option) => (
				<View key={option.id} style={styles.layoutCell}>
					<VisualChoiceCard
						selected={value === option.id}
						label={t(option.label)}
						onPress={() => onChange(option.id)}
					>
						{render(option.id)}
					</VisualChoiceCard>
				</View>
			))}
		</View>
	);
}

export function VisualChoiceCard({
	selected,
	label,
	accessibilityLabel,
	onPress,
	children,
}: {
	selected: boolean;
	label: string;
	accessibilityLabel?: string;
	onPress: () => void;
	children: ReactNode;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={() => {
				selection();
				onPress();
			}}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			accessibilityLabel={accessibilityLabel ?? label}
			style={[
				styles.choiceCard,
				{
					borderColor: selected ? colors.primary : colors.border,
					backgroundColor: colors.card,
				},
			]}
		>
			{children}
			<Text variant="caption" bold>
				{label}
			</Text>
		</Pressable>
	);
}

export function ProductCountPicker({
	value,
	onChange,
}: {
	value: 3 | 6 | 9;
	onChange: (next: 3 | 6 | 9) => void;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	return (
		<View style={styles.headerRow}>
			{([3, 6, 9] as const).map((count) => (
				<VisualChoiceCard
					key={count}
					selected={value === count}
					label={String(count)}
					accessibilityLabel={t("customize.productCountOption", { count })}
					onPress={() => onChange(count)}
				>
					<View style={styles.countSketch}>
						{PREVIEW_SLOTS.slice(0, count).map((slot) => (
							<View
								key={slot}
								style={[styles.countThumb, { backgroundColor: colors.muted }]}
							/>
						))}
					</View>
				</VisualChoiceCard>
			))}
		</View>
	);
}

export function PaletteChip({
	themeId,
	scheme,
	inheritFill,
}: {
	themeId: BusinessThemeId | null | undefined;
	scheme: ColorScheme;
	inheritFill: string;
}) {
	const { colors } = useTheme();
	const fill = themeId
		? businessThemeColors(themeId, scheme).primary
		: inheritFill;
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no"
			style={[
				styles.paletteDot,
				{
					backgroundColor: fill,
					borderColor: colors.border,
				},
			]}
		/>
	);
}

export function WidgetPaletteStrip({
	value,
	scheme,
	onChange,
	label,
}: {
	value: string | null | undefined;
	scheme: ColorScheme;
	onChange: (next: string | null) => void;
	label?: string;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	return (
		<View style={styles.paletteBlock}>
			{label ? (
				<Text variant="caption" tone="muted">
					{label}
				</Text>
			) : null}
			<Text variant="label" bold>
				{value
					? t(`biz.theme.${value}` as MessageKey)
					: t("customize.paintInherit")}
			</Text>
			<View style={styles.paletteRow}>
				<Pressable
					onPress={() => {
						selection();
						onChange(null);
					}}
					accessibilityRole="button"
					accessibilityState={{ selected: value === null }}
					accessibilityLabel={t("customize.paintInherit")}
					style={styles.paletteTarget}
				>
					<View
						style={[
							styles.paletteDot,
							{
								backgroundColor: colors.muted,
								borderColor: value === null ? colors.foreground : colors.border,
							},
						]}
					/>
				</Pressable>
				{businessThemeOrder().map((id) => {
					const theme = businessThemeColors(id, scheme);
					return (
						<Pressable
							key={id}
							onPress={() => {
								selection();
								onChange(id);
							}}
							accessibilityRole="button"
							accessibilityState={{ selected: value === id }}
							accessibilityLabel={t(`biz.theme.${id}` as MessageKey)}
							style={styles.paletteTarget}
						>
							<View
								style={[
									styles.paletteDot,
									{
										backgroundColor: theme.primary,
										borderColor:
											value === id ? colors.foreground : theme.primary,
									},
								]}
							/>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

export function ThemeSwatchPicker({
	value,
	scheme,
	onChange,
}: {
	value: string | null;
	scheme: ColorScheme;
	onChange: (next: string | null) => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	return (
		<View style={styles.swatchWrap}>
			<VisualChoiceCard
				selected={value === null}
				label={t("customize.appTheme")}
				onPress={() => onChange(null)}
			>
				<View style={[styles.themeWash, { backgroundColor: colors.muted }]}>
					<View
						style={[styles.themeBand, { backgroundColor: colors.foreground }]}
					/>
				</View>
			</VisualChoiceCard>
			{businessThemeOrder().map((id) => {
				const theme = businessThemeColors(id, scheme);
				return (
					<VisualChoiceCard
						key={id}
						selected={value === id}
						label={id}
						onPress={() => onChange(id)}
					>
						<View
							style={[styles.themeWash, { backgroundColor: theme.background }]}
						>
							<View
								style={[styles.themeBand, { backgroundColor: theme.primary }]}
							/>
						</View>
					</VisualChoiceCard>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	board: { gap: space.lg },
	tile: {
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: space.lg,
		gap: space.md,
		minHeight: 88,
		overflow: "visible",
	},
	tileDense: {
		minHeight: MIN_TOUCH_TARGET,
		padding: space.sm,
		justifyContent: "center",
	},
	tileHead: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	tileTitle: { flex: 1 },
	remove: {
		position: "absolute",
		top: -10,
		left: -10,
		width: REMOVE_SIZE,
		height: REMOVE_SIZE,
		minWidth: REMOVE_SIZE,
		minHeight: REMOVE_SIZE,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	tray: { gap: space.md, paddingTop: space.sm },
	trayRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
	addWell: {
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderRadius: radius.lg,
		minWidth: 96,
		minHeight: 88,
		padding: space.sm,
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
	},
	done: {
		alignSelf: "center",
		paddingHorizontal: space.xl,
		paddingVertical: space.sm,
		borderRadius: radius.full,
		minHeight: MIN_TOUCH_TARGET,
		justifyContent: "center",
	},
	previewRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	previewCopy: { flex: 1, gap: space.xs },
	bar: { height: 6, borderRadius: radius.full },
	avatar: { width: 36, height: 36, borderRadius: radius.full },
	pill: {
		height: 22,
		width: 72,
		borderRadius: radius.full,
	},
	offerCard: {
		flex: 1,
		height: 64,
		borderRadius: radius.md,
		borderWidth: 1,
		justifyContent: "flex-end",
		padding: space.sm,
	},
	productTile: {
		flex: 1,
		height: 44,
		borderRadius: radius.md,
	},
	shortcut: {
		width: 36,
		height: 36,
		borderRadius: radius.md,
	},
	metric: {
		flex: 1,
		gap: space.xs,
		padding: space.sm,
		borderRadius: radius.md,
	},
	thumb: { width: 28, height: 28, borderRadius: radius.sm },
	headerRow: { flexDirection: "row", gap: space.sm },
	headerCard: {
		flex: 1,
		gap: space.sm,
		padding: space.sm,
		borderWidth: 2,
		borderRadius: radius.lg,
	},
	coverSketch: {
		height: 72,
		borderRadius: radius.md,
		overflow: "hidden",
		justifyContent: "flex-end",
		padding: space.sm,
	},
	compactSketch: {
		height: 44,
		borderRadius: radius.md,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.sm,
	},
	logoDot: {
		width: 28,
		height: 28,
		borderRadius: radius.full,
	},
	logoDotSmall: {
		width: 20,
		height: 20,
		borderRadius: radius.full,
	},
	compactCopy: { flex: 1, gap: 4 },
	previewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.sm,
	},
	pulseBand: {
		flexDirection: "row",
		gap: space.sm,
		padding: space.sm,
		borderRadius: radius.md,
	},
	pulsePicker: { gap: space.md },
	pulseHero: { flexDirection: "column" },
	pulseStackRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: space.xs,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	metricCard: {
		flex: 1,
		gap: space.xs,
		padding: space.sm,
		borderRadius: radius.md,
		borderWidth: 1,
	},
	insightBandCell: { flex: 1, gap: 4 },
	insightStackRow: {
		gap: space.xs,
		paddingBottom: space.xs,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	chip: {
		height: 22,
		borderRadius: radius.full,
	},
	attentionRail: {
		width: 4,
		height: 22,
		borderRadius: radius.full,
	},
	queueRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	queueMark: {
		width: 8,
		height: 28,
		borderRadius: radius.full,
	},
	queueCompact: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		minHeight: 28,
	},
	queueButton: {
		width: 36,
		height: 16,
		borderRadius: radius.full,
	},
	commandRail: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: space.sm,
		borderRadius: radius.md,
	},
	commandDot: {
		width: 22,
		height: 22,
		borderRadius: radius.sm,
	},
	commandCell: {
		width: 36,
		height: 28,
		borderRadius: radius.sm,
	},
	commandStack: {
		minHeight: 28,
		borderRadius: radius.sm,
		alignItems: "center",
		paddingVertical: space.xs,
	},
	layoutGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginHorizontal: -space.sm,
	},
	layoutCell: { width: "50%", padding: space.sm },
	choiceCard: {
		flex: 1,
		minWidth: 0,
		minHeight: MIN_TOUCH_TARGET,
		gap: space.sm,
		padding: space.md,
		borderWidth: 2,
		borderRadius: radius.lg,
	},
	densityRow: { flexDirection: "row", gap: space.md },
	countSketch: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 4,
		minHeight: 44,
	},
	countThumb: {
		width: 18,
		height: 18,
		borderRadius: radius.sm,
	},
	swatchWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.md,
	},
	themeWash: {
		height: 44,
		borderRadius: radius.md,
		overflow: "hidden",
		justifyContent: "flex-end",
	},
	themeBand: {
		height: 12,
		width: "100%",
	},
	paletteBlock: { gap: space.sm },
	paletteRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.xs,
		alignItems: "center",
	},
	paletteTarget: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	paletteDot: {
		width: 28,
		height: 28,
		borderRadius: radius.full,
		borderWidth: 2,
	},
});
