import Constants from "expo-constants";

/**
 * The root `.env`, as much of it as a phone is allowed to see.
 *
 * Nothing here is a secret and nothing here can be: an `EXPO_PUBLIC_*` name is inlined
 * into the bundle by Metro's textual substitution, and a phone bundle is a file anyone
 * who installs the app can unzip. That is why `AUTH_SECRET` is not in this file — the
 * clients are handed an origin and nothing else, and identity is verified inside the
 * Worker (`AGENTS.md`).
 *
 * Each value is read twice, on purpose. `process.env.EXPO_PUBLIC_*` is the inlined copy
 * and the one that normally wins; `Constants.expoConfig.extra` is the same value read
 * back out of the app manifest at runtime, which is the belt to that braces. The two can
 * disagree in exactly one situation and it is a real one: Metro's **transform cache is
 * not keyed on the value**, so a variable changed without `--clear` can keep serving the
 * build in which it was old. The manifest is regenerated on every start, so the fallback
 * degrades to "the value from the config" rather than to "no value at all".
 * `apps/mobile/app.config.ts` is where the `extra` copy is put.
 */

/**
 * A value that is either a usable string or absent.
 *
 * `extra` is `Record<string, any>` — the shape of an app manifest is not knowable ahead
 * of the config that builds it — so reading a key out of it yields `any` and would quietly
 * make every field that touches it `any` too. That matters for the map, whose whole rule
 * is "no value means no map": a field typed `any` cannot be checked at the one place the
 * check is the feature.
 */
function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const env = {
	apiUrl:
		process.env.EXPO_PUBLIC_API_URL ||
		Constants.expoConfig?.extra?.apiUrl ||
		"http://localhost:8787",

	/**
	 * The basemap's MapLibre style document, or `undefined` when this install has none.
	 *
	 * Undefined is a **capability that is absent, not a failure**: `./components/map`
	 * returns `null` before it renders anything, so the discovery hero keeps the height and
	 * the spacing it has without a map and the screen does not move. There is no grey box
	 * and nothing throws — `AGENTS.md`'s rule for every optional key, and `.env.example`
	 * carries it.
	 *
	 * It is `undefined` rather than `""` so that a caller can ask `if (!env.mapStyleUrl)`
	 * without a second thought about which falsy value it got.
	 */
	mapStyleUrl: optionalString(
		process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
			Constants.expoConfig?.extra?.mapStyleUrl,
	),
};
