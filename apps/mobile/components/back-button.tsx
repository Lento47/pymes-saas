import Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import { StyleSheet } from "react-native";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { icon, MIN_TOUCH_TARGET, radius, useTheme } from "@/theme";

import { Pressable } from "./pressable";

/**
 * Back, as a control rather than a word.
 *
 * Ten pushed screens hide the stack header and so draw their own way back, and every one of
 * them drew it as `Button variant="ghost" label={t("action.back")}` — a full-width text button
 * whose label is the word "Volver", sitting at the top of the content column above the screen's
 * own title.
 *
 * That is the wrong object in the wrong place, for three reasons that compound:
 *
 * - **A back control is chrome, not content.** Every platform this app runs on puts it in the
 *   header, top-left. Drawn as a content-width button it arrives *before* the title, so the
 *   first thing a reader meets on `app/featured` is the word "Volver" and the screen does not
 *   say what it is until the second line.
 * - **It reads as the screen's primary action.** `./button`'s ghost variant is what this app
 *   uses for a real, deliberate action — the way out of a browse feed (`app/index`), the
 *   second door on an empty state. A control that only goes back is borrowing that weight, and
 *   a screen whose loudest control is "leave" argues against its own content (`docs/design.md`
 *   Rule 1, one loud thing).
 * - **It costs a row of height above every list.** One button is ~44pt of the first screen —
 *   spent on the one thing the reader already has a gesture for.
 *
 * ## What it does not do is remove the way back
 *
 * The obvious reading of "drop the button" is to drop the affordance, and on a screen reached
 * by a cold start from a shared link that is a trap: `router.back()` with an empty stack does
 * nothing, so the reader keeps the screen they were trying to leave. That is the failure
 * `@/lib/leave` exists to make impossible, and this component is on the other side of it —
 * it calls the same `leaveScreen`, with the same per-screen fallback, so the fallback survives
 * the redesign and the trap does not come back with it.
 *
 * The glyph is `chevron-back` because a chevron is already this app's word for "there is more
 * that way" (`./list-row` draws `chevron-forward` on every row that leads somewhere), and the
 * box is `MIN_TOUCH_TARGET` square — the floor drawn rather than floored, `./favorite-button`'s
 * rule, so a header row that stretches its children cannot stretch this.
 */
export function BackButton({
	to,
	style,
	surface = false,
}: {
	to: Href;
	style?: object;
	/**
	 * Draw the control on a filled disc rather than as a bare chevron.
	 *
	 * Off by default, and the bare chevron is the better object on the ten pushed screens
	 * already using this: a back control is chrome, and chrome is quiet. It exists for a
	 * screen whose own heading is loud enough to need a visible peer beside it — a form in
	 * the commerce system, where the title is the second-largest thing on the page and an
	 * unboxed chevron reads as a glyph that got separated from its header.
	 *
	 * The fill is `muted` and the glyph `foreground`, the same pair the commerce system's
	 * fields and the merchant header's identity block use, so the disc is one more control in
	 * that language rather than a shape borrowed from somewhere else.
	 */
	surface?: boolean;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<Pressable
			onPress={() => leaveScreen(to)}
			accessibilityRole="button"
			accessibilityLabel={t("action.back")}
			style={[
				styles.button,
				surface ? [styles.disc, { backgroundColor: colors.muted }] : null,
				style,
			]}
		>
			<Ionicons
				name="chevron-back"
				size={icon.back}
				color={colors.foreground}
				// The label is on the button and already says what this does; an icon announced
				// beside it would read the same thing twice.
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		justifyContent: "center",
		// Its own size, so a row that stretches its children does not stretch the control.
		alignSelf: "flex-start",
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		// Pulled left by half its own padding so the glyph lines up with the text gutter the
		// title and the rows below it are drawn on, rather than the glyph's box doing so. The
		// pull is derived, not typed: a `MIN_TOUCH_TARGET` square centred on the `icon.back`
		// glyph keeps `(MIN_TOUCH_TARGET - icon.back) / 2` of its own on each side, and
		// without this the whole screen's left edge reads as inset by that much more.
		marginLeft: -(MIN_TOUCH_TARGET - icon.back) / 2,
	},
	/**
	 * The disc, and the one thing it changes about the box above: the optical pull is undone.
	 * That pull exists so a *bare glyph* lands on the text gutter rather than half a glyph to
	 * the right of it, and a 44-point filled circle is not half a glyph — it is a control, and
	 * a control is placed on the gutter like everything else. Leaving the pull on would hang
	 * the disc ten points into the margin.
	 */
	disc: { marginLeft: 0, borderRadius: radius.full },
});
