import {
	createTranslator,
	DEFAULT_LOCALE,
	isLocale,
	LOCALE_COOKIE,
	type Locale,
	resolveLocale,
	type Translator,
} from "@pymeshub/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

/**
 * The words, chosen once for the whole app.
 *
 * The locale comes from the device, not from a URL — the same rule the web app follows,
 * and on a phone it is not even a choice: there is no path segment to put it in. A
 * customer whose phone is in Spanish gets Spanish; the account screen offers the other
 * language, and the choice is remembered under the same key the web app writes, so a
 * customer who sets it in one client reads the other the same way.
 */

type I18nValue = {
	t: Translator["t"];
	tp: Translator["tp"];
	locale: Locale;
	intlLocale: string;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * What the device says, in the shape `resolveLocale` already understands.
 *
 * `getLocales()` returns `[{languageTag: "es-CR", ...}]` in the reader's own preference
 * order, and `resolveLocale`'s `acceptLanguage` branch is exactly "an ordered list of
 * tags, best first" — the HTTP header and this array are the same information in two
 * spellings. Reusing that parser instead of writing a second one is what keeps the phone
 * and the Worker agreeing about a phone set to `["en-GB", "es"]`: English wins on both,
 * because the order is the reader's, not ours.
 */
function deviceLocale(): Locale {
	try {
		return resolveLocale({
			acceptLanguage: Localization.getLocales()
				.map((entry) => entry.languageTag)
				.join(","),
		});
	} catch {
		// A device whose locale list cannot be read is not a reason to show keys instead of
		// words. Spanish is the default for the same reason it is the default everywhere here.
		return DEFAULT_LOCALE;
	}
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(deviceLocale);

	/**
	 * An explicit choice, read once at boot.
	 *
	 * Async because `AsyncStorage` is: the first frame renders the device's language and
	 * is corrected a moment later if the customer chose differently. The alternative —
	 * holding the splash screen until storage answers — makes every cold start wait on a
	 * disk read to save a flash that only happens for people who overrode their phone.
	 *
	 * The key is `LOCALE_COOKIE` rather than a mobile-only spelling, because it is the
	 * same key: the value is a two-letter locale, and "remembered" should mean the same
	 * thing on a phone and in a browser.
	 */
	useEffect(() => {
		let alive = true;
		void AsyncStorage.getItem(LOCALE_COOKIE).then((stored) => {
			if (alive && isLocale(stored)) setLocaleState(stored);
		});
		return () => {
			alive = false;
		};
		// Runs once: this reads the stored preference, it does not track it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		// Deliberately not awaited, and deliberately not rolled back on failure. A write
		// that fails costs the customer one tap after the next launch — this is a
		// preference, not a session, and there is nothing here worth an error dialog.
		void AsyncStorage.setItem(LOCALE_COOKIE, next).catch(() => {});
	}, []);

	const value = useMemo<I18nValue>(() => {
		const translator = createTranslator(locale);
		return {
			t: translator.t,
			tp: translator.tp,
			locale: translator.locale,
			intlLocale: translator.intlLocale,
			setLocale,
		};
	}, [locale, setLocale]);

	return <I18nContext value={value}>{children}</I18nContext>;
}

/**
 * The translator.
 *
 * Throws outside the provider rather than falling back to Spanish, for the same reason
 * `useSession()` throws: a fallback is a bug that ships. A screen rendered outside the
 * provider would look *fine* — Spanish is the default and most screens would read
 * correctly — right up until a customer switches to English and finds one screen that
 * did not move. A thrown error at the first render is found in a minute; the silent
 * fallback is found by a customer.
 */
export function useT(): I18nValue {
	const value = use(I18nContext);
	if (!value) {
		throw new Error("useT() fuera de <I18nProvider>. Lo monta el layout raíz.");
	}
	return value;
}
