import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  dateFnsLocales,
  intlLocales,
  normalizeLocale,
  type AppTranslations,
  type SupportedLocale,
  translations,
} from "@/lib/i18n";

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  messages: AppTranslations;
  intlLocale: string;
  dateFnsLocale: (typeof dateFnsLocales)[SupportedLocale];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored ? normalizeLocale(stored) : null;
  } catch {
    return null;
  }
}

function readNavigatorLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const preferred = navigator.languages?.[0] ?? navigator.language;
  return normalizeLocale(preferred);
}

function resolveInitialLocale(workspaceLocale?: string | null): SupportedLocale {
  if (workspaceLocale) return normalizeLocale(workspaceLocale);

  const stored = readStoredLocale();
  if (stored) return stored;

  return readNavigatorLocale();
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workspaceLocale = user?.workspace?.locale;
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveInitialLocale(workspaceLocale));
  const manuallySet = useRef(false);

  // Only set from workspace locale on first load, not on manual changes
  useEffect(() => {
    if (!workspaceLocale || manuallySet.current) return;

    const nextLocale = normalizeLocale(workspaceLocale);
    if (nextLocale === locale) return;

    try { localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale); } catch {}

    startTransition(() => {
      setLocaleState(nextLocale);
    });
  }, [workspaceLocale]);

  useEffect(() => {
    document.documentElement.lang = intlLocales[locale];

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore localStorage write issues.
    }
  }, [locale]);

  const setLocale = (nextLocale: SupportedLocale) => {
    if (nextLocale === locale) return;
    manuallySet.current = true;

    startTransition(() => {
      setLocaleState(nextLocale);
    });
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        messages: translations[locale],
        intlLocale: intlLocales[locale],
        dateFnsLocale: dateFnsLocales[locale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }

  return context;
}
