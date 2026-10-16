import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	LinearTransition,
} from "react-native-reanimated";

import { useT } from "@/lib/i18n";
import { duration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { icon, MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The owner console's shortcut strip: the doors, as icon tiles in a row that
 * scrolls sideways.
 *
 * `./merchant-command-rail`'s sibling and its opposite. That bar holds the
 * *moment's* actions — add one, pause the night — and one of them wears the
 * lime fill. This holds *destinations* — orders, catalogue, promotions — and
 * none of them is filled, because a destination is not asking to be pressed
 * now; it is somewhere the reader goes. Two filled tiles here would read as
 * two primary actions on one screen, and the bar below already spends the
 * lime on the one that is.
 *
 * Tiles and not rows because the set is small, closed and parallel: six
 * doors a thumb reaches by sliding, each a glyph-first tile with its word
 * beneath it. The word stays — icon-only tiles strand a reader who cannot
 * see the glyph and say nothing at 200% text — and it wraps to nothing: one
 * line, `numberOfLines={1}`, because a tile that grew a second line is the
 * wrap the horizontal axis exists to rule out.
 *
 * Nothing is rendered when there are no shortcuts — a hairline pair around
 * a shrug is not a strip, which is `./merchant-command-rail`'s rule and
 * holds here too.
 */
export type MerchantShortcut = {
	/** Stable identity for the tile, and the key the rail maps its items by. */
	key: string;
	label: string;
	/** A name from the Ionicons set — typed from the module, never a bare `string`. */
	icon: React.ComponentProps<typeof Ionicons>["name"];
	onPress: () => void;
};

export function MerchantShortcutRail({
	shortcuts,
	layout = "rail",
	paint = false,
	compact = false,
}: {
	shortcuts: MerchantShortcut[];
	layout?: "rail" | "grid" | "list";
	paint?: boolean;
	compact?: boolean;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const { fontScale } = useWindowDimensions();
	const reduceMotion = useReducedMotion();
	const [expanded, setExpanded] = useState(false);
	const columns = fontScale > 1.3 ? 2 : 4;

	if (shortcuts.length === 0) return null;

	const tiles = shortcuts.map((item) => (
		<Pressable
			key={item.key}
			onPress={item.onPress}
			accessibilityRole="button"
			accessibilityLabel={item.label}
			style={[styles.tile, layout === "grid" && styles.gridTile]}
		>
			{/* The disc is the visual and the word beneath names it: `accent`
			    behind `accentForeground` ink, the palette's quiet tinted pair —
			    the same one `./category-rail`'s tiles wear. A filled tile here
			    would compete with the command rail's lime moment below. */}
			<View
				style={[
					styles.disc,
					compact && styles.compactDisc,
					{
						backgroundColor: paint
							? colors.primary
							: compact
								? colors.card
								: colors.muted,
						borderColor: paint
							? colors.primary
							: compact
								? colors.card
								: colors.border,
					},
				]}
			>
				<Ionicons
					name={item.icon}
					size={compact ? 20 : icon.back}
					color={paint ? colors.primaryForeground : colors.foreground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
			<Text
				variant="caption"
				tone="muted"
				numberOfLines={compact || layout === "grid" ? undefined : 1}
				style={styles.tileLabel}
			>
				{item.label}
			</Text>
		</Pressable>
	));

	if (layout === "list") {
		return (
			<View style={styles.list} accessibilityRole="menubar">
				{shortcuts.map((item, index) => (
					<Pressable
						key={item.key}
						onPress={item.onPress}
						accessibilityRole="button"
						accessibilityLabel={item.label}
						style={[
							styles.listRow,
							index < shortcuts.length - 1 && {
								borderBottomWidth: StyleSheet.hairlineWidth,
								borderBottomColor: colors.border,
							},
						]}
					>
						<View
							style={[
								styles.listDisc,
								{
									backgroundColor: paint ? colors.primary : colors.muted,
									borderColor: paint ? colors.primary : colors.border,
								},
							]}
						>
							<Ionicons
								name={item.icon}
								size={icon.action}
								color={paint ? colors.primaryForeground : colors.foreground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
						<Text variant="body" numberOfLines={1} style={styles.listLabel}>
							{item.label}
						</Text>
						<Ionicons
							name="chevron-forward"
							size={icon.control}
							color={colors.mutedForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</Pressable>
				))}
			</View>
		);
	}

	if (layout === "grid") {
		const rows = [];
		for (let index = 0; index < tiles.length; index += columns) {
			const rowTiles = tiles.slice(index, index + columns);
			rows.push(
				<View key={shortcuts[index]?.key} style={styles.gridRow}>
					{rowTiles}
					{["first", "second", "third"]
						.slice(0, columns - rowTiles.length)
						.map((slot) => (
							<View key={slot} style={styles.gridTile} />
						))}
				</View>,
			);
		}
		const canExpand = rows.length > 1;
		const toggleLabel = t(
			expanded ? "biz.shortcuts.less" : "biz.shortcuts.more",
		);
		return (
			<Animated.View
				style={styles.grid}
				layout={
					reduceMotion
						? undefined
						: LinearTransition.duration(duration.standard)
				}
			>
				{rows[0]}
				{expanded && canExpand ? (
					<Animated.View
						style={styles.extraRows}
						entering={
							reduceMotion ? undefined : FadeIn.duration(duration.standard)
						}
						exiting={
							reduceMotion ? undefined : FadeOut.duration(duration.instant)
						}
					>
						{rows.slice(1)}
					</Animated.View>
				) : null}
				{canExpand ? (
					<Pressable
						onPress={() => setExpanded((value) => !value)}
						accessibilityRole="button"
						accessibilityLabel={`${toggleLabel}: ${t("customize.shortcuts")}`}
						accessibilityState={{ expanded }}
						style={styles.moreButton}
					>
						<Ionicons
							name={expanded ? "chevron-up" : "add"}
							size={icon.control}
							color={colors.action}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="caption" tone="action" bold>
							{toggleLabel}
						</Text>
					</Pressable>
				) : null}
			</Animated.View>
		);
	}

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.track}
			accessibilityRole="menubar"
			// Snap per tile-plus-gap: the strip settles on doors, not between them.
			snapToInterval={TILE + space.md}
			decelerationRate="fast"
		>
			{tiles}
		</ScrollView>
	);
}

/** 64 points square: the floor `./merchant-command-rail` names for a command. */
const TILE = 64;

const styles = StyleSheet.create({
	compactDisc: { width: 36, height: 36, borderRadius: radius.md },
	/** The scroll's content: the rail's own gutter and the gap tiles keep. */
	track: { paddingHorizontal: space.lg, gap: space.md, marginTop: space.md },
	tile: {
		width: TILE,
		alignItems: "center",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	disc: {
		width: TILE,
		height: TILE,
		borderRadius: radius.lg,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	tileLabel: { textAlign: "center" },
	grid: {
		paddingHorizontal: space.lg,
		gap: space.md,
		marginTop: space.md,
	},
	gridRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
	gridTile: { width: 0, flexBasis: 0, flexGrow: 1, minWidth: MIN_TOUCH_TARGET },
	extraRows: { gap: space.md },
	moreButton: {
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		paddingHorizontal: space.md,
		borderRadius: radius.md,
	},
	list: { paddingHorizontal: space.lg, marginTop: space.md },
	listRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
	},
	listDisc: {
		width: 36,
		height: 36,
		borderRadius: radius.md,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	listLabel: { flex: 1 },
});
