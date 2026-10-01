/**
 * The merchant theme ids, and nothing else.
 *
 * ## Why this file exists instead of living in `./tokens.ts`
 *
 * So that the *rule* about which theme is in force can be tested without a React Native
 * runtime. `./tokens.ts` imports `Platform` from `react-native` for `shadow`, and nothing
 * in this repo's test suite loads `react-native` — `./select.ts` makes the same argument
 * for the same reason and its test says so in full.
 *
 * The ids are data, not design: this file has no imports, so `./tokens.ts` can re-export
 * them for callers that already import it and `./business-theme-select.ts` can import them
 * directly. One list, two consumers, no copy to drift.
 *
 * These strings are **persisted** — written to `AsyncStorage` and read back on the next
 * launch — so an id is not renameable the way a variable is. Adding a theme is safe;
 * removing or renaming one strands whatever a device stored under the old name, which is
 * why `resolveBusinessTheme` falls back rather than throwing.
 */
export const BUSINESS_THEME_IDS = ["lime", "amber", "coral", "sky"] as const;

export type BusinessThemeId = (typeof BUSINESS_THEME_IDS)[number];

/**
 * `lime`, because it is the palette the merchant tree has always drawn. A device that has
 * never opened the theme picker must get exactly what it had before the picker existed.
 */
export const DEFAULT_BUSINESS_THEME: BusinessThemeId = "lime";
