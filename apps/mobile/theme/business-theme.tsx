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

import {
	BUSINESS_THEME_IDS,
	type BusinessThemeId,
	DEFAULT_BUSINESS_THEME,
} from "./business-theme-ids";
import { resolveBusinessTheme } from "./business-theme-select";

export { BUSINESS_THEME_IDS, type BusinessThemeId, DEFAULT_BUSINESS_THEME };

/**
 * Which merchant palette this device draws the owner console in.
 *
 * ## What this is, and what it deliberately is not
 *
 * It is **not** a second light/dark switch. `./mode.tsx` already answers "who decides the
 * scheme" and that question is settled; this one answers "which palette", and a merchant
 * on a dark phone choosing `coral` is choosing an accent, not a scheme. The two compose —
 * `businessThemeColors(id, scheme)` takes both — and neither one is allowed to answer for
 * the other. A control that appeared to set the brightness and did not is the exact failure
 * this file is written to avoid: it is what `Settings → Tema → Oscuro` used to do in this
 * tree, because `useTheme()` returned a light-only palette whatever the mode said.
 *
 * ## Why `AsyncStorage` and not the server
 *
 * The same reason `./mode.tsx` gives: this is a preference, not a credential, and the
 * keychain is for the session. The key is named beside `THEME_MODE_KEY` so the two read as
 * a pair. It is *not* synced across devices, and that is a real limitation rather than an
 * oversight — a merchant who picks a palette on a phone and a tablet picks it twice. The
 * alternative is a preference column, a migration and a procedure, and a per-device
 * preference is a coherent thing to have on its own.
 *
 * ## The boot frame
 *
 * The stored choice is read once at boot and the first frame draws the default, exactly as
 * `./mode.tsx` does and for its reason: holding a splash screen on a disk read to avoid a
 * flash that only happens to readers who overrode their phone is the worse trade. A merchant
 * who picked `coral` sees lime for a frame and then coral, which is a correction; the
 * alternative is a white screen for a tenth of a second on every cold start.
 */

/** Where the choice is remembered. Beside `THEME_MODE_KEY`, never inside it. */
export const BUSINESS_THEME_KEY = "pymeshub_business_theme";

type BusinessThemeValue = {
	/** What this device chose. `lime` unless they said otherwise. */
	id: BusinessThemeId;
	/** Every id the picker offers, in the order it should draw them. */
	available: readonly BusinessThemeId[];
	setId: (id: BusinessThemeId) => void;
};

const BusinessThemeContext = createContext<BusinessThemeValue | null>(null);

export function BusinessThemeProvider({ children }: { children: ReactNode }) {
	// `DEFAULT_BUSINESS_THEME` and not the first id: the default is the palette the tree
	// drew before this file existed, which is a decision rather than an ordering accident.
	const [id, setIdState] = useState<BusinessThemeId>(DEFAULT_BUSINESS_THEME);

	useEffect(() => {
		let alive = true;
		void AsyncStorage.getItem(BUSINESS_THEME_KEY).then((stored) => {
			if (alive) setIdState(resolveBusinessTheme(stored));
		});
		return () => {
			alive = false;
		};
	}, []);

	const setId = useCallback((next: BusinessThemeId) => {
		setIdState(next);
		// Not awaited and not rolled back, for the reason `./mode.tsx` gives: a failed write
		// costs one tap after the next launch. A preference is not worth an error dialog.
		void AsyncStorage.setItem(BUSINESS_THEME_KEY, next).catch(() => {});
	}, []);

	const value = useMemo<BusinessThemeValue>(
		() => ({ id, available: BUSINESS_THEME_IDS, setId }),
		[id, setId],
	);

	return <BusinessThemeContext value={value}>{children}</BusinessThemeContext>;
}

/**
 * The theme in force, for `useTheme()` and the picker.
 *
 * Throws outside the provider rather than falling back to the default, which is the same
 * call `useThemeMode()` and `useThemeScope()` make and for their reason: the fallback is a
 * bug that ships. A picker rendered outside the provider would *look* right — `lime` is the
 * default, so most of the time tapping it would appear to work — and would silently forget
 * the choice. A thrown error at the first render is found in a minute.
 */
export function useBusinessTheme(): BusinessThemeValue {
	const value = use(BusinessThemeContext);
	if (!value) {
		throw new Error(
			"useBusinessTheme() fuera de <BusinessThemeProvider>. Lo monta el layout raíz.",
		);
	}
	return value;
}
