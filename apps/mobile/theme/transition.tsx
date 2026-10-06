import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { duration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";

import { useBusinessTheme } from "./business-theme";
import { useThemeMode } from "./mode";
import { businessThemeColors, type ThemeColors } from "./tokens";
import { easeOutCubic, interpolateThemeColors } from "./transition-math";

/**
 * Colour transition for a theme change.
 *
 * ## Why this lives here and not at three hundred call sites
 *
 * Roughly sixty components read `useTheme()` — every button, card, row, sheet, skeleton and text
 * run in the app — and theme colours reach a style through about 310 separate reads of
 * `colors.*`. Animating at each of those would be three hundred edits, and the next screen
 * written would forget.
 *
 * So the interpolation happens once, where the palette is composed, and every consumer is handed
 * a colour already part-way between the old theme and the new one. **No call site changes.**
 * `./text.tsx` resolves its ink from a token *name* (`TONES[tone]`) rather than a literal, so it
 * picks up the moving value for free; the raw `colors.*` reads pick it up because they read the
 * same object.
 *
 * ## Why a `requestAnimationFrame` loop rather than Reanimated
 *
 * Reanimated 4.5.1 has no `useAnimatedTheme` / `createAnimatedTheme` — checked against the
 * installed package, not assumed — and the alternatives were worse. `withTiming` on shared
 * values would need an animated prop on every `View` and `Text` in the tree. Animating only the
 * shared primitives would leave the 93 raw `backgroundColor` reads snapping while the text
 * glided, which looks more broken than not animating at all.
 *
 * The cost is re-rendering the tree about thirteen times over `duration.banner`, once, on an
 * interaction the reader has to seek out — the Settings screen.
 *
 * Reanimated's own `useReducedMotion` is deliberately not used: it answers the question *inside a
 * worklet*, and this runs on the JS thread, so `@/lib/reduced-motion` — the store with the OS
 * subscription — is the right source for the same fact.
 *
 * ## What it costs the caller
 *
 * `useTheme()` returns a fresh `{ colors }` while the transition runs, so
 * `components/hours-table.tsx`'s memo — documented as depending on a stable reference — re-renders
 * for the length of the transition and then settles. That is the price of doing this in one place
 * rather than three hundred, and it is bounded by the duration.
 */
const ThemeColorsContext = createContext<ThemeColors | undefined>(undefined);

export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
	const { scheme } = useThemeMode();
	const theme = useBusinessTheme();
	const reduceMotion = useReducedMotion();

	/**
	 * Memoised on `[theme.id, scheme]` so the identity is stable between renders.
	 *
	 * `businessThemeColors` composes on read and hands back a fresh object every call, so an
	 * identity comparison against it would report a change on every render and the effect below
	 * would restart forever. Memoising is what makes "the theme changed" a thing that can be
	 * detected at all — and it also settles the long-standing note on `useTheme()` about the
	 * return being a fresh object, because between transitions it now genuinely is stable.
	 */
	const target = useMemo(
		() => businessThemeColors(theme.id, scheme),
		[scheme, theme.id],
	);

	const [display, setDisplay] = useState(target);
	const shownRef = useRef(target);
	const frameRef = useRef<number | null>(null);
	const mountedRef = useRef(false);

	const setBoth = useCallback((next: ThemeColors) => {
		shownRef.current = next;
		setDisplay(next);
	}, []);

	useEffect(() => {
		// The first target is what the tree mounts with. Animating from nothing would fade the
		// whole app in from black on every cold start.
		if (!mountedRef.current) {
			mountedRef.current = true;
			shownRef.current = target;
			setDisplay(target);
			return;
		}

		if (reduceMotion) {
			setBoth(target);
			return;
		}

		/**
		 * Blend from **what is on screen**, not from the previous target.
		 *
		 * A reader who taps through four themes in a second gets one continuous move rather than
		 * four overlapping ones, and a transition interrupted halfway resumes from where it
		 * looked like it was rather than snapping back to a colour that was on screen for less
		 * time than a frame.
		 */
		const from = shownRef.current;
		let start = 0;

		const step = (now: number) => {
			if (start === 0) start = now;
			const t = Math.min(1, (now - start) / duration.banner);
			setBoth(interpolateThemeColors(from, target, easeOutCubic(t)));
			if (t < 1) {
				frameRef.current = requestAnimationFrame(step);
			} else {
				frameRef.current = null;
			}
		};
		frameRef.current = requestAnimationFrame(step);

		return () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		};
	}, [reduceMotion, setBoth, target]);

	return <ThemeColorsContext value={display}>{children}</ThemeColorsContext>;
}

/**
 * The palette, mid-transition when one is running.
 *
 * Throws outside `<ThemeTransitionProvider>` rather than falling back to a composed palette —
 * the same call `useThemeScope()` and `useBusinessTheme()` make. A silent fallback would resolve
 * to an un-animated palette, so a provider mounted in the wrong place would ship a theme change
 * that snaps with nothing in the log to say why.
 */
export function useThemeColors(): ThemeColors {
	const colors = use(ThemeColorsContext);
	if (colors === undefined) {
		throw new Error(
			"useThemeColors() fuera de <ThemeTransitionProvider>. Lo monta el layout raíz.",
		);
	}
	return colors;
}
