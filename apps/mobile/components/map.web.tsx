import type { StyleProp, ViewStyle } from "react-native";

/**
 * The map, on the web target — and there is deliberately no map here.
 *
 * `apps/mobile`'s web build is a **Playwright harness**, not a product surface. The web app
 * is `apps/web`; this bundle exists so the same screens can be driven in a browser during a
 * test run, and what is being driven is the hero, the feed and the cart — never the map.
 *
 * Drawing one here would not be free:
 *
 * - **It is a different library.** `maplibre-gl` is the browser's renderer and
 *   `@maplibre/maplibre-react-native` is the phone's; they share a style spec and no code.
 *   Its ~800 KB would land in an export whose only job is to be testable.
 * - **The PMTiles path is the opposite one.** Native reads `pmtiles://` itself, below the
 *   JS bridge. A browser cannot: `maplibre-gl` needs `pmtiles`' `Protocol` registered with
 *   `maplibregl.addProtocol("pmtiles", protocol.tile)` **before** the map is constructed, and
 *   that is a real dependency plus a registration order to get right — in the one bundle
 *   that is never shipped.
 * - **A `null` here is the same `null` as a missing key elsewhere.** This component's rule is
 *   that a map it cannot draw is no map at all: nothing on the screen moves, the hero keeps
 *   its height and its spacing, and `./map` behaves identically on a phone with no
 *   `EXPO_PUBLIC_MAP_STYLE_URL`. A reduced-but-present map on web would be a second
 *   behaviour to keep true, for nobody.
 *
 * ## The props are spelled out rather than imported from `./map`
 *
 * That is not duplication for its own sake. On the web platform Metro resolves `./map` from
 * *this file* back to *this file* — `map.web.tsx` is tried before `map.tsx` — so the import
 * would be a self-import, and the only thing keeping it harmless would be the compiler
 * erasing it. `tsc` knows nothing about platform extensions and would resolve it to
 * `map.tsx`, so the two files would agree in the type checker while Metro saw something
 * else entirely. Spelling the shape out keeps the question from arising, and the shape is
 * two fields: drift shows up as a call site that stops compiling, not as a wrong map.
 */
export function MapView(_props: {
	coords: { lat: number; lng: number } | null;
	style?: StyleProp<ViewStyle>;
}) {
	return null;
}
