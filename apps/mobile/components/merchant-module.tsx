import { StyleSheet, View } from "react-native";

import { radius, useTheme } from "@/theme";

/**
 * A module's inner padding, named because the spec fixes it and the number is not on any
 * scale. See `styles.padded` for why it is not a `space` step.
 *
 * **Above the component that uses it**, because a `const` is not hoisted and a stylesheet
 * object is module scope: declaring it below would be a runtime failure at module evaluation
 * rather than a compile error, which is the worse of the two.
 */
export const MODULE_PADDING = 18;

/**
 * One warm block of an operator screen.
 *
 * The merchant console's commerce direction is a white canvas with a small number of large,
 * soft, `#F6F5F1` modules on it — a customer block, an items block, a totals block, an
 * activity block — and every one of them is the same object with a different corner radius.
 * Four ad-hoc `View`s with a background and a radius would be four places to change when the
 * surface moved, and the radius would be typed four times.
 *
 * ## Why it is a component and not a `Card`
 *
 * `./card.tsx` is the *other* shape: `shadow.card` plus `shadow.raised`, a hairline, and a
 * `tone` for the brand fill. The merchant spec for these modules is the inverse of all three —
 * **no shadow at all**, because a soft module on white is separated by its own fill and a lift
 * would put a second edge under it — and this file is what says so. `./merchant-pulse` is the
 * same decision already made once, on a dark band, for the same reason.
 *
 * ## The radius is a parameter because four different numbers are wanted
 *
 * The hero is 30 and the modules below it are 22 to 30. `radius.xl` is exactly 30 and is the
 * one token in the scale large enough to read as "a module" rather than "a card", so the
 * default is that and the tighter values are named at the call site. The alternative — one
 * radius for all of them — is the choice a scale like `space` forces, and the corner is the
 * one thing about these blocks the spec deliberately varies.
 *
 * ## Nothing here draws a border
 *
 * The hairline in the design belongs *between rows inside* a module — the one physical pixel
 * between the customer and the address — and a hairline around the module would be a second
 * outline on a shape whose fill is already doing the separating. The separator is the caller's,
 * for the same reason the module's padding is.
 */
export function MerchantModule({
	children,
	style,
	radius: corner = radius.xl,
	padded = true,
}: {
	children: React.ReactNode;
	/**
	 * A caller's own style, applied *after* this component's, so a screen can position the
	 * module without restating its fill or its corner.
	 */
	style?: object;
	/** The corner. Defaults to `radius.xl` (30), the scale's module step. */
	radius?: number;
	/** Off for a module whose children bring their own padding — a rail, for instance. */
	padded?: boolean;
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.module,
				// `muted` is the merchant palette's `#F6F5F1`, which is the spec's warm surface
				// exactly. The name is the colour system's, not this file's: a module is warm
				// because that is what the surface token is, and a merchant's `muted` is
				// deliberately not the consumer tree's.
				{ backgroundColor: colors.muted, borderRadius: corner },
				padded ? styles.padded : null,
				style,
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	module: {
		// `overflow: "hidden"` is what lets a caller round only this module's own corners
		// while something inside it bleeds to an edge — the activity rail's connector, a
		// future image. It also clips a child shadow, and there is none.
		overflow: "hidden",
	},
	// 18 rather than a `space` step, and off the scale on purpose: it is the padding the
	// merchant system gives a module, where `space.xl` (20) is the page gutter and
	// `space.lg` (16) is the gap between two modules. Three different measures that happen to
	// be within four points of each other, and a scale step would have said they were the
	// same one.
	padded: { padding: MODULE_PADDING },
});
