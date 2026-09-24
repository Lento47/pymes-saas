import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { PRESS_SCALE_ROW } from "@/lib/motion";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * One line in a list: a thing on the left, the fact on the right.
 *
 * Every row is at least 44 points tall, including the ones that hold a single short word.
 * A settings list is where this is easiest to get wrong — the rows look right at 32 and
 * the only person who notices is the one trying to tap one while walking.
 *
 * The chevron is drawn only when the row opens something, because a chevron on a row that
 * does nothing is a promise the row does not keep. When it is drawn it is `mutedForeground`,
 * so it reads as an affordance rather than as content, and the row is still announced by its
 * own label rather than by "chevron".
 *
 * ## A row is a surface, so its corner is `radius.md`
 *
 * The corner was `radius.sm` — 6, the step `docs/design.md` reserves for *controls*. A row is
 * not a control with a word in it: it is a surface, the same category as a card, a popover and
 * a table row, and that category's step is `radius.md`. On an undivided row the pressed fill
 * is the only place the corner shows, which is exactly why it went unnoticed.
 *
 * The divider is where that stopped being true. A hairline follows the corner it is drawn on,
 * so `radius.md` under the default divider bent the rule upward over the ~12pt arc at each
 * end instead of running straight. `./product-row` draws its group-box hairline straight and
 * documents why — "the row has no corner of its own" — and a row that shares its line is in
 * the same position at the line's end: while the divider is on, the bottom corners go square
 * (`styles.divided`) so the rule runs true. The top corners keep the surface step, and a
 * standalone undivided row (`app/inbox`) keeps all four, because there its pressed fill is
 * the surface's own edge.
 *
 * ## Three slots, and why `thumbnail` is not `leading`
 *
 * `leading` is a node that hugs its own content — a status dot, a 24-point glyph. `thumbnail`
 * is a *box*: a fixed square of media at the head of the row, sized by the `media` token, filled
 * `muted` and hidden from the accessibility tree because the row's own label already names what
 * is in it. The two are separate props because a caller that put a picture into `leading` would
 * be choosing a size at the call site, which is the decision `media` exists to have already made.
 *
 * `state` is the third: a **word** that states a fact about this row — "Predeterminada" on a
 * saved address — set in `caption` beside the title rather than as a tint, a dot or a border.
 * `docs/design.md`'s rule is that colour is never the only signal, and the cheapest way to obey
 * it is to make the signal a word; a reader with a colour vision deficiency, a greyscale
 * screenshot and a screen reader all get the same answer from one string.
 *
 * ## `divider`, for a row that shares its line
 *
 * The hairline under the row belongs to the row. A list where each line is a row *and* a control
 * beside it — a saved address with its delete button — has its line owned by the container that
 * spans both, and the row inside it passes `divider={false}` so there is one hairline rather
 * than one that stops short of the button. It is a prop rather than a `borderBottomWidth: 0` at
 * the call site because a screen places a component and does not restyle one.
 */
export function ListRow({
	title,
	subtitle,
	thumbnail,
	leading,
	state,
	trailing,
	onPress,
	onLongPress,
	accessibilityLabel,
	accessibilityHint,
	accessibilityRole = "button",
	destructive = false,
	chevron = false,
	divider = true,
	style,
}: {
	title: string;
	subtitle?: string;
	/**
	 * A fixed square of media at the head of the row — `media.row`, the same box
	 * `./product-row` draws its picture in. Decorative: the row's label names the thing.
	 */
	thumbnail?: React.ReactNode;
	leading?: React.ReactNode;
	/**
	 * A word stating a fact about this row, drawn beside the title. Never a tint on its own —
	 * see the note above. It joins the row's accessibility label, so a reader hears it too.
	 */
	state?: string;
	trailing?: React.ReactNode;
	onPress?: () => void;
	onLongPress?: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	accessibilityRole?: "button" | "link" | "none";
	destructive?: boolean;
	chevron?: boolean;
	/** The hairline under the row. Off when a container around it owns the line instead. */
	divider?: boolean;
	style?: React.ComponentProps<typeof View>["style"];
}) {
	const { colors } = useTheme();

	// A comma is punctuation rather than copy, so the two parts are joined here rather than
	// through a key that would need translating into a language that separates them the same
	// way. The state is a fact about the row and is read after its name, which is the order
	// the row is drawn in.
	const label = accessibilityLabel ?? (state ? `${title}, ${state}` : title);

	const content = (
		<>
			{thumbnail ? (
				// Hidden from the tree: the row's label already names the address, and an
				// unlabelled image beside every line is what a reader hears instead of it.
				<View
					style={[styles.thumbnail, { backgroundColor: colors.muted }]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					{thumbnail}
				</View>
			) : null}
			{leading ? <View style={styles.leading}>{leading}</View> : null}
			<View style={styles.body}>
				<View style={styles.titleRow}>
					<Text
						variant="body"
						tone={destructive ? "destructive" : "default"}
						bold
						style={styles.title}
					>
						{title}
					</Text>
					{state ? (
						// `baseline` rather than `center`: `baseline` sits the state on the line the
						// title *starts* on however many lines the title ends up taking, where `center`
						// would float it in the middle of the block.
						<Text variant="caption" tone="muted" bold>
							{state}
						</Text>
					) : null}
				</View>
				{subtitle ? (
					<Text variant="label" tone="muted">
						{subtitle}
					</Text>
				) : null}
			</View>
			{trailing ? <View style={styles.trailing}>{trailing}</View> : null}
			{chevron ? (
				<Ionicons
					name="chevron-forward"
					size={icon.control}
					color={colors.mutedForeground}
					// The chevron is decoration. Without this it is announced as an
					// unlabelled image next to every row in the list.
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : null}
		</>
	);

	if (!onPress && !onLongPress) {
		return (
			<View
				style={[
					styles.row,
					{ borderBottomColor: colors.border },
					divider ? styles.divided : styles.undivided,
					style,
				]}
				accessibilityRole={accessibilityRole === "none" ? undefined : "text"}
				accessibilityLabel={label}
			>
				{content}
			</View>
		);
	}

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			// A row's edges are the screen's edges, so it moves the smaller 2%: at 3% the
			// whole screen reads as having shifted rather than the one row that was pressed.
			scaleTo={PRESS_SCALE_ROW}
			accessibilityRole={
				accessibilityRole === "none" ? undefined : accessibilityRole
			}
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			style={({ pressed }) => [
				styles.row,
				{ borderBottomColor: colors.border },
				divider ? styles.divided : styles.undivided,
				// The pressed background stays a colour rather than becoming the primitive's
				// dim, because a row is mostly empty space: a 10% opacity change across a
				// full-width row is the one press answer that is easy to miss.
				pressed && { backgroundColor: colors.muted },
				style,
			]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderRadius: radius.md,
	},
	undivided: { borderBottomWidth: 0 },
	// Square bottom corners while the divider draws — see "A row is a surface", above: the
	// hairline follows the corner it is drawn on, and a `radius.md` arc at each end bent it
	// off the line it was drawing. The same alignment `./product-row` states for its rows.
	divided: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
	thumbnail: {
		width: media.row,
		height: media.row,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		// The square is `media.row`, so a glyph that overflows it is clipped rather than
		// drawing a rectangle taller than the row that owns it.
		overflow: "hidden",
	},
	leading: { justifyContent: "center" },
	body: { flex: 1, gap: TEXT_STACK_GAP },
	// The title and the state share one line and wrap together at 200% text, so neither is
	// squeezed to nothing and neither is truncated to save the layout.
	//
	// That last clause is the correction, not the description: both `Text`s in this row carried
	// `numberOfLines={2}` while the sentence above claimed they did not, and the two were not
	// the same kind of string. The title is an address label (`app/addresses.tsx:233`,
	// `title={address.label}`) or an
	// app string (`./promo-input:193`), and the subtitle is `line1, city` or a promo's detail —
	// so a three-line address label at 200% text got an ellipsis on a row whose whole job is
	// naming where a delivery goes. `docs/design-mobile.md:109-110` keeps `numberOfLines` for
	// truncating data and never for saving a layout; the row has `minHeight` and no fixed
	// height, so wrapping is what it does instead.
	titleRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.sm,
		flexWrap: "wrap",
	},
	title: { flexShrink: 1 },
	trailing: { alignItems: "flex-end" },
});
