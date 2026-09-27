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
	"https://api.pymeshub.lat";
process.env.EXPO_PUBLIC_API_URL = apiUrl;

const mapStyleUrl =
	process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
	// Stable production style served from the public map-assets bucket — see
	// `docs/technical/architecture/cloudflare-and-maps.md`.
	//
	// The planned self-hosted endpoint at `pymeshub.lat/api/map/style.json` must not become
	// the default until it returns JSON and its PMTiles range checks pass. In production it
	// currently falls through to the SPA and returns HTML, which MapLibre cannot parse.
	"https://maps.pymeshub.lat/styles/pymeshub/style.json";
process.env.EXPO_PUBLIC_MAP_STYLE_URL = mapStyleUrl;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
	process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: "PymesHub",
	slug: "pymeshub",
	version: "0.1.0",
	orientation: "portrait",
	userInterfaceStyle: "automatic",
	scheme: "pymeshub",
	// The launcher icon, for the app as installed. Three files, because the platforms
	// genuinely disagree about what an icon is:
	//
	// - `assets/icon.png` is the legacy/Android-7-and-earlier square and the iOS icon.
	//   It is deliberately **opaque**: iOS rejects an app icon that carries an alpha
	//   channel, so the plate is baked in rather than left to the system.
	// - `assets/adaptive-icon.png` is the Android 8+ foreground layer alone, on
	//   transparency, with the plate supplied by `adaptiveIcon.backgroundColor` below.
	//   Android crops and masks this layer per launcher, so the mark is inset to 57.6%
	//   of the canvas: an adaptive icon is 108dp of which only the central 72dp is
	//   guaranteed visible, and 590 of 1024px keeps the whole mark inside that circle
	//   whatever shape the launcher cuts.
	// - `assets/monochrome-icon.png` is the Android 13+ themed icon: a flat silhouette
	//   whose alpha the system tints with the wallpaper palette. It is derived from the
	//   mark's own alpha rather than redrawn, so it can never drift from the artwork.
	//
	// All three are generated from `packages/ui/src/components/pymeshub-logo.png`, the
	// one copy of the mark in the repo, on the app's own dark background (`#110e0b`,
	// `theme/tokens.ts`) so the launcher and the first screen agree. Each is 1024px
	// square, the mark at 700px for the legacy/iOS plate and 590px for the two masked
	// layers; regenerating means resizing that source, not redrawing it.
	//
	// Worth knowing before looking for this on a device: the icon is compiled into the
	// APK/AAB, so it changes only on a **rebuild**. Expo Go keeps showing the Expo Go
	// icon no matter what is set here, and a reload of the dev server cannot change it.
	icon: "./assets/icon.png",
	// The reverse-domain identifier is shared by the Android application id and the
	// iOS bundle id so store builds, deep links and native credentials all name the
	// same PymesHub mobile application.
	// No `usesAppleSignIn` with them: `apps/api/src/auth.ts` registers no social provider,
	// so the entitlement would declare a sign-in the app cannot start.
	ios: { bundleIdentifier: "app.pymeshub.lat", supportsTablet: true },
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
	android: {
		package: "app.pymeshub.lat",
		// The two-layer launcher icon. `backgroundColor` is the plate rather than a
		// ninth image: a flat colour is what lets the launcher's own mask, parallax and
		// themed-icon tint all work, and it is the one value here that has to agree with
		// `theme/tokens.ts` by hand.
		adaptiveIcon: {
			foregroundImage: "./assets/adaptive-icon.png",
			backgroundColor: "#110e0b",
			monochromeImage: "./assets/monochrome-icon.png",
		},
	},
	plugins: [
		"expo-router",
		"expo-localization",
		"expo-secure-store",
		// `expo-splash-screen`, for the launch screen. Autolinking brings in the native
		// module, but not the *configuration*: without this entry the plugin never runs,
		// and what ships instead is the prebuild template's own splash — a `#FFFFFF`
		// background (the plugin's own documented default) carrying a grey placeholder
		// grid, not the mark. That is a white flash in an app whose background is
		// `#110e0b`, and it is invisible from Expo Go, so it is the kind of thing that
		// reaches a device and is only noticed once it is there.
		//
		// The image is `assets/adaptive-icon.png` — the same mark-on-transparency file
		// the Android adaptive foreground uses, because both want the artwork without a
		// baked-in plate. `dark` repeats the background rather than inheriting the
		// default: `userInterfaceStyle` is `automatic` and this app ships a light theme
		// too, so without it the launch screen would go white on a device set to dark
		// and the flash would come back for exactly the readers most likely to notice it.
		[
			"expo-splash-screen",
			{
				image: "./assets/adaptive-icon.png",
				imageWidth: 200,
				resizeMode: "contain",
				backgroundColor: "#110e0b",
				dark: { backgroundColor: "#110e0b" },
			},
		],
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
					"PymesHub usa tu ubicación para mostrar negocios cercanos y compartir tu posición durante una entrega activa.",
				locationAlwaysAndWhenInUsePermission: false,
				locationAlwaysPermission: false,
				isIosBackgroundLocationEnabled: false,
				isAndroidBackgroundLocationEnabled: false,
				motionUsagePermission: false,
			},
		],
		// `expo-image-picker`, for `components/photo-picker`. Same reason as
		// `expo-location`: autolinking applies the plugin with its template strings, and
		// this entry is the only place they are corrected. Spanish because that is the
		// language the app's own screens are in.
		//
		// `microphonePermission: false` blocks `RECORD_AUDIO` on Android and drops
		// `NSMicrophoneUsageDescription` on iOS. A picture picker that asks for a
		// microphone is a capability declared and not needed, and the reviewer's next
		// question is what it is for — the same rule that removed the three
		// `expo-location` keys above.
		[
			"expo-image-picker",
			{
				photosPermission:
					"PymesHub usa tus fotos para que puedas agregar imágenes a tus productos.",
				cameraPermission:
					"PymesHub usa tu cámara para que puedas tomar fotos de tus productos.",
				microphonePermission: false,
			},
		],
		// `expo-audio`, for `lib/new-order-sound.ts` — interface.md §57's new-order chime.
		// Same reason as the two entries above: autolinking applies the plugin with its own
		// defaults, and this entry is the only place they are corrected. Every default would
		// declare a capability a 620ms foreground chime does not use:
		//
		// 1. `microphonePermission` defaults to the template "Allow $(PRODUCT_NAME) to access
		//    your microphone", and `recordAudioAndroid` defaults to `true` — together
		//    `NSMicrophoneUsageDescription` and `android.permission.RECORD_AUDIO`. This app
		//    records nothing. A chime that asks for a microphone is a capability declared
		//    and not needed, and the reviewer's next question is what it is for — the same
		//    rule that stripped the three `expo-location` keys and the picker's mic.
		// 2. `enableBackgroundPlayback` defaults to `true`, which writes
		//    `UIBackgroundModes: ['audio']` on iOS and `FOREGROUND_SERVICE` plus
		//    `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and a mediaPlayback foreground service on
		//    Android. The chime is news about an order on a screen the operator is looking
		//    at; it plays in the foreground or not at all, and `AudioMode`'s
		//    `shouldPlayInBackground: false` is set to match.
		//
		// `android.permission.MODIFY_AUDIO_SETTINGS` the plugin always adds and there is no
		// prop for it. It is the one declaration that survives, and it is what the ringer and
		// silent-mode handling in `lib/new-order-sound.ts` talks to.
		[
			"expo-audio",
			{
				microphonePermission: false,
				recordAudioAndroid: false,
				enableBackgroundPlayback: false,
				enableBackgroundRecording: false,
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
	extra: { apiUrl, mapStyleUrl, supabaseUrl, supabasePublishableKey },
});
