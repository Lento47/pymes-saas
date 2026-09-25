import { loadRootEnv } from "@pymeshub/env";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * The Expo config, and the one place the repo's single `.env` becomes the phone's.
 *
 * This file runs in **Node**, under the Expo CLI, and never in the app bundle. That is
 * what makes it useful: `@pymeshub/env`'s real module — the one that walks up to the
 * workspace marker and reads the root `.env` — resolves here, while every screen gets a
 * stub with no filesystem at all. One `.env`, read here and by
 * `apps/web/next.config.ts` alike, so the two clients cannot be pointed at different
 * APIs by a second copy of the value.
 */
loadRootEnv();

/**
 * Republished under the name a bundle can see, before Metro's first transform.
 *
 * Metro inlines `process.env.EXPO_PUBLIC_*` by **textual substitution while it transforms
 * a file**, so the value has to be in the CLI process's environment before that happens —
 * and this config is evaluated during CLI startup, ahead of Metro. The assignment below
 * is what puts it there. `lib/env.ts` then reads the inlined name and falls back to the
 * `extra` copy, which is the belt to that braces: a stale transform cache degrades to
 * "read from the config" rather than to "no API address".
 */
const apiUrl =
	process.env.EXPO_PUBLIC_API_URL ||
	process.env.API_URL ||
	"http://localhost:8787";
process.env.EXPO_PUBLIC_API_URL = apiUrl;

const mapStyleUrl =
	process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
	"https://maps.pymeshub.lat/styles/pymeshub/style.json";
process.env.EXPO_PUBLIC_MAP_STYLE_URL = mapStyleUrl;

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: "PymesHub",
	slug: "pymeshub",
	version: "0.1.0",
	orientation: "portrait",
	userInterfaceStyle: "automatic",
	scheme: "pymeshub",
	// Placeholders, and deliberately not real: an EAS project's credentials are stored in
	// EAS, never in the repo. `com.pymeshub.app` has to be replaced before a store build.
	// No `usesAppleSignIn` with them: `apps/api/src/auth.ts` registers no social provider,
	// so the entitlement would declare a sign-in the app cannot start.
	ios: { bundleIdentifier: "com.pymeshub.app", supportsTablet: true },
	// `android.edgeToEdgeEnabled` used to sit here and it cannot come back, for two reasons
	// and the second is the one that would survive a type cast:
	//
	// 1. The type this file is checked against — `@expo/config-types@57.0.2`, resolved through
	//    `expo/config` — declares no such member on `Android`, so re-adding the line is a
	//    TS2353 ("'edgeToEdgeEnabled' does not exist in type 'Android'"). Dropping it was
	//    collateral of the Supabase removal rather than a decision about sign-in.
	// 2. `@expo/prebuild-config@57.0.16`'s `plugins/unversioned/edge-to-edge/withEdgeToEdge.js`
	//    no longer implements the key at all: it tests only whether the key is *present* and
	//    warns "`edgeToEdgeEnabled` customization is no longer available - Android 16 makes
	//    edge-to-edge mandatory. Remove the `edgeToEdgeEnabled` entry from your app.json/app.config.js."
	//    So SDK 57 would strip the entry and warn about it even if TypeScript allowed it, which
	//    is why the honest fix is to leave it out rather than cast a value past the checker.
	//
	// Edge-to-edge is therefore not a setting this app owns — Android 16 enforces it. What the
	// app must do instead is the part it *can* control: keep content out from under the system
	// bars with the safe-area insets (`theme/index.ts`) rather than by opting out of the mode.
	android: { package: "com.pymeshub.app" },
	plugins: [
		"expo-router",
		"expo-localization",
		"expo-secure-store",
		// Release signing for the Android build. **This entry is the only place a release
		// key is named**, and even here only by environment variable — `android/` is
		// prebuild output, so a signing config typed into `app/build.gradle` is one that
		// vanishes on the next `expo prebuild --clean`. The plugin writes it; the keystore
		// and its passwords live outside this repository and travel in `PYMESHUB_UPLOAD_*`
		// (`docs/environment.md`, `.env.example`).
		"./plugins/with-android-release-signing",
		// MapLibre Native, for `components/map.tsx`. **This entry is the only place a native
		// dependency is declared.** `apps/mobile/android` and `ios/` are prebuild output and
		// `.gitignore` ignores both, so a version written into a Gradle file or a Podfile is
		// a version that vanishes on the next `expo prebuild --clean`; the plugin is what
		// writes them, from what the library ships.
		//
		// No `props` on purpose. The defaults are iOS 6.31.0 and Android 13.6.1, and PMTiles
		// needs iOS 6.10.0 / Android 11.8.0 — comfortably above the floor, and pinning a
		// number here would freeze a version the library is meant to bump. If that pair ever
		// falls below the floor, the map stops rendering tiles and reports nothing, which is
		// the failure to watch for rather than a build error.
		"@maplibre/maplibre-react-native",
		// `expo-location` is listed even though autolinking already applies its plugin,
		// because the defaults it applies are wrong for this app in three ways, and this
		// entry is the only place to correct them. Measured with
		// `bunx expo config --type introspect`, which generates the real Info.plist and
		// AndroidManifest on any platform — including Windows, where neither can be built.
		//
		// 1. The purpose string was the plugin's template, literally
		//    "Allow $(PRODUCT_NAME) to access your location" — the entire text a customer
		//    reads in the iOS permission dialog. App Review asks what a permission is *for*
		//    (5.1.1), and a template answers nothing. Spanish because that is the language
		//    the app's own screens are in; localizing it per store region is the follow-up,
		//    not something a single string can do.
		// 2. `NSLocationAlwaysAndWhenInUseUsageDescription` and
		//    `NSLocationAlwaysUsageDescription` were both declared while
		//    `lib/location.ts` only ever calls `requestForegroundPermissionsAsync`. Asking
		//    Apple for background location the app cannot use is a capability declared and
		//    not needed, and the reviewer's next question is what it is for. They are two
		//    options, not one — `withLocation.js:116-117` reads the first from
		//    `locationAlwaysAndWhenInUsePermission` and the second from the legacy
		//    `locationAlwaysPermission` — so removing one from the plist takes both.
		// 3. `NSMotionUsageDescription` came along the same way. Nothing here reads motion
		//    activity — the "near me" sort is one `getCurrentPositionAsync` with
		//    `Accuracy.Balanced` — so the declaration goes.
		//
		// `false` removes a key rather than emptying it; the introspected plist is what says
		// so, and it is why this is set here instead of being asserted.
		[
			"expo-location",
			{
				locationWhenInUsePermission:
					"PymesHub usa tu ubicación para mostrarte los negocios cerca de ti.",
				locationAlwaysAndWhenInUsePermission: false,
				locationAlwaysPermission: false,
				isIosBackgroundLocationEnabled: false,
				isAndroidBackgroundLocationEnabled: false,
				motionUsagePermission: false,
			},
		],
	],
	experiments: { typedRoutes: true },
	// `mapStyleUrl` is the belt to `lib/env.ts`'s braces, exactly as `apiUrl` is: Metro's
	// transform cache is not keyed on the value, so a `EXPO_PUBLIC_*` name changed without
	// `--clear` can keep serving the old one. This manifest is regenerated on every start,
	// so the fallback is a map drawn from the current value rather than a map that is
	// silently the previous one. The Cloudflare-hosted style is the shared default; a
	// specific build can replace it with `EXPO_PUBLIC_MAP_STYLE_URL`.
	extra: { apiUrl, mapStyleUrl },
});
