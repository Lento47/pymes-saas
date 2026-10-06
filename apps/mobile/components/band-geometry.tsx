import { StyleSheet, View } from "react-native";

import { mixOklab } from "@/lib/color";

/**
 * The concentric forms in the header band: the shape the band was missing.
 *
 * ## Why this exists at all
 *
 * Everything the band drew before was **one-dimensional**. `components/home-gradient.tsx` pins its
 * gradient to `start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}` and
 * `components/top-fluid-gradient.tsx` passes no `start`/`end` at all, so both default to a
 * top-to-bottom axis. `locations` are ten fractions of that one axis, and `expo-linear-gradient`
 * has no radial mode. The band could therefore only ever be a vertical falloff — there was no
 * second dimension anywhere in it, and a curve was not something the existing code could express
 * at any alpha or weighting.
 *
 * ## Why plain Views rather than SVG
 *
 * The obvious tool is `react-native-svg`, and it is already a dependency — but drawing a clipped
 * circle needs no path, no stroke and no gradient definition, and the shapes that matter here are
 * filled discs. `components/merchant-order-hero.tsx` already draws this exact form, in this exact
 * shape language, with three `View`s and a `borderRadius`:
 *
 *     three concentric circles sharing one centre, clipped by the module's own `overflow`
 *     and entering from the right
 *
 * Reusing that approach means the home screen gains no SVG surface, no native view and no
 * GPU layer — which is the one genuinely performance-sensitive part of this work, on the screen
 * that scrolls. It also means the two forms in the app are built the same way, so a future change
 * to how the shape reads is one edit rather than two.
 *
 * ## How they are hung
 *
 * From a zero-size anchor point pinned inside the right edge, with each circle offset by half its
 * own diameter. That is `merchant-order-hero`'s arrangement and the reason it is repeated: three
 * independent `right`/`top` offsets only *look* concentric until the band's height changes. One
 * anchor and a half-diameter offset cannot drift, and it also survives the band not being the
 * width the design assumed.
 *
 * ## The colour, and why it moves toward the page
 *
 * `mixOklab(color, page, 0.22)` — a fifth of the way from the band toward the page. The obvious
 * choice, white at low alpha, is invisible on the dark themes, where the band top is still a
 * bright lime. Moving toward the **page** instead means the forms always deviate from the band in
 * the direction the eye already reads as "not the band", in both schemes and on every hue, without
 * introducing a token that exists only for decoration.
 *
 * Static. The delivery band's breath already animates the ramp underneath, and two motions in one
 * surface read as a wobble rather than as design. Nothing here mounts an animation, so `still`
 * and `reduced` need no special case — they get the same shapes, held, which is what those two
 * states promise everywhere else in the band.
 */

/** Opacity steps, outer to inner. Concentric discs overlap, so the centre carries all three. */
const ALPHA = [0.5, 0.62, 0.74] as const;

/** Each circle's diameter as a share of the band's height. */
const SCALE = [2.6, 1.7, 1.05] as const;

/** How far the shared centre sits above the band's vertical middle, as a share of its height. */
const RISE = 0.16;

export function BandGeometry({
	color,
	page,
	height,
	width,
}: {
	/** The band's top stop — the anchored colour, so the forms agree with the ramp. */
	color: string;
	/** What the band is drawn over. The forms move toward this, not toward white. */
	page: string;
	height: number;
	width: number;
}) {
	const tint = mixOklab(color, page, 0.22);
	const largest = Math.min(height * 2.6, width * 1.5);
	return (
		<View
			style={[
				styles.anchor,
				// Past the right edge, so the circles are read as arcs cut by the band's own
				// boundary rather than as complete discs floating in it. A fraction of the width
				// rather than a constant, because the band's width is not knowable here.
				{ right: -largest * 0.62 },
			]}
			pointerEvents="none"
		>
			{ALPHA.map((opacity, index) => {
				const size = largest * (SCALE[index] ?? 1);
				return (
					<View
						key={SCALE[index]}
						style={[
							styles.circle,
							{
								width: size,
								height: size,
								// Half the circle's own diameter, so every one of them is hung from
								// the anchor's origin and they stay concentric if the scale changes.
								marginLeft: -size / 2,
								marginTop: -size / 2,
								backgroundColor: tint,
								opacity,
							},
						]}
					/>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	/**
	 * The shared centre: a zero-size box pinned inside the right edge and lifted above the
	 * vertical middle, which puts its origin at exactly the point every circle is hung from.
	 * `overflow: hidden` belongs on the **band**, not here — see `./home-gradient`.
	 */
	anchor: {
		position: "absolute",
		top: `${(0.5 - RISE) * 100}%`,
		width: 0,
		height: 0,
	},
	circle: {
		position: "absolute",
		borderRadius: 9999,
	},
});
