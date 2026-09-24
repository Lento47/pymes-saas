import { useIsFocused } from "expo-router";
import {
	type StyleProp,
	StyleSheet,
	TurboModuleRegistry,
	View,
	type ViewStyle,
} from "react-native";

import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { radius, space, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * The library, on the runtimes that have it — and `null` on the ones that do not.
 *
 * The import is lazy and it is wrapped, because `@maplibre/maplibre-react-native` is a
 * **native** module and its entry point registers its view managers at module scope with
 * `TurboModuleRegistry.getEnforcing("MLRNCameraModule")`. A runtime without that module in
 * its binary therefore does not get a broken map — it gets a **throwing import**, and an
 * import that throws takes the whole route with it: measured on the Android emulator, in
 * Expo Go, the discovery feed died with
 *
 *   Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'MLRNCameraModule' could not
 *   be found. Verify that a module by this name is registered in the native binary.
 *
 * and expo-router reported it as `Route "./(tabs)/index.tsx" is missing the required default
 * export` — which is a sentence about the route, and the cause was two files away.
 *
 * Expo Go cannot carry a custom native module (that is what Expo Go *is*), so this is not a
 * misconfiguration to fix: it is the ordinary case for anyone who opens the app the way its
 * README says to. The rule the rest of this file already follows decides it — *a missing
 * capability removes the capability, and never throws* (`docs/design-mobile.md`, and
 * `.env.example` for `EXPO_PUBLIC_MAP_STYLE_URL`). No native module, no map, and the band is absent exactly
 * as it is when the style URL is unset: no frame, no gap, nothing to explain.
 *
 * `require` rather than a top-level `import` is the entire mechanism — an ESM import is hoisted
 * and evaluated before any guard in the file can run, so there is no `try` that can cover it.
 * The result is cached because the failure is a property of the binary, not of the call.
 *
 * ## The `try` is not the first line of defence, and catching is not enough on its own
 *
 * Because of *who else* sees the throw: Metro wraps module factories in `guardedLoadModule`,
 * which reports the failure to LogBox **before** it rethrows. Measured on the emulator — the
 * guard caught it, the app kept working underneath, and every render of the band still painted
 * a red "Uncaught Error" box over the screen. On the screen that is a crash; only in the log is
 * it a caught exception.
 *
 * So the question is asked *before* the `require`, with `TurboModuleRegistry.get`, which returns
 * `null` where `getEnforcing` throws — a binary with no MapLibre in it is detected without an
 * exception ever being constructed. The `try` stays as the belt for a library upgrade that
 * enforces a module this list has never heard of.
 */
type MapLibreModule = typeof import("@maplibre/maplibre-react-native");

/**
 * The native modules `@maplibre/maplibre-react-native`'s entry point enforces at module scope.
 *
 * Read out of the installed library rather than guessed — all eleven `getEnforcing` calls in
 * `lib/commonjs/`, in the order its barrel reaches them. It is a list of *the library's* names
 * and it is expected to grow when the library does, which is the case the `try` below covers.
 */
const NATIVE_MODULES = [
	"MLRNCameraModule",
	"MLRNGeoJSONSourceModule",
	"MLRNImagesModule",
	"MLRNLocationModule",
	"MLRNLogModule",
	"MLRNMapViewModule",
	"MLRNNetworkModule",
	"MLRNOfflineModule",
	"MLRNStaticMapModule",
	"MLRNTransformRequestModule",
	"MLRNVectorSourceModule",
] as const;

/**
 * The cache lives on `globalThis`, not in a module-level `let`, and that is not a
 * micro-optimisation — a module-level one does not survive Fast Refresh.
 *
 * Measured on the emulator: with `let loaded` in this file, every edit that Fast Refresh
 * re-evaluated this module reset the cache and required the library again, and the second
 * evaluation of a library that registers `MLRNCamera` at module scope is an
 * `Invariant Violation: Tried to register two views with the same name MLRNCamera` — eight
 * of them, in one session, each one a red LogBox over the app. The first evaluation had
 * already thrown halfway through, so the registrations it got through are the ones the second
 * one collided with.
 *
 * `globalThis` outlives a Fast Refresh (the module registry does not), so the answer is
 * computed once per JS context, which is the same lifetime as the binary the answer is about.
 * The key is namespaced because it is a shared namespace.
 */
const CACHE_KEY = "__pymeshubMapLibre";

function loadMapLibre(): MapLibreModule | null {
	const cache = globalThis as { [CACHE_KEY]?: MapLibreModule | null };
	if (CACHE_KEY in cache) return cache[CACHE_KEY] ?? null;

	// Asked first, so that on a binary without MapLibre nothing throws and Metro has nothing to
	// report. `get` returns `null` for a module this build does not have; `getEnforcing` is the
	// one that throws, and it is the one the library calls for every name in the list above.
	for (const name of NATIVE_MODULES) {
		if (TurboModuleRegistry.get(name) == null) {
			cache[CACHE_KEY] = null;
			return null;
		}
	}

	try {
		cache[CACHE_KEY] =
			require("@maplibre/maplibre-react-native") as MapLibreModule;
	} catch {
		// A module enforced by a version of the library newer than this file's list.
		cache[CACHE_KEY] = null;
	}
	return cache[CACHE_KEY] ?? null;
}

/**
 * The basemap, on the phone — a picture of where the customer is.
 *
 * `./home-header` states the fact in words ("Entregar en · Tu ubicación actual") and this
 * is the same fact drawn. It goes under the hero rather than on a screen of its own
 * because there is nothing to *do* on it: the app has no marker layer, no pin picker and no
 * route, and a map you can only pan costs the feed a third of the fold to answer a question
 * the line above it already answered in one line. A band, then — the smallest one that
 * shows a neighbourhood.
 *
 * ## There is no `addProtocol` here, and that is the whole native story
 *
 * MapLibre Native reads PMTiles **below the JavaScript bridge** — it arrived with iOS
 * 6.10.0 and Android 11.8.0, and this app builds against 6.31.0 and 13.6.1, written by the
 * Expo config plugin in `app.config.ts` out of the versions the library ships. So the whole
 * configuration for a self-hosted archive is the string `pmtiles://https://…` in the style
 * document's `sources.*.url`, and there is no protocol to register: the fetch happens in C++
 * and React never sees it. The browser is the opposite case — `maplibre-gl` needs
 * `maplibregl.addProtocol("pmtiles", …)` **before** the map is constructed — which is one of
 * the two reasons the web map belongs to `apps/web` and this app's web build gets no map at
 * all. See `./map.web`.
 *
 * ## Absent config is an absent map
 *
 * `env.mapStyleUrl` unset means this returns `null` **before it renders anything**, so there
 * is no frame, no margin and no placeholder: a `<View>` wrapped around the map would still
 * pay its own `marginTop` and leave a gap where the map is not. `.env.example` spells the
 * rule out for this key — a missing value removes a capability and never throws.
 *
 * The same `null` covers "no coordinate yet", and deliberately: the map is a *picture of the
 * sentence above it*, and with no fix that sentence reads "Sin ubicación". A map centred on
 * a guess would be the one thing on this screen that is not true.
 *
 * ## Attribution is a licence condition, not copy
 *
 * Two credits are drawn and neither is redundant:
 *
 * - The **line over the map**, from `discovery.map.attribution`. OpenStreetMap's ODbL §4.3
 *   attaches the credit to the *Produced Work* rather than to whoever runs the tile server,
 *   so self-hosting the archive discharges nothing, and the OSMF's guidelines add that the
 *   credit must be visible **without an interaction**. That rules out leaning on the SDK's
 *   button, and it is why this line is text drawn on the surface.
 * - The **SDK's own ⓘ**, in the opposite corner, which opens the dialog MapLibre builds from
 *   the style's `sources.*.attribution`. That is the "way to access more information,
 *   including origin and licence" half, and it names whatever else the style carries — an
 *   OpenMapTiles-derived style's CC-BY 4.0 design credit, for instance, which stacks on top
 *   of ODbL and is the style author's to declare.
 *
 * Neither is dressed as brand chrome: the ⓘ keeps MapLibre's own tint rather than
 * `colors.primary`, because a required notice is not a place to decorate.
 *
 * ## What is not here
 *
 * No markers. `businessCardSchema` carries no coordinate — `distanceKm`, which the server
 * computes, is the only geographic fact a card has — so a pin layer could only invent
 * positions. It goes in when the API sends them, and not before.
 */
export type MapViewProps = {
	/**
	 * Where to centre, or `null` when the customer has not granted location.
	 *
	 * Nullable rather than optional so a caller cannot forget it: the screen already holds
	 * this value (`useDeviceLocation`) and the map is only ever the second reading of it.
	 */
	coords: { lat: number; lng: number } | null;
	/**
	 * A second position to drop a pin on, or `null` for none.
	 *
	 * The first caller is the buyer's tracker (`app/order/[id].tsx`), and the position is the
	 * courier's: the API has carried it since `orders.reportLocation` existed
	 * (`orderTrackingSchema.courier.lat`) and no surface had drawn it. It is optional and
	 * nullable because the four existing callers have no second position, and because a
	 * courier who has not shared one yet is the ordinary case rather than an error.
	 *
	 * The `coords` docblock's "no markers" note is retired by this prop and not contradicted
	 * by it: what that note refused was *inventing* a position the API had never sent. This one
	 * is sent.
	 */
	marker?: { lat: number; lng: number } | null;
	/**
	 * Where the band sits, which is the caller's. The band's *height*, radius, border and
	 * inset are this file's — a screen that sized the map would be a screen making a decision
	 * about a primitive, which `docs/design-mobile.md` puts here instead.
	 */
	style?: StyleProp<ViewStyle>;
};

/**
 * The band's height: five `huge` steps, 160 points.
 *
 * Written as a step of the spacing scale rather than as `160`, the way `./empty-state` builds
 * its badge — the scale is the repo's only vocabulary for "how big is this surface", and a
 * bare number here is a number no other file can reason about. Tall enough to read a
 * neighbourhood at `STREET_ZOOM`, short enough that the search field above it is still the
 * largest single shape on the fold.
 */
const BAND_HEIGHT = space.huge * 5;

/**
 * 14 — a neighbourhood.
 *
 * The question this band answers is "which shops are around me", and the answer is the few
 * blocks a person can walk. Zoomed out to a city it is a shape with no information in it;
 * zoomed to a street it is one building with no context. There is no token for a zoom level
 * and there should not be — it belongs to the map, like the band's height.
 */
const STREET_ZOOM = 14;

/**
 * 2 — the courier pin's ring.
 *
 * The app's border vocabulary is hairline or 1, and a 2 is deliberately outside it: at 1
 * the ring disappears against the street tiles it is drawn over, and the dot's job —
 * telling the courier's own location apart from the SDK's — dies with it. The ring's
 * colour is `colors.card`, so the weight is the one number this surface owns, the way
 * `./merchant-pulse` owns its 11-point label: the documented exception, not a third step.
 */
const PIN_RING_WIDTH = 2;

export function MapView({ coords, marker, style }: MapViewProps) {
	const { colors } = useTheme();
	const { t } = useT();
	// Called before the guard below, with the other hooks, because it is a hook: the early
	// `return null` sits under it and the order has to be the same on every render.
	const focused = useIsFocused();

	// Read before the guard rather than after it, so the three reasons to draw nothing are one
	// `if`: no style, no coordinate, or no MapLibre in this binary.
	const MapLibre = loadMapLibre();

	// Before anything is rendered, which is the whole point: an unconfigured map leaves the
	// screen exactly as it was rather than leaving a hole in it.
	const mapStyleUrl = env.mapStyleUrl;
	if (!mapStyleUrl || !coords || !MapLibre) return null;

	const { Camera, Map: MapLibreMap, Marker, UserLocation } = MapLibre;

	return (
		<View style={[styles.band, { borderColor: colors.border }, style]}>
			<MapLibreMap
				mapStyle={mapStyleUrl}
				// Android draws into a `SurfaceView` by default, and a `SurfaceView` is
				// composited *below* the window rather than into it — so the band's
				// `overflow: "hidden"` cannot clip it and the corners would come out square
				// inside a rounded frame. The texture variant is an ordinary view and clips
				// like one. The trade is a surface copied per frame rather than handed to the
				// compositor, which for 160 points of a basemap that barely moves is no trade.
				androidView="texture"
				// Set explicitly rather than left to a default. The ODbL credit is not
				// something to inherit from a library version: if a release changes what the
				// default is, the required notice should not be what disappears.
				attribution
				// Bottom-right, so it never sits under the credit line at bottom-left.
				attributionPosition={{ bottom: space.sm, right: space.sm }}
				// One label for the whole surface. Without it a screen reader walks
				// MapLibre's own view tree and announces position after position; the map is
				// decoration here, and the fact it draws is in the hero's line above it.
				accessibilityLabel={t("discovery.map.label")}
				accessible
			>
				<Camera center={[coords.lng, coords.lat]} zoom={STREET_ZOOM} />

				{/* The SDK's location manager, rendered only when a fix already exists — so it
				    never asks for a permission the customer has not been asked for, and the
				    "you are here" dot is live rather than the single coordinate that centred
				    the camera.

				    Only while this band is the screen in front of somebody, which is not the
				    same as while it is mounted. `Tabs` keeps a screen mounted after the customer
				    leaves it, so this map has been staying alive on the storefront, in the cart
				    and on every dish page since the app opened: `UserLocation` is MapLibre's own
				    location manager, and mounted it is a subscription that keeps producing fixes
				    for a dot nobody can see. Unmounting it stops the updates rather than merely
				    hiding them — the component is the subscription.

				    The map itself is left mounted, and that is the deliberate half. `MapLibreMap`
				    is a native view; unmounting and remounting it per tab switch would rebuild
				    the render surface and re-request tiles, which costs more than the view it
				    saves. What is not left running is the thing that never stops on its own. */}
				{focused ? <UserLocation /> : null}

				{/* The courier, when there is one to draw. A `Marker` and not the SDK's location
				    manager: this position arrives over the API from somebody else's phone, so the
				    map must not treat it as a fix of its own. `ViewAnnotation` would be cheaper
				    for a static picture, and this is not one — the position changes every time
				    the buyer's poll lands.

				    Its child is the pin itself, and the dot is drawn from tokens rather than
				    from an icon font: a map pin is not a glyph in `Ionicons`' set, and a PNG
				    would be an asset to keep in step with the palette. */}
				{marker ? (
					<Marker lngLat={[marker.lng, marker.lat]} anchor="center">
						<View
							style={[
								styles.pin,
								{ backgroundColor: colors.primary, borderColor: colors.card },
							]}
						/>
					</Marker>
				) : null}
			</MapLibreMap>

			{/* `pointerEvents="none"` so the credit cannot swallow a pan that starts on it.
			    It stays in the accessibility tree either way, which is what a notice wants: a
			    sighted reader sees it, and a reader who cannot has it read to them. */}
			<View
				pointerEvents="none"
				style={[
					styles.credit,
					{ backgroundColor: colors.card, borderColor: colors.border },
				]}
			>
				<Text variant="caption" tone="muted">
					{t("discovery.map.attribution")}
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	band: {
		height: BAND_HEIGHT,
		// `lg` is the token for sheets and heroes, and this band is part of the hero.
		borderRadius: radius.lg,
		borderWidth: 1,
		overflow: "hidden",
	},
	// The courier's dot: `md` across, ringed in the card colour so it stays legible over a
	// dark street and a light one. Bigger than the SDK's own location dot, because the two
	// can be on this map at the same time and the reader needs to tell them apart.
	pin: {
		width: space.md,
		height: space.md,
		borderRadius: radius.full,
		borderWidth: PIN_RING_WIDTH,
	},
	credit: {
		position: "absolute",
		left: space.sm,
		bottom: space.sm,
		// Not the full width: at 200% text the line wraps onto two or three lines rather
		// than spanning the band. A credit that has covered the thing it credits is worse
		// than one that is tall.
		maxWidth: "70%",
		paddingHorizontal: space.xs,
		paddingVertical: space.xs,
		// `sm` is the control step, and this is a small solid surface rather than a
		// control. It is deliberately not `full`: a pill would read as a chip, and a chip
		// is a filter.
		borderRadius: radius.sm,
		borderWidth: 1,
	},
});
