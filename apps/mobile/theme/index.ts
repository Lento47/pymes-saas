import { useSegments } from "expo-router";

import { useBusinessTheme } from "./business-theme";
import { useThemeMode } from "./mode";
import { useThemeScope } from "./scope";
import { selectTree } from "./select";
import {
	businessThemeColors,
	type ColorScheme,
	palette,
	type ThemeColors,
} from "./tokens";

export * from "./business-theme";
export * from "./business-theme-ids";
export * from "./business-theme-select";
export * from "./merchant";
export * from "./mode";
export * from "./scope";
export * from "./select";
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
 * so no component branches and no screen passes a palette down.
 *
 * ## Why that sentence is now half a sentence
 *
 * The selection used to be `segments[0] === "(business)"` and nothing else, and the route was
 * a bad stand-in for who is reading, in two ways with one cause:
 *
 * - **The boot frame was the consumer's.** `useSegments()` is `useRouteInfo().segments`, and
 *   expo-router's `getRouteInfoFromState` answers `[]` for the whole window before a navigation
 *   state exists. A merchant's cold start spends that window on `app/index.tsx`, which is a root
 *   route, so the app drew its `#3538f2` spinner on a cream canvas for as long as `users.me`
 *   took to answer. The subscription being the navigator's own was true and was not the problem;
 *   the problem was that the navigator has no opinion yet, and a route is not a person.
 * - **So were the five root routes a merchant pushes** — `/profile`, `/settings`, `/help`,
 *   `/inbox`, `/new-business` — because all three trees reach them and their first segment is
 *   therefore never `(business)`. A merchant who opened Perfil got consumer-blue buttons inside
 *   their own console, for as long as they stayed there.
 *
 * `./select.ts` holds the rule that replaces it and argues every clause, including the two
 * orderings that are load-bearing and the one group that must never be coloured by a role at
 * all. This file is only the lookup that acts on the answer, and it is three lines long on
 * purpose: a decision that needs a paragraph of comment has usually landed in the wrong file.
 *
 * ## The return is a fresh object, and has to stay one
 *
 * `components/hours-table.tsx`'s memo documents that it must not begin comparing this return,
 * because a new `{ colors, scheme }` wrapper on every call would make that comparison miss every
 * time. A third field would not fix that, so there isn't one: the callers that need to know which
 * tree they are in read `useThemeScope()` and `selectTree()` themselves, which is the same work
 * this function just did.
 */
export function useTheme(): { colors: ThemeColors; scheme: ColorScheme } {
	const { scheme } = useThemeMode();
	const segments = useSegments();
	const role = useThemeScope();
	const tree = selectTree({ segments, role });
	// The merchant palette is read unconditionally, beside the tree test rather than inside
	// its branch. `useBusinessTheme()` throws when its provider is missing, and a throw
	// that only happens in one tree is a crash that only happens to merchants — which is
	// the harder kind to find, because the consumer tree keeps working. Reading it always
	// costs one context lookup the tree test was going to make anyway.
	const theme = useBusinessTheme();
	const colors =
		tree === "business"
			? businessThemeColors(theme.id, scheme)
			: palette[scheme];
	return { colors, scheme };
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
