/**
 * Which merchant theme is in force, and the rule that decides it.
 *
 * ## Why this is its own file, and why it imports exactly one thing
 *
 * For the reason `./select.ts` gives: the rule has to be runnable under `bun test` against
 * the real function, with no React Native runtime, no module mock and no preload. So this
 * file imports `./business-theme-ids` — three constants and no dependencies — and nothing
 * else. `./tokens.ts` is unreachable from here: it reaches `react-native` for `Platform`,
 * and a rule that can only be tested behind a mock is a rule nobody tests.
 *
 * The return is an id, not a palette, for the same reason. Whoever reads it decides what a
 * theme is worth; this file never imports the thing it is choosing between.
 */

import {
	BUSINESS_THEME_IDS,
	type BusinessThemeId,
	DEFAULT_BUSINESS_THEME,
} from "./business-theme-ids";

export { BUSINESS_THEME_IDS, type BusinessThemeId, DEFAULT_BUSINESS_THEME };

/**
 * A stored value, if it names a theme this build still has.
 *
 * `AsyncStorage` hands back whatever string is under the key, including one written by an
 * older build whose theme has since been removed — and ids are persisted, so that is a
 * real case rather than a theoretical one. Narrowing here rather than casting is what
 * stops a stale `"lime "` (with the whitespace a hand-edited backup leaves) from reaching
 * `businessThemes[...]` and yielding `undefined`, which is not a crash: it is a screen
 * whose every colour is missing.
 *
 * So an unknown id resolves to `DEFAULT_BUSINESS_THEME` and the reader gets the palette
 * they had before the theme was removed. That is a better failure than throwing on launch,
 * and better than rendering a hole.
 */
export function resolveBusinessTheme(
	stored: string | null | undefined,
): BusinessThemeId {
	if (
		typeof stored === "string" &&
		(BUSINESS_THEME_IDS as readonly string[]).includes(stored)
	) {
		return stored as BusinessThemeId;
	}
	return DEFAULT_BUSINESS_THEME;
}

/**
 * The themes in the order the picker should draw them.
 *
 * The order is the declaration order and it is a *design* order, not an alphabetical one:
 * `lime` first because it is the default and an untouched device is in it, then the three
 * siblings by how far their hue travels from it — warm `amber`, hot `coral`, cool `sky`.
 * A picker that reorders itself when a theme is added is a picker that moves the control
 * out from under the finger that was reaching for it.
 */
export function businessThemeOrder(): readonly BusinessThemeId[] {
	return BUSINESS_THEME_IDS;
}
