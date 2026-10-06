import { useThemeMode } from "./mode";
import type { ColorScheme, ThemeColors } from "./tokens";
import { useThemeColors } from "./transition";

export * from "./business-theme";
export * from "./business-theme-ids";
export * from "./business-theme-select";
export * from "./merchant";
export * from "./mode";
export * from "./scope";
export * from "./select";
export * from "./tokens";
export * from "./transition";

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
	// **One palette for the whole app.** This used to be
	//
	//     tree === "business" ? businessThemeColors(theme.id, scheme) : palette[scheme]
	//
	// and that second branch is what left the theme picker inert for a customer and a
	// courier: the control was on the Settings screen, it took the tap, and nothing the
	// reader could see changed. The tree is still resolved — `selectTree` decides which
	// palette note the picker shows, and `useThemeScope` is still mounted above every screen
	// — but neither is consulted *here*, because a palette is not a property of a route.
	//
	// `palette` survives as an export because `components/hero.tsx` reads `palette.dark.*`
	// and `palette.light.*` for a photograph scrim, which is deliberately theme-independent:
	// the dim behind a photo is the same dim whatever the app is wearing.
	//
	// **The colours now come from `<ThemeTransitionProvider>` rather than being composed here.**
	// That is the whole colour transition: sixty components read this function and roughly 310
	// separate reads of `colors.*` reach a style, so interpolating at the composition point makes
	// every one of them glide with no call site edited. See `./transition.tsx` for why it is a
	// `requestAnimationFrame` loop rather than Reanimated, and what it costs the caller.
	//
	// `scheme` is still read from `useThemeMode()` rather than taken from the transition: the
	// scheme flips under a theme change only when the OS setting changes, and that is a different
	// event with a different answer.
	return { colors: useThemeColors(), scheme };
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
