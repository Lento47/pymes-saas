import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { radius, shadow, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";

/**
 * A surface a row of things sits on.
 *
 * The lift is `shadow.card`, which carries whatever the running platform draws it with —
 * the iOS `shadow*` pair and Android's `elevation`, or the `boxShadow` the web target wants
 * — spread from the token so a screen never picks one and looks flat on the other
 * platforms. That mistake is invisible on the platform you are developing on, which is why
 * the token exists rather than the values living here.
 *
 * `onPress` makes the whole card a target rather than only its title: a card that looks
 * pressable and whose text is not is the most common mis-tap in a list of products. The
 * press feedback is `./pressable`'s, with the default scale rather than a row's — a card
 * has visible edges and a margin around it, so it can move the full 3% without the screen
 * appearing to shift under the reader.
 */
export function Card({
	children,
	onPress,
	accessibilityLabel,
	accessibilityHint,
	tone = "surface",
	style,
}: {
	children: React.ReactNode;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	/**
	 * Which surface this is: the page's own card, or the brand fill.
	 *
	 * A variant and not a `style` at the call site, which is the rule `docs/design-mobile.md`
	 * states in its first paragraphs — colour belongs to the primitive, and a second
	 * `backgroundColor` that fixes one card is this variant, unwritten. `brand` is
	 * `primary`/`primaryForeground`, the palette's own filled pair (**7.0:1** and drawn at
	 * 6.9:1 against `card`), and its children carry `./text`'s `inverse` tone — the ink pair
	 * exists for exactly this. Its hairline is `primary` rather than `border`: the lift and
	 * the corner still separate it from the page, and a grey line around a filled surface is
	 * a border nobody asked for. Every other number on it is the same card.
	 */
	tone?: "surface" | "brand";
	/**
	 * `StyleProp<ViewStyle>` and not a bare `ViewStyle`, which is what `View` accepts and
	 * what a caller composing `[a, b]` needs. It is spread **last** into the surface array,
	 * so a caller's `flex`, width or margin wins over the primitive's own box —
	 * `./product-tile` and `./promo-hero` both rely on that to take the width their rail
	 * hands them without a wrapper around the card.
	 */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();

	const surface = [
		styles.card,
		{
			backgroundColor: tone === "brand" ? colors.primary : colors.card,
			borderColor: tone === "brand" ? colors.primary : colors.border,
		},
		shadow.card,
		style,
	];

	if (!onPress) return <View style={surface}>{children}</View>;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			style={surface}
		>
			{children}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: radius.md,
		borderWidth: 1,
		padding: space.lg,
	},
});
