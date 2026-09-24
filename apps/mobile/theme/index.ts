import { useSegments } from "expo-router";

import { useThemeMode } from "./mode";
import {
	type ColorScheme,
	merchant,
	palette,
	type ThemeColors,
} from "./tokens";

export * from "./merchant";
export * from "./mode";
export * from "./tokens";

/**
 * The active palette.
 *
 * The scheme comes from `./mode`, which is either a subscription to the OS setting or the
 * reader's explicit choice of `light`/`dark` — `system` is the default, so an untouched app
 * reads `useColorScheme()` directly and there is no second source for one fact.
 *
 * This used to resolve `useColorScheme()` here, and the comment above it said there was no
 * in-app theme switch because the phone already has one. That is still true of the *phone*;
 * what changed is that the app now offers `Settings → Tema` with three answers, and the
 * third — `system` — is what keeps the old argument intact rather than contradicting it.
 * `./mode`'s docblock is where that is argued properly.
 *
 * Every screen in the app reads the palette through this one function, which is what makes
 * the switch a one-line change rather than ninety: nothing below this line knows whether the
 * colours it is handed came from the OS or from a setting.
 *
 * The one thing it does know is which tree it is in. Screens mounted under `(business)` —
 * the owner console — draw the warm `merchant` system instead of the consumer palette;
 * every other route draws `palette[scheme]` as before. Same `ThemeColors` keys either way,
 * so no component branches and no screen passes a palette down. The subscription is the
 * navigator's own (`useSegments`), which is also what keeps this honest on a role change:
 * leaving the business tree drops its colours with it, with no cleanup to forget.
 */
export function useTheme(): { colors: ThemeColors; scheme: ColorScheme } {
	const { scheme } = useThemeMode();
	const segments = useSegments();
	const inBusiness = segments.length > 0 && segments[0] === "(business)";
	return { colors: inBusiness ? merchant : palette[scheme], scheme };
}

/*
 * Reduced motion: read it through reanimated's `useReducedMotion`, not from this file.
 *
 * A `useReduceMotion()` used to live here — a correct `AccessibilityInfo` subscription on
 * `reduceMotionChanged` that nothing ever called. It was deleted rather than kept as a
 * fallback, for the reason `useTheme` gives one function up about the palette: a second
 * source for one fact is how the two come to disagree. Reanimated's hook is the only one
 * that answers *inside a worklet*, which is where it matters — a transform the reader asked
 * not to see is applied on the animation thread, not in React. A screen that read the system
 * setting its own way would take the movement off in one place and leave it on in another,
 * and this is a request that holds everywhere or has not been honoured at all.
 *
 * It is not an aesthetic preference: on a phone it is usually vestibular, and a screen that
 * slides is a screen that makes somebody sick. `docs/design-mobile.md` carries the rule for
 * what each primitive must do when the answer is yes.
 */
