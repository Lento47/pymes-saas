import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useColorScheme } from "react-native";

import type { ColorScheme } from "./tokens";

/**
 * Which palette the app draws in, and who decided.
 *
 * `theme/index.ts` used to say there is no in-app theme switch, and gave the reason: the
 * phone already has one, and a second source for one fact is how the two come to disagree.
 * That argument is correct against the switch it was written about — a *two-state* toggle
 * that simply overrides the OS, which does create a second, independent answer to "is this
 * phone in dark mode" and can contradict the system UI sitting in the same frame.
 *
 * It is not an argument against this one, because `system` is a member of the set. The
 * question a switch answers is not "light or dark" but *"who decides"*, and the three
 * answers here are the only three there are: the phone (`system`, the default, and today's
 * behaviour exactly), or the reader (`light`, `dark`). Nothing can disagree, because when
 * the mode is `system` there is no second opinion to hold — the OS answer is read and used
 * directly, and the override only exists once somebody has asked for one.
 *
 * That is also why the default is `system` and not `light`: a reader who never opens this
 * setting gets precisely the app they got before it existed, and the setting is opt-in
 * rather than a change of behaviour disguised as a feature.
 *
 * `system` is first in the list for the same reason — it is the state an untouched app is
 * in, so it is the one the control should show as chosen.
 */

/** The three answers to "who decides", in the order the control draws them. */
export const THEME_MODES = ["system", "light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/**
 * Where the choice is remembered.
 *
 * `AsyncStorage` and not `expo-secure-store`, for the reason `lib/recent-searches.ts` gives
 * at length: this is a preference, not a credential, and the keychain is for the session.
 * The spelling matches `LOCALE_COOKIE`'s shape (`pymeshub_locale`) so the two preferences
 * read as a pair. It is *not* that constant and not in `@pymeshub/i18n`, because that
 * package is the words and this is not a word; and it is not shared with the web app today
 * because the web app has no switch to share it with — it follows `prefers-color-scheme`
 * only. If one is ever added there, this is the string it should write, so that "remembered"
 * keeps meaning the same thing on both clients.
 */
export const THEME_MODE_KEY = "pymeshub_theme";

/**
 * A stored value, if it is one of ours.
 *
 * `AsyncStorage` hands back whatever string is under the key, including one written by an
 * older build with a mode this version no longer has. Narrowing here rather than casting is
 * what stops a stale `"auto"` from reaching `palette[...]` and drawing `undefined` colours —
 * which is not a crash, just a screen with no theme at all.
 */
function isThemeMode(value: string | null): value is ThemeMode {
	return value !== null && (THEME_MODES as readonly string[]).includes(value);
}

type ThemeModeValue = {
	/** What the reader chose. `system` unless they said otherwise. */
	mode: ThemeMode;
	/** What that resolves to right now — what a screen should draw with. */
	scheme: ColorScheme;
	setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>("system");

	/**
	 * The OS answer, read once and only used when `mode` is `system`.
	 *
	 * This is `useColorScheme()` and not a subscription we keep ourselves — it is already
	 * one, and it already re-renders on change. Note it is read *unconditionally*, above
	 * the branch: a hook cannot be called conditionally, and reading it always costs a
	 * subscription the OS already maintains either way.
	 *
	 * `null` means the platform has no opinion, and it resolves to `light` — the behaviour
	 * `theme/index.ts` had before this file existed.
	 */
	const system: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";

	/**
	 * The stored choice, read once at boot — `lib/i18n.tsx`'s shape exactly, and for its
	 * reason: the first frame draws the OS answer and is corrected a moment later, which is
	 * better than holding the splash screen on a disk read to avoid a flash that only
	 * happens for readers who overrode their phone.
	 */
	useEffect(() => {
		let alive = true;
		void AsyncStorage.getItem(THEME_MODE_KEY).then((stored) => {
			if (alive && isThemeMode(stored)) setModeState(stored);
		});
		return () => {
			alive = false;
		};
	}, []);

	const setMode = useCallback((next: ThemeMode) => {
		setModeState(next);
		// Not awaited and not rolled back, for the reason the locale write gives: a failed
		// write costs one tap after the next launch. A preference is not worth an error.
		void AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {});
	}, []);

	const value = useMemo<ThemeModeValue>(
		() => ({
			mode,
			scheme: mode === "system" ? system : mode,
			setMode,
		}),
		[mode, system, setMode],
	);

	return <ThemeModeContext value={value}>{children}</ThemeModeContext>;
}

/**
 * The mode, for the one screen that offers it.
 *
 * Throws outside the provider rather than falling back to `system`, which is the same call
 * `useT()` and `useSession()` make and for the same reason: the fallback is a bug that
 * ships. A control rendered outside the provider would *look* right — `system` is the
 * default, so most of the time tapping it would appear to work — and would silently forget
 * the choice. A thrown error at the first render is found in a minute.
 */
export function useThemeMode(): ThemeModeValue {
	const value = use(ThemeModeContext);
	if (!value) {
		throw new Error(
			"useThemeMode() fuera de <ThemeModeProvider>. Lo monta el layout raíz.",
		);
	}
	return value;
}
