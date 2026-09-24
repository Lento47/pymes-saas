import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { type FavoriteTarget, useFavorites } from "@/lib/favorites";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { duration, STATE_POP, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, useTheme } from "@/theme";

import { Pressable } from "./pressable";

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
 * The filled heart is `primary` rather than the conventional red: the palette's red is
 * `destructive`, and it names a danger. A saved shop is not a danger, and a token borrowed
 * for its hue is how one of them gets recoloured and takes the other with it. Filled
 * against outline is the difference that survives a colour-blind reader either way.
 *
 * ## The heart pops when the state changes, and only then
 *
 * A filled heart appearing under a thumb is easy to miss on a card the reader is already
 * moving past, so the change gets one movement: `lib/motion`'s `STATE_POP`, then
 * `spring.press` back to rest. Three things keep it honest rather than decorative —
 *
 * - It is driven by `favorited`, which is the same value the icon and the accessibility
 *   state read, so it cannot celebrate a change that did not happen. That includes the
 *   **rollback**: when `@/lib/favorites` takes an optimistic add back because the API
 *   refused it, this pops in the other direction, which is the visual half of the
 *   `warning()` haptic that fires beside it.
 * - The first render is skipped. A feed of twelve cards mounts twelve of these, and all
 *   twelve would otherwise pop at once on arrival — a screen-wide twitch that says nothing.
 * - Reduced motion drops the travel and keeps the state. The icon still goes outline to
 *   filled and still changes colour, which is the signal; the pop is the echo. Nothing
 *   here is left off, because nothing here is the only way to read the state.
 */
export function FavoriteButton({
	target,
	style,
}: {
	target: FavoriteTarget;
	/** Layout only — a caller pinning the heart to a corner passes the pinning. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const { isFavorited, toggle, signedIn, isPending } = useFavorites();

	const favorited = isFavorited(target);
	const name =
		target.kind === "business" ? target.card.name : target.card.title;

	/**
	 * The pop. See the docblock's "The heart pops when the state changes" for the three
	 * things that make it honest; the magnitudes are `lib/motion`'s and none is typed here.
	 */
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
		scale.value = withSequence(
			withTiming(STATE_POP, { duration: duration.instant }),
			withSpring(1, spring.press),
		);
	}, [favorited, reduceMotion, scale]);

	const pop = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : scale.value }],
	}));

	return (
		<Pressable
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
			style={[styles.button, style]}
		>
			<Animated.View style={pop}>
				<Ionicons
					name={favorited ? "heart" : "heart-outline"}
					size={22}
					color={favorited ? colors.primary : colors.mutedForeground}
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
	},
});
