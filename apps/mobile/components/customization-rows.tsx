import type { MessageKey } from "@pymeshub/i18n";
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
import { LinearGradient } from "expo-linear-gradient";

import { duration, spring } from "@/lib/motion";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/reduced-motion";
import { moveItem } from "@/lib/reorder";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable, hitSlopFor } from "./pressable";
import { Text } from "./text";

export { moveItem } from "@/lib/reorder";

const REMOVE_SIZE = 28;
const SWAP_DISTANCE = 36;

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
	renderPreview,
}: {
	items: readonly T[];
	hidden: readonly T[];
	labels: Record<T, MessageKey>;
	onReorder: (next: T[]) => void;
	onToggle: (item: T) => void;
	renderPreview?: (item: T) => ReactNode;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const reduced = useReducedMotion();
	const [editing, setEditing] = useState(false);
	const visible = items.filter((item) => !hidden.includes(item));
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
			<Text variant="caption" tone="muted">
				{editing ? t("customize.editing") : t("customize.holdToMove")}
			</Text>
			{visible.map((item, index) => (
				<WidgetTile
					key={item}
					editing={editing}
					reduced={reduced}
					label={t(labels[item])}
					onEnterEdit={enterEdit}
					onRemove={() => onToggle(item)}
					onMove={(direction) =>
						onReorder(moveItem(items, items.indexOf(item), direction, hidden))
					}
					canMoveUp={index > 0}
					canMoveDown={index < visible.length - 1}
				>
					{renderPreview?.(item) ?? null}
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
								<Text variant="caption" numberOfLines={2}>
									{t(labels[item])}
								</Text>
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
					<Text variant="label" bold style={{ color: colors.primaryForeground }}>
						{t("customize.done")}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function WidgetTile({
	editing,
	reduced,
	label,
	children,
	onEnterEdit,
	onRemove,
	onMove,
	canMoveUp,
	canMoveDown,
}: {
	editing: boolean;
	reduced: boolean;
	label: string;
	children: ReactNode;
	onEnterEdit: () => void;
	onRemove: () => void;
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
		.minDuration(380)
		.onStart(() => {
			runOnJS(onEnterEdit)();
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
			drag.value = withSpring(0, spring.layout);
			if (direction !== 0) runOnJS(move)(direction);
		});

	const animated = useAnimatedStyle(() => ({
		transform: [
			{ translateY: drag.value },
			{ rotate: `${wiggle.value}deg` },
		],
		zIndex: drag.value === 0 ? 0 : 2,
	}));

	return (
		<GestureDetector gesture={Gesture.Simultaneous(longPress, pan)}>
			<Animated.View
				style={[
					styles.tile,
					{
						backgroundColor: colors.card,
						borderColor: colors.border,
					},
					animated,
				]}
				accessibilityLabel={label}
				accessibilityHint={
					editing ? t("customize.editing") : t("customize.holdToMove")
				}
			>
				<Text variant="label" bold>
					{label}
				</Text>
				{children}
				{editing ? (
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
				<View
					style={[styles.avatar, { backgroundColor: colors.muted }]}
				/>
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
				<View
					style={[styles.pill, { backgroundColor: colors.primary }]}
				/>
				<View
					style={[styles.pill, { backgroundColor: colors.muted }]}
				/>
			</View>
		);
	}
	return (
		<View style={styles.previewRow}>
			{[0, 1, 2].map((slot) => (
				<View
					key={slot}
					style={[styles.productTile, { backgroundColor: colors.muted }]}
				/>
			))}
		</View>
	);
}

/** Tiny dashboard sketches so each widget looks like a different job. */
export function DashboardWidgetPreview({
	id,
}: {
	id: "shortcuts" | "pulse" | "insights" | "catalog";
}) {
	const { colors } = useTheme();
	if (id === "shortcuts") {
		return (
			<View style={styles.previewRow}>
				{[0, 1, 2, 3].map((slot) => (
					<View
						key={slot}
						style={[styles.shortcut, { backgroundColor: colors.muted }]}
					/>
				))}
			</View>
		);
	}
	if (id === "pulse") {
		return (
			<View style={styles.previewRow}>
				{[0, 1, 2].map((slot) => (
					<View
						key={slot}
						style={[styles.metric, { backgroundColor: colors.muted }]}
					>
						<View
							style={[
								styles.bar,
								{ width: "50%", backgroundColor: colors.border },
							]}
						/>
						<View
							style={[
								styles.bar,
								{
									width: "78%",
									height: 8,
									backgroundColor: colors.foreground,
								},
							]}
						/>
					</View>
				))}
			</View>
		);
	}
	if (id === "insights") {
		return (
			<View style={styles.previewCopy}>
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
		);
	}
	return (
		<View style={styles.previewCopy}>
			{[0, 1, 2].map((slot) => (
				<View key={slot} style={styles.previewRow}>
					<View
						style={[styles.thumb, { backgroundColor: colors.muted }]}
					/>
					<View
						style={[
							styles.bar,
							{ flex: 1, backgroundColor: colors.border },
						]}
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
						borderColor:
							value === "cover" ? colors.primary : colors.border,
						backgroundColor: colors.card,
					},
				]}
			>
				<View
					style={[styles.coverSketch, { backgroundColor: colors.accent }]}
				>
					<LinearGradient
						colors={[`${colors.background}00`, colors.background]}
						style={StyleSheet.absoluteFill}
						pointerEvents="none"
					/>
					<View
						style={[styles.logoDot, { backgroundColor: colors.card }]}
					/>
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
						borderColor:
							value === "compact" ? colors.primary : colors.border,
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

const styles = StyleSheet.create({
	board: { gap: space.md },
	tile: {
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: space.md,
		gap: space.sm,
		minHeight: 88,
		overflow: "visible",
	},
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
	tray: { gap: space.sm },
	trayRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
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
});
