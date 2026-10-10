import type { CameraRef } from "@maplibre/maplibre-react-native";
import { useIsFocused } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Platform,
	type StyleProp,
	StyleSheet,
	TurboModuleRegistry,
	View,
	type ViewStyle,
} from "react-native";

import { env } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { radiusPolygon, radiusPolygonBounds } from "@/lib/radius-polygon";
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
	...(Platform.OS === "ios" ? ["MLRNImagesModule"] : []),
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

export function isMapAvailable(): boolean {
	return Boolean(env.mapStyleUrl && loadMapLibre());
}

/**
 * The native basemap for choosing a shop position or following a delivery.
 *
 * Home no longer mounts it: the header already states the customer's location, and a
 * basemap with no decision to make would spend the shopping fold on the same fact twice.
 * Here a pin, radius or route gives the band a concrete job.
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
 * The same `null` covers "no coordinate yet": a map centred on a guess would claim a
 * position the screen does not know.
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
 * No public business markers. `businessCardSchema` carries no coordinate — `distanceKm`,
 * which the server computes, is the only geographic fact a card has — so a marketplace
 * pin layer could only invent positions. The shop-position and courier markers here use
 * coordinates those screens actually have.
 */
export type MapViewProps = {
	/**
	 * Where to centre, or `null` when the customer has not granted location.
	 *
	 * Nullable rather than optional so a caller cannot forget it: the screen must supply
	 * the position it actually knows.
	 */
	coords: { lat: number; lng: number } | null;
	zoom?: number;
	showUserLocation?: boolean;
	/** Names this map's purpose to a screen reader when it is not the discovery map. */
	accessibilityLabel?: string;
	/**
	 * A second position to drop a pin on, or `null` for none.
	 *
	 * The first caller is the buyer's tracker (`app/order/[id].tsx`), and the position is the
	 * courier's: the API has carried it since `orders.reportLocation` existed
	 * (`orderTrackingSchema.courier.lat`) and no surface had drawn it. It is optional and
	 * nullable because a map need not have a second position, and because a
	 * courier who has not shared one yet is the ordinary case rather than an error.
	 *
	 * A marker must come from a real position, not an invented public-business pin.
	 */
	marker?: { lat: number; lng: number } | null;
	/** The fixed pickup and delivery endpoints for an active delivery. */
	route?: {
		pickup: { lat: number; lng: number };
		destination: { lat: number; lng: number };
		/** A server-validated road shape; endpoints alone never imply a straight route. */
		geometry?: {
			type: "LineString";
			coordinates: [number, number][];
		} | null;
	} | null;
	/**
	 * Where the band sits, which is the caller's. The band's *height*, radius, border and
	 * inset are this file's — a screen that sized the map would be a screen making a decision
	 * about a primitive, which `docs/design-mobile.md` puts here instead.
	 */
	style?: StyleProp<ViewStyle>;
	/**
	 * Report the point the reader tapped, or `null`/`undefined` for a map you cannot touch.
	 *
	 * This is what makes the band a **picker**, and it is the reason a shop can ever have a
	 * coordinate: `businessUpdateInput` has carried an optional `lat`/`lng` since before this
	 * file existed and `businesses.ts` propagates them onto the default `merchant_location`,
	 * but until this prop nothing in the app was willing to *send* a pair. Every `lat:` in
	 * `apps/mobile` was a read. So the dispatch radius — measured from the pickup, see
	 * `OFFER_RADIUS_KM` in `delivery-dispatch.ts` — had no origin to measure from, and a
	 * shop with delivery enabled simply never received an offer, silently.
	 *
	 * Optional and nullable rather than required because four of the five callers show a
	 * position and none of them may edit one: a customer cannot move their own house, and a
	 * buyer watching a courier cannot drag the courier. A screen that offers a tap is
	 * claiming the reader is choosing something.
	 */
	onPick?: ((coords: { lat: number; lng: number }) => void) | null;
	/**
	 * Draw a ring of this many kilometres around `coords`, or `null` for none.
	 *
	 * Kilometres, not metres and not degrees, because the one thing a caller wants to say
	 * about it is the same number the dispatcher gates on, and the server's own distance
	 * function (`haversineKm` in `packages/db/src/geo.ts`) is the reference this circle is
	 * meant to match. Passing anything else would draw a circle that quietly disagrees with
	 * the rule that produced the number.
	 *
	 * The circle is a 64-sided polygon in **geographic** coordinates rather than a
	 * `CircleLayer` with a metre radius: a MapLibre circle layer measures in pixels and would
	 * grow with the zoom, which is the opposite of what this is for. These vertices are
	 * kilometres, so the drawn edge is the edge the gate uses.
	 *
	 * Nullable rather than optional-with-a-default for the reason every value on this type
	 * is: an absent radius must draw nothing rather than draw *some* circle, because a wrong
	 * circle on this map is a merchant being told something untrue about who can reach them.
	 */
	radiusKm?: number | null;
	/** Frame the complete radius when its pin or size changes (courier zone picker). */
	fitRadius?: boolean;
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

/** Both ends of a local delivery fit comfortably at this scale. */
const ROUTE_ZOOM = 12;

/**
 * How opaque the inside of the ring is drawn.
 *
 * 0.12, which is a number about street tiles rather than about the radius: the fill's only
 * job is to say "inside here" without becoming the thing the reader looks at. At 0.3 and up
 * a 15 km disc is a coloured continent — the basemap under it stops being evidence, and this
 * map's job is to let somebody judge a position against real streets. Low enough that the
 * tiles read through it, strong enough to tint.
 */
const RADIUS_FILL_OPACITY = 0.12;

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
const RADIUS_CAMERA_PADDING = 32;

export function MapView({
	coords,
	marker,
	radiusKm,
	fitRadius = false,
	route,
	style,
	onPick,
	zoom,
	showUserLocation = true,
	accessibilityLabel,
}: MapViewProps) {
	const { colors } = useTheme();
	const { t } = useT();
	// Called before the guard below, with the other hooks, because it is a hook: the early
	// `return null` sits under it and the order has to be the same on every render.
	const focused = useIsFocused();
	const cameraRef = useRef<CameraRef>(null);
	const lastFittedBounds = useRef<string | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
	const radiusLat = marker?.lat ?? coords?.lat;
	const radiusLng = marker?.lng ?? coords?.lng;
	const radius = useMemo(
		() =>
			radiusPolygon(
				radiusLat === undefined || radiusLng === undefined
					? null
					: { lat: radiusLat, lng: radiusLng },
				radiusKm ?? null,
			),
		[radiusLat, radiusLng, radiusKm],
	);
	const radiusBounds = useMemo(() => radiusPolygonBounds(radius), [radius]);
	const pickupLat = route?.pickup.lat;
	const pickupLng = route?.pickup.lng;
	const destinationLat = route?.destination.lat;
	const destinationLng = route?.destination.lng;
	const routeGeometry = route?.geometry;
	const routeBounds = useMemo(() => {
		if (
			pickupLat === undefined ||
			pickupLng === undefined ||
			destinationLat === undefined ||
			destinationLng === undefined
		)
			return null;
		const endpoints: [number, number][] = [
			[pickupLng, pickupLat],
			[destinationLng, destinationLat],
		];
		const points = routeGeometry?.coordinates.length
			? [...endpoints, ...routeGeometry.coordinates]
			: endpoints;
		const longitudes = points.map(([lng]) => lng);
		const latitudes = points.map(([, lat]) => lat);
		const bounds = [
			Math.min(...longitudes),
			Math.min(...latitudes),
			Math.max(...longitudes),
			Math.max(...latitudes),
		] as [number, number, number, number];
		return bounds.every(Number.isFinite) &&
			(bounds[0] !== bounds[2] || bounds[1] !== bounds[3])
			? bounds
			: null;
	}, [pickupLat, pickupLng, destinationLat, destinationLng, routeGeometry]);
	const visibleBounds = (fitRadius && radiusBounds) || routeBounds;

	useEffect(() => {
		if (!mapReady || !mapSize.width || !mapSize.height || !visibleBounds)
			return;
		// Polling can return a new geometry object with the same extent. Preserve the
		// reader's pan/zoom unless the actual route extent or map size changed.
		const fitKey = `${mapSize.width}:${mapSize.height}:${visibleBounds.join(":")}`;
		if (lastFittedBounds.current === fitKey) return;
		const camera = cameraRef.current;
		if (!camera) return;
		lastFittedBounds.current = fitKey;
		camera.fitBounds(visibleBounds, {
			padding: {
				top: RADIUS_CAMERA_PADDING,
				right: RADIUS_CAMERA_PADDING,
				bottom: RADIUS_CAMERA_PADDING,
				left: RADIUS_CAMERA_PADDING,
			},
			duration: 250,
			easing: "ease",
		});
	}, [mapReady, mapSize.width, mapSize.height, visibleBounds]);

	// Read before the guard rather than after it, so the three reasons to draw nothing are one
	// `if`: no style, no coordinate, or no MapLibre in this binary.
	const MapLibre = loadMapLibre();
	const mapCenter = route
		? {
				lat: (route.pickup.lat + route.destination.lat) / 2,
				lng: (route.pickup.lng + route.destination.lng) / 2,
			}
		: coords;

	// Before anything is rendered, which is the whole point: an unconfigured map leaves the
	// screen exactly as it was rather than leaving a hole in it.
	const mapStyleUrl = env.mapStyleUrl;
	if (!mapStyleUrl || !mapCenter || !MapLibre) return null;

	const {
		Camera,
		GeoJSONSource,
		Layer,
		Map: MapLibreMap,
		Marker,
		UserLocation,
	} = MapLibre;

	// The ring is drawn around `marker ?? coords` — around the position being talked about —
	// and not around `mapCenter`, which is the camera.
	//
	// On a picker the reader moves the pin with a tap, and a ring left where the camera was
	// centred would be showing the limit for a position they are no longer choosing. No
	// caller passes `radiusKm` together with `route`, and `route` draws its own two endpoints
	// regardless, so the two can never disagree about which point the ring means.
	return (
		<View
			style={[styles.band, { borderColor: colors.border }, style]}
			onLayout={
				fitRadius || route
					? (event) => {
							const { width, height } = event.nativeEvent.layout;
							setMapSize((previous) =>
								previous.width === width && previous.height === height
									? previous
									: { width, height },
							);
						}
					: undefined
			}
		>
			<MapLibreMap
				mapStyle={mapStyleUrl}
				onDidFinishLoadingMap={
					fitRadius || route ? () => setMapReady(true) : undefined
				}
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
				// its position is described by the surrounding screen's text.
				accessibilityLabel={accessibilityLabel ?? t("discovery.map.label")}
				accessible
				// Only wired when a caller asked for it, and `undefined` rather than a
				// no-op function in every other case: a handler that is always attached is a
				// handler every future reader has to rule out, and the non-picker callers
				// must not be one tap away from claiming the reader moved something.
				onPress={
					onPick
						? (event) => {
								// MapLibre's `LngLat` is a **tuple**, `[longitude, latitude]`
								// — not the `{ latitude, longitude }` object the web SDK's
								// `MapMouseEvent` uses. The two orderings are opposite, and
								// reading a tuple as an object would have type-checked
								// nowhere and swapped Costa Rica for the Gulf of Guinea.
								const [lng, lat] = event.nativeEvent.lngLat;
								onPick({ lat, lng });
							}
						: undefined
				}
			>
				<Camera
					ref={cameraRef}
					{...(visibleBounds
						? {
								initialViewState: {
									bounds: visibleBounds,
									padding: {
										top: RADIUS_CAMERA_PADDING,
										right: RADIUS_CAMERA_PADDING,
										bottom: RADIUS_CAMERA_PADDING,
										left: RADIUS_CAMERA_PADDING,
									},
								},
							}
						: {
								center: [mapCenter.lng, mapCenter.lat] as [number, number],
								zoom: zoom ?? (route ? ROUTE_ZOOM : STREET_ZOOM),
							})}
				/>

				{radius ? (
					<GeoJSONSource id="mapRadius" data={radius}>
						{/* Two layers rather than one, because the reader has to tell *where the
					    limit is* from *which side of it the shop is on*. A fill alone answers
					    the second and hides the first under the street tiles; a line alone is a
					    hairline that disappears against them, which is the exact failure
					    `PIN_RING_WIDTH` exists to prevent for the pin. So: a low-opacity fill
					    for the area, and a 2-point line for the edge, matching the pin's own
					    weight so the two read as one drawing. */}
						<Layer
							id="mapRadiusFill"
							type="fill"
							paint={{
								"fill-color": colors.primary,
								"fill-opacity": RADIUS_FILL_OPACITY,
							}}
						/>
						{fitRadius ? (
							<Layer
								id="mapRadiusOutline"
								type="line"
								paint={{ "line-color": colors.card, "line-width": 5 }}
							/>
						) : null}
						<Layer
							id="mapRadiusLine"
							type="line"
							paint={{
								"line-color": colors.primary,
								"line-width": fitRadius ? 3 : PIN_RING_WIDTH,
							}}
						/>
					</GeoJSONSource>
				) : null}

				{route?.geometry ? (
					<GeoJSONSource
						id="deliveryRoadRoute"
						data={{
							type: "Feature",
							properties: {},
							geometry: route.geometry,
						}}
					>
						<Layer
							id="deliveryRoadRouteLine"
							type="line"
							paint={{
								"line-color": colors.primary,
								"line-width": 4,
								"line-opacity": 0.9,
							}}
						/>
					</GeoJSONSource>
				) : null}

				{route ? (
					<>
						<Marker
							lngLat={[route.pickup.lng, route.pickup.lat]}
							anchor="center"
						>
							<View
								style={[
									styles.pin,
									{
										backgroundColor: colors.success,
										borderColor: colors.card,
									},
								]}
							/>
						</Marker>
						<Marker
							lngLat={[route.destination.lng, route.destination.lat]}
							anchor="center"
						>
							<View
								style={[
									styles.pin,
									{
										backgroundColor: colors.destructive,
										borderColor: colors.card,
									},
								]}
							/>
						</Marker>
					</>
				) : null}

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
				{focused && showUserLocation ? <UserLocation /> : null}

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
		// `md`: the card step — the same corner `./card` draws, so the band
		// reads as one of the screen's surfaces rather than as a hero.
		borderRadius: radius.md,
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
