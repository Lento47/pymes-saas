import { ActivityIndicator, StyleSheet, View } from "react-native";

import { MIN_TOUCH_TARGET, space, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * Waiting, said the same way everywhere.
 *
 * A spinner is the *second* choice. `docs/design-mobile.md` reserves it for the two states
 * where the shape of the answer genuinely is not known — a sign-in round trip and a payment
 * — and gives everything else a `./skeleton`, because a list whose layout is known should
 * be drawn in that layout rather than replaced by a circle.
 *
 * A label is what makes this readable rather than merely busy: "Cargando…" is a fact, and a
 * rotating ring alone is a fact about the app, not about what the reader is waiting for. A
 * labelled spinner carries `progressbar` and its name. An **unlabelled** one is treated as
 * decoration and kept out of the accessibility tree entirely — it is what a caller draws
 * inside a control that already has a name, such as `./button`'s busy state, and a
 * nameless `progressbar` announced beside a labelled button is the button read twice.
 *
 * ## On reduced motion
 *
 * The indicator itself keeps turning, and that is deliberate rather than an oversight.
 * `ActivityIndicator` is the platform's own indeterminate control, not an animation this
 * app authored — `docs/design-mobile.md` lists what reduce-motion turns off (rise, scale,
 * shimmer, parallax and every stagger) and keeps this control for exactly the two states
 * it is reserved for. What the rule actually forbids is a state carried *only* by movement,
 * and this one is not: the word is rendered beside the ring, the button that started the
 * round trip is disabled and dimmed while it runs, and its accessibility state is `busy`.
 * Take the rotation away and the waiting state is still fully on the screen — which is the
 * test the rule sets.
 *
 * ## The label decides the gutter
 *
 * A labelled spinner is a message on a screen and gets the body's `space.lg` on each side;
 * an unlabelled one is a mark inside somebody else's control and gets nothing, because
 * padding there would inflate the button around it. That is the same line the
 * accessibility rule above already draws, at the same point — a labelled spinner is the
 * screen-level one and an unlabelled spinner is the decorative one — so it introduces no
 * second way of telling the two apart. The two call sites today are one of each:
 * `./signed-in` is labelled, `./button` is not.
 *
 * The label is also what makes the padding necessary rather than tidy. `./signed-in` drops
 * this into a screen with no wrapper, and on a `padded={false}` screen — the cart — an
 * unwrapped centered line has no gutters at all. See `./empty-state` for the same fix.
 */
export function Spinner({
	size = "small",
	label,
	centered = false,
	/**
	 * The ring's ink. `colors.primary` unless the surface it sits on says
	 * otherwise: a primary button's busy state draws on the primary fill, where
	 * a primary ring is invisible, so `./button` passes its own ink and the
	 * labelled screen-level spinner keeps the default.
	 */
	color,
}: {
	size?: "small" | "large";
	/** The word for what is loading, already translated. Omit for a decorative spinner. */
	label?: string;
	centered?: boolean;
	color?: string;
}) {
	const { colors } = useTheme();
	const named = label !== undefined;

	return (
		<View
			style={[
				styles.wrap,
				centered && styles.centered,
				named && styles.message,
			]}
			accessible={named}
			accessibilityRole={named ? "progressbar" : undefined}
			accessibilityLabel={label}
			accessibilityElementsHidden={!named}
			importantForAccessibility={named ? "auto" : "no"}
		>
			<ActivityIndicator size={size} color={color ?? colors.primary} />
			{label ? (
				<Text variant="label" tone="muted" style={styles.label}>
					{label}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
	},
	centered: { flex: 1 },
	// Only on the labelled, screen-level spinner — see the note above. An unlabelled one is
	// inside a control and must not widen it, and the floor belongs to that promise rather than
	// beside it: `MIN_TOUCH_TARGET` sat in `wrap`, so `./button`'s busy state handed a
	// floor-sized box to a control whose own height is smaller, and grew it by the difference —
	// the jump `./action-bar`'s `ACTION_BAR_CLEARANCE` is derived from, under the finger that
	// just pressed it. The labelled spinner is the screen-level one and keeps the floor, which
	// is the same predicate this style was already selected by.
	message: { paddingHorizontal: space.lg, minHeight: MIN_TOUCH_TARGET },
	label: { textAlign: "center" },
});
