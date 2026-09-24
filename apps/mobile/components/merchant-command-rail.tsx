import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, StyleSheet, View } from "react-native";

import { icon, space, useTheme, weight as weights } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The owner console's command bar (interface.md §25): one horizontal row of the actions a
 * merchant home offers, riding full-bleed across the band — and not the five colourful
 * square cards the section retired. A row of tiles is a dashboard's answer to a page, and
 * the console is not a dashboard: the commands sit under the facts they act on, as a strip
 * on a `card` surface ruled by the page's own hairlines, rather than as boxes that each
 * demanded a frame. The bar is full-bleed by being given no margin of its own — the
 * hairlines run the screen's width — so where it sits in the band is the screen's decision
 * and not this file's.
 *
 * ## One lime item, and why the rest stay neutral
 *
 * An action with `primary` set is the moment's one filled control: a
 * `primary`/`primaryForeground` box inset `space.xs` inside the bar, so its 48 points of
 * fill sit inside the 56-point track the bar holds instead of reaching the hairlines. The
 * inset is the argument, not decoration — lime meeting the bar's own edges would redraw
 * the control as a section of the chrome, a band inside a bar, when §25's point is that
 * the lime reads as a control the finger lands on. That argument is the same one
 * interface.md §6 makes about the palette: the lime is reserved for the one thing asking
 * the operator to act, and it keeps that meaning only while it is one.
 *
 * Every other action stays neutral — no box, `mutedForeground` ink — because two filled
 * controls in one bar is already a question the bar cannot answer, and five is five
 * simultaneous moments with nothing receding. The neutrals keep their weight in the
 * glyph-and-label pair itself, and their pressed feedback is `./pressable`'s: the dim and
 * the scale are the answer, so a control with no fill of its own still visibly answers a
 * press. Nothing here branches on scheme — the bar is drawn from the merchant palette the
 * `(business)` tree hands every screen, and `ThemeColors` keys are all it names.
 *
 * ## Scroll, not wrap
 *
 * The actions ride a horizontal `ScrollView` (`showsHorizontalScrollIndicator` off, the
 * content container carrying the bar's own `space.xl` edges) so overflow scrolls instead
 * of wrapping: a command bar that wrapped is two bars, and the second is a row the reader
 * has to go and find. The count of actions is the screen's decision; the bar's height is
 * not, and scrolling is what keeps that true however many actions arrive.
 *
 * ## The measures
 *
 * Each item is a centred column — `icon.action`'s glyph (`theme/tokens.ts` names the step,
 * and it is the 20 the contract asks for) over an 11-point semibold label at `space.xs` —
 * on a 64-point minimum width that keeps the items in one rhythm, and a 56-point track
 * that clears `MIN_TOUCH_TARGET`'s 44 by construction. Both are floors rather than sizes,
 * so a label at 200% text grows the item it lives in; the label truncates at one line,
 * because a command item that grew a second line is the wrap this bar exists to rule out,
 * reached by another name. The 11 is §25's own size and the one the app's scale does not
 * hold — `type`'s smallest step is `caption` at 12, and `merchantType` adds figures and
 * titles, not a smaller label — so it is named here the way `./merchant-order-row` names
 * its chip's 11: the documented exception, not a fourth step.
 *
 * ## Reduced motion
 *
 * Nothing here animates itself. The scroll is a gesture rather than an animation, and the
 * press is `./pressable`'s, which takes its own scale off when the reader has asked for
 * less motion and leaves the dim carrying the answer. A reader who opted out still gets
 * the same bar, with the same ink and the same fill; what they are spared is only the
 * movement.
 *
 * Nothing is rendered when there are no actions — a hairline pair around a shrug is not a
 * bar.
 */
export type MerchantRailAction = {
	/** Stable identity for the action, and the key the bar maps its items by. */
	key: string;
	label: string;
	/** A name from the Ionicons set — typed from the module, never a bare `string`. */
	icon: React.ComponentProps<typeof Ionicons>["name"];
	onPress: () => void;
	/**
	 * The moment's one action. At most one item in a bar sets this: the lime's meaning
	 * (`interface.md` §6) is "this one, now", and two of them is no message at all.
	 */
	primary?: boolean;
};

/**
 * One command in the bar, drawn by whether it is the moment's one action.
 *
 * Both kinds are the same centred column on the same 56-point track — a bar whose items
 * also changed height would read as a hierarchy of importance that is really a layout
 * accident — and they disagree only in fill, inset and ink: the primary takes the
 * palette's pair on a box pulled in from the hairlines, every other action keeps the row's
 * muted ink and draws no box at all. Both go through `./pressable`, which owns the press
 * scale, the dim and Android's ripple; the corner the lime box clips to is `./pressable`'s
 * own `radius.sm`, so this file types no corner of its own. The glyph is kept out of the
 * accessibility tree, because the label already says what the item does and an icon that
 * is also announced is the same word twice.
 */
function RailAction({
	action,
}: {
	action: MerchantRailAction;
}): React.ReactElement {
	const { colors } = useTheme();
	const primary = action.primary === true;

	return (
		<Pressable
			onPress={action.onPress}
			accessibilityRole="button"
			accessibilityLabel={action.label}
			style={[
				styles.item,
				primary && {
					backgroundColor: colors.primary,
					minHeight: FILL_HEIGHT,
					marginVertical: space.xs,
				},
			]}
		>
			<Ionicons
				name={action.icon}
				size={icon.action}
				color={primary ? colors.primaryForeground : colors.mutedForeground}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text
				numberOfLines={1}
				style={{
					fontSize: LABEL_FONT_SIZE,
					fontWeight: weights.semibold,
					color: primary ? colors.primaryForeground : colors.mutedForeground,
				}}
			>
				{action.label}
			</Text>
		</Pressable>
	);
}

/**
 * The command bar (interface.md §25).
 *
 * The surface and its two hairlines are named here and coloured at the call site, because
 * a colour is the one thing this file must not own: `colors.card` for the band, `border`
 * for the rules, both read from the same `useTheme()` the screen above and below reads.
 */
export function MerchantCommandRail({
	actions,
}: {
	actions: MerchantRailAction[];
}): React.ReactElement | null {
	const { colors } = useTheme();

	if (actions.length === 0) return null;

	return (
		<View
			style={[
				styles.bar,
				{
					backgroundColor: colors.card,
					borderTopColor: colors.border,
					borderBottomColor: colors.border,
				},
			]}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.track}
			>
				{actions.map((action) => (
					<RailAction key={action.key} action={action} />
				))}
			</ScrollView>
		</View>
	);
}

/**
 * The track's two measures, and why the second is derived from the first.
 *
 * `ITEM_TRACK_HEIGHT` is 56 because §25 draws the bar that high, and it is a floor rather
 * than a height so a 200% label grows its item instead of clipping it — the same argument
 * `./merchant-order-row` makes for its 72-point band, and it clears the 44 floor by
 * construction rather than by borrowing the constant. `FILL_HEIGHT` is written as the
 * subtraction it is — the track less `space.xs` at each edge — because the inset is the
 * decision and the 48 is its result: type the 48 on its own and the day the track moves,
 * the lime box drifts out of the bar and nothing in the file would say so.
 */
export const ITEM_TRACK_HEIGHT = 56;
const FILL_HEIGHT = ITEM_TRACK_HEIGHT - space.xs * 2;

/**
 * The item's floor width, and the label's size.
 *
 * `ITEM_MIN_WIDTH` is 64 — §25's floor for a command, wide enough that the items read as
 * one rhythm and a min rather than a width, so a longer label grows the item instead of
 * squeezing it. `LABEL_FONT_SIZE` is 11, the one size §25 names that the app's scale does
 * not hold (`type.caption` is 12, and `merchantType` adds figures and titles, not a
 * smaller label) — the documented exception, sized to sit under a glyph rather than to
 * headline it.
 */
const ITEM_MIN_WIDTH = 64;
const LABEL_FONT_SIZE = 11;

const styles = StyleSheet.create({
	/** The band: a `card` surface ruled by the page's hairlines, full-bleed. */
	bar: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	/** The scroll's content: the bar's only padding, and the gap two commands keep. */
	track: {
		paddingHorizontal: space.xl,
		alignItems: "center",
		gap: space.sm,
	},
	/**
	 * The column every command shares, whatever ink it carries. `paddingHorizontal` is the
	 * air a label at the floor width needs at its edges, and `gap` is the step between a
	 * glyph and the word that names it.
	 */
	item: {
		minWidth: ITEM_MIN_WIDTH,
		minHeight: ITEM_TRACK_HEIGHT,
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		paddingHorizontal: space.sm,
	},
});
