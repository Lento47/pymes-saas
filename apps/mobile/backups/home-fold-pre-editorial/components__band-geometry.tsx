import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mixOklab } from "@/lib/color";
import { radius } from "@/theme";

/**
 * The light well in the header band: the shape the band was missing.
 *
 * ## Why this exists at all
 *
 * Everything the band drew before was **one-dimensional**. `components/home-gradient.tsx` pins its
 * gradient to `start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}` and
 * `components/top-fluid-gradient.tsx` passes no `start`/`end` at all, so both default to a
 * top-to-bottom axis. `locations` are ten fractions of that one axis, and `expo-linear-gradient`
 * has no radial mode. The band could therefore only ever be a vertical falloff — there was no
 * second dimension anywhere in it.
 *
 * ## Why a well, not a disc — and why it is flush
 *
 * A circle hung off the right edge is a second geometry that does not belong to the chrome.
 * This well uses **`radius.xl`**, the same corner the tucked sheet already draws.
 *
 * It used to be inset `space.lg` on three sides. That inset was ghost space: the top 16pt
 * and the 30pt of rounding sat inside the status bar, so the only thing a reader saw was
 * two lime strips down the sides of the header, a frame with nothing in it. The well now
 * starts at the safe-area top — where `HomeHeader` starts — and runs edge to edge, so the
 * `xl` corners cut the wash in the content area instead of drawing an empty margin.
 *
 * The bottom still runs off the band and is clipped flush.
 *
 * ## Why plain Views rather than SVG
 *
 * A clipped rounded rect needs no path. The home screen gains no SVG surface, no native view
 * and no GPU layer — which is the one genuinely performance-sensitive part of this work, on
 * the screen that scrolls.
 *
 * ## The colour, and why it moves toward the page
 *
 * `mixOklab(color, page, 0.22)` — a fifth of the way from the band toward the page. White at
 * low alpha is invisible on the dark themes, where the band top is still a bright lime.
 * Moving toward the **page** means the well always recedes from the wash, in both schemes and
 * on every hue, without a token that exists only for decoration.
 *
 * Static. The delivery band's breath already animates the ramp underneath, and two motions in
 * one surface read as a wobble rather than as design.
 */

/** Quiet enough to be climate, not a second spotlight. */
const ALPHA = 0.35;

export function BandGeometry({
	color,
	page,
	height,
	width: _width,
}: {
	/** The band's top stop — the anchored colour, so the forms agree with the ramp. */
	color: string;
	/** What the band is drawn over. The forms move toward this, not toward white. */
	page: string;
	height: number;
	/** Kept so the caller can pass the band's box without this file inventing a second size. */
	width: number;
}) {
	const { top } = useSafeAreaInsets();
	const tint = mixOklab(color, page, 0.22);
	return (
		<View
			style={[
				styles.well,
				{
					// `height` rather than `bottom: 0`: the well starts on the content and
					// overflows the band's floor, so `overflow: "hidden"` clips it flush
					// instead of rounding a bottom edge nobody should see.
					top,
					height,
					backgroundColor: tint,
					opacity: ALPHA,
				},
			]}
			pointerEvents="none"
		/>
	);
}

const styles = StyleSheet.create({
	well: {
		position: "absolute",
		left: 0,
		right: 0,
		borderTopLeftRadius: radius.xl,
		borderTopRightRadius: radius.xl,
	},
});
