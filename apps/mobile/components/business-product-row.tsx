import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProductCard } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import {
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Image } from "./image";
import { Pressable } from "./pressable";
import { Price } from "./price";
import { Text } from "./text";

export function BusinessProductRow({
	product,
	onPress,
	featured = false,
}: {
	product: ProductCard;
	onPress: () => void;
	featured?: boolean;
}) {
	const { t } = useT();
	const { colors } = useTheme();

	/*
	 * **The row carries no stock control, and that is the design.**
	 *
	 * Stock used to live here three different ways — a switch, a stepper, and a bordered chip
	 * that opened a numeric box — and every one of them fought the price for the same few
	 * points of width. On a list of thirty products that is the difference between a menu an
	 * owner can scan in one pass and a menu they read one cramped line at a time.
	 *
	 * It now belongs to `app/(business)/product-form`, which is the screen that edits a
	 * product: the count is a field there, beside the other fields it is saved with, rather
	 * than a control bolted onto a list row whose whole job is to be scanned. The row keeps
	 * what a scan needs — the name and the price — and the pen in the corner is the door.
	 */
	const stockText =
		(product.availability.quantity ?? 0) > 0
			? t("biz.products.stockCount", {
					count: product.availability.quantity ?? 0,
				})
			: t("biz.products.outOfStock");

	if (featured) {
		return (
			<View style={[styles.featured, { borderColor: colors.border }]}>
				<Image
					uri={product.imageUrl}
					style={styles.featuredImage}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<View style={styles.featuredCopy}>
					<View style={styles.featuredText}>
						<Pressable onPress={onPress} style={styles.titlePress}>
							<Text variant="heading" bold>
								{product.title}
							</Text>
						</Pressable>
						<EditPen label={t("biz.products.edit")} onPress={onPress} />
					</View>
					<View style={styles.featuredMeta}>
						<Price
							amountMinor={product.priceMinor}
							currency={product.currency}
							variant="heading"
						/>
						<Text
							variant="caption"
							tone={product.availability.quantity ? "muted" : "destructive"}
						>
							{stockText}
						</Text>
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.row, { borderColor: colors.border }]}>
			<Image
				uri={product.imageUrl}
				style={styles.thumbnail}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<View style={styles.rowCopy}>
				<View style={styles.rowPressable}>
					<Pressable onPress={onPress} style={styles.titlePress}>
						<Text bold>{product.title}</Text>
					</Pressable>
					<EditPen label={t("biz.products.edit")} onPress={onPress} />
				</View>
				<View style={styles.rowActions}>
					<Price
						amountMinor={product.priceMinor}
						currency={product.currency}
						variant="body"
					/>
					<Text
						variant="caption"
						tone={product.availability.quantity ? "muted" : "destructive"}
					>
						{stockText}
					</Text>
				</View>
			</View>
		</View>
	);
}

/**
 * The row's edit door, and why it is a bare pen rather than a labelled button.
 *
 * The button this replaced carried the word "Editar" and cost a `size="sm"` pill — roughly
 * 90 points of the row's horizontal budget — for a control whose target is already the whole
 * row. On a list with twenty products that budget is the difference between the price, the
 * stock chip and the availability switch sharing one line and the switch dropping onto a
 * second. The pen is the convention this app already uses for the same verb on the stock
 * chip, so the row now teaches it once and repeats it.
 *
 * `accessibilityRole` and `accessibilityLabel` are what keep the icon from being the reason a
 * screen-reader user cannot edit a product: a pen alone is announced as "button", and the
 * label is the verb and the object.
 *
 * The 44-point box is `MIN_TOUCH_TARGET` with the glyph centred inside it, so the visible
 * mark is small but the target is not — the same reason `./switch` keeps a 48 box around a
 * 28-tall track.
 */
function EditPen({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors } = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			hitSlop={space.sm}
			style={styles.editPen}
		>
			<Ionicons name="create-outline" size={18} color={colors.foreground} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	featured: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.md,
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		borderWidth: 1,
		borderRadius: radius.md,
	},
	featuredImage: {
		width: 64,
		height: 64,
		borderRadius: radius.sm,
	},
	// One text stack, so it stacks at `TEXT_STACK_GAP` (2) rather than a `space` step.
	// `./business-card`, `./product-row` and `./list-row` all read their own title/meta/
	// price lines this way, and at `space.xs` the title and the price beneath it read as
	// two separate things instead of one card's contents.
	featuredCopy: { flex: 1, minWidth: 0, gap: TEXT_STACK_GAP },
	featuredText: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
	},
	// The price and the chip are not lines of one stack — one is a number and one is a
	// control — so they are spread apart rather than stacked, and the gap between them is
	// `space.xs` because it only ever shows up when the row wraps.
	featuredMeta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-start",
		flexWrap: "wrap",
		gap: space.xs,
	},

	row: {
		minHeight: 56,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.md,
		paddingVertical: space.sm,
		borderBottomWidth: 1,
	},
	rowPressable: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
	},
	titlePress: { flex: 1, minWidth: 0 },
	editPen: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	thumbnail: {
		width: 56,
		height: 56,
		borderRadius: radius.sm,
	},
	// Same stack as the featured card's: title, then price beside the chip. `TEXT_STACK_GAP`
	// is the gap *inside* this column; `space.sm` would say "these are two blocks".
	rowCopy: { flex: 1, minWidth: 0, gap: TEXT_STACK_GAP },
	rowActions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: space.xs,
	},
	/**
	 * The count and its pen.
	 *
	 * **The box is sized to the text, and the touch target is grown with `hitSlop` instead.**
	 * A `caption` is 12/16, so a chip carrying one needs `paddingVertical: space.xs` to be
	 * comfortable to look at — about 24 points tall. Padding it out to `MIN_TOUCH_TARGET`
	 * would make a bordered box taller than the 16-point price beside it and taller than the
	 * title above it, which is the opposite of a chip and reads as a button. `hitSlop` on the
	 * `Pressable` (below) gives the same 44-point reach without the border growing, which is
	 * the same trick `./switch` uses to keep a 28-point track tappable.
	 *
	 * `alignItems: "center"` centres the pen on the text's line box rather than on the
	 * border's, and `gap: space.xs` (4) sits the glyph one step off the number — close
	 * enough to read as one unit, far enough that it is not touching it.
	 */
	stockChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
		borderRadius: radius.sm,
		borderWidth: 1,
	},
});
