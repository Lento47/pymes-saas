import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { mixHex } from "@/lib/color";
import { type FavoriteTarget, useFavorites } from "@/lib/favorites";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { duration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, radius, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { useRollback } from "./rollback-surface";

/** Saved favorites have their own rose ink, independent of brand and danger colors. */
const FAVORITE_INK = { light: "#B72E55", dark: "#FF8FA9" } as const;

/**
 * The heart on a shop and on a dish.
 *
 * Three things happen on one tap and they are in this order on purpose: the **state change
 * first** (the optimistic write puts the shop in the favourites cache before the request
 * leaves), the **haptic** beside it — `light`, because a favourite is a small commit the
 * customer made on purpose — and the request last. A phone on silent still gets the filled
 * heart, which is the signal; the buzz is the echo.
 *
 * The write itself, and what happens when the API refuses it, lives in `@/lib/favorites`.
 * This component owns what a heart looks like and what a screen reader hears.
 *
 * ## Signed out is not a disabled heart
 *
 * A customer who has not signed in can still see the whole marketplace, and a heart they
 * cannot use would be a control that lies about being one. Tapping it opens sign-in — the
 * one thing that would actually make the tap mean something — rather than doing nothing or
 * filling in a state nothing can store.
 *
 * ## The colour
 *
 * Rose identifies saved items independently of brand colors. The round surface is
 * tinted from the active theme, so the heart stays readable over photographs.
 *
 * ## The heart pops when the state changes, and only then
 *
 * Saving gives the icon one restrained pulse; removing or rolling back restores
 * the outline immediately. Initial renders and reduced motion never animate.
 */
export function FavoriteButton({
	target,
	style,
}: {
	target: FavoriteTarget;
	/** Layout only — a caller pinning the heart to a corner passes the pinning. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors, scheme } = useTheme();
	const favoriteInk = FAVORITE_INK[scheme];
	const { t } = useT();
	const { isFavorited, toggle, signedIn, isPending, error } = useFavorites();
	const rollback = useRollback();

	const favorited = isFavorited(target);
	const name =
		target.kind === "business" ? target.card.name : target.card.title;

	/** Only the icon moves; the touch target stays still. */
	const scale = useSharedValue(1);
	const reduceMotion = useReducedMotion();
	// Seeded with the value this heart mounted at, so the first render is not a change —
	// a feed of twelve cards would otherwise pop twelve hearts as it arrives. The comparison
	// below is also what makes `favorited` a real dependency rather than a trigger this
	// effect never reads.
	const shown = useRef(favorited);

	useEffect(() => {
		if (reduceMotion) {
			shown.current = favorited;
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		if (shown.current === favorited) return;
		shown.current = favorited;
		if (!favorited) {
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		scale.value = withSequence(
			withTiming(1.08, { duration: duration.instant }),
			withTiming(1, { duration: duration.standard }),
		);
	}, [favorited, reduceMotion, scale]);

	const pop = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : scale.value }],
	}));

	/**
	 * The refusal, said out loud.
	 *
	 * `lib/favorites` rolls the heart back and buzzes; the sentence is not its to draw. A
	 * heart is a 44-point square on a card, so the sentence goes to `./rollback-surface`,
	 * which floats the app's own notice over the screen. This is the one place that knows a
	 * write failed *and* that a surface exists, which is the line `lib/` deliberately does
	 * not cross.
	 *
	 * Keyed on the error object and not on a boolean: the mutation hands back the same
	 * object for the life of a failure, so a re-render of the card does not re-announce it,
	 * while the next failed tap produces a new one and a new notice. A success clears it to
	 * `null` as the next write starts.
	 */
	useEffect(() => {
		if (!error) return;
		rollback.show(error);
	}, [error, rollback]);

	return (
		<Pressable
			scaleTo={1}
			onPress={() => {
				if (!signedIn) {
					router.push("/sign-in");
					return;
				}
				light();
				toggle(target);
			}}
			accessibilityRole="button"
			accessibilityLabel={
				favorited ? t("favorites.remove") : t("favorites.add")
			}
			// Which shop or dish, since a feed can hold several of these and "Guardar en
			// favoritos" alone does not say which one is about to be saved.
			accessibilityHint={name}
			accessibilityState={{ selected: favorited, busy: isPending }}
			style={[
				styles.button,
				{
					backgroundColor: favorited
						? mixHex(colors.card, favoriteInk, scheme === "dark" ? 0.76 : 0.94)
						: mixHex(
								colors.card,
								colors.foreground,
								scheme === "dark" ? 0.88 : 0.99,
							),
					borderColor: favorited ? `${favoriteInk}50` : colors.border,
				},
				style,
			]}
		>
			<Animated.View style={pop}>
				<Ionicons
					name={favorited ? "heart" : "heart-outline"}
					size={24}
					color={favorited ? favoriteInk : colors.foreground}
					// The label is on the button and already says the state; an icon announced
					// beside it would read the same thing twice.
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Animated.View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		justifyContent: "center",
		// Its own size, so a row that stretches its children does not stretch the heart.
		alignSelf: "flex-start",
		// The floor, drawn rather than floored: `./pressable`'s `minHeight` would let a row
		// stretch this, and a heart that grows with its neighbours moves under the thumb from
		// one card to the next. The glyph inside is 22 — half the square — and is sized in the
		// `Ionicons` above rather than by `icon`, because its box is this one and not a role.
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		borderRadius: radius.full,
		borderWidth: StyleSheet.hairlineWidth,
	},
});
