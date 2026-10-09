/**
 * The circle a courier has to be inside, as a polygon MapLibre will draw.
 *
 * ## Why it is its own module
 *
 * Because it is the only piece of `components/map.tsx` that is arithmetic rather than a view,
 * and it is the piece whose correctness nobody can see by looking at the screen. Everything
 * else in that file is judged by whether the band appears; this is judged by whether the ring
 * it draws is the ring the server gates on — a difference no screenshot would ever reveal.
 *
 * So it lives here, importing nothing, where `bun test` can run it. `components/map.tsx`
 * cannot be imported under `bun test` for the reason `lib/tab-bar-coverage.test.ts` gives:
 * it pulls in `react-native` and `expo-router`, and neither resolves outside a bundler.
 *
 * The counterpart on the server is `haversineKm` in `packages/db/src/geo.ts`, and
 * `lib/radius-polygon.test.ts` measures this against that function's own arithmetic rather
 * than against a formula about regular polygons.
 */

/**
 * How many sides the polygon has.
 *
 * 64, for a reason the test states rather than asserts: the worst-case sagitta of a regular
 * `n`-gon inscribed in a circle of radius `r` is `r * (1 - cos(π/n))`. At 64 sides and 15 km
 * that is 18 m at the equator. Measured against `haversineKm` itself, the drawn edge sits
 * **19 m** inside the real circle at 9.93°N — Costa Rica — and never more than 38 m anywhere
 * up to 71°N, with the vertices themselves landing within ±1.2 m of 15.000 km. At 8 sides the
 * same measurement is **1.14 km** of error: over a kilometre of drawn edge sitting inside the
 * real one, which at map zoom is the difference between a ring and a lie.
 */
export const RADIUS_SIDES = 64;

/**
 * Kilometres per degree, at the equator.
 *
 * One number for latitude and longitude both, because on a sphere they are the same length:
 * `2πR / 360` for the IUGG mean radius `R = 6371.0088 km` gives **111.195 km** — the same `R`
 * `packages/db/src/geo.ts` measures with, which is what keeps the two in agreement.
 *
 * Longitude does not stay that long away from the equator, and the `cos(latitude)` that
 * shortens it is applied per vertex in `radiusPolygon` rather than folded in here, which is
 * why the name says "equator".
 *
 * 111.195 rather than the more familiar 111.32, which is the *equatorial* degree of longitude
 * and not the mean degree of latitude. They agree at the equator and diverge by about 0.1%
 * poleward; mixing them is the kind of near-miss that never announces itself as an error. Over
 * 15 km that is 16 m, so this choice is not what decides the answer — it is spelled out so the
 * next reader does not have to re-derive it.
 */
export const KM_PER_DEGREE = 111.195;

/**
 * A circle of `radiusKm` around `centre`, as a GeoJSON polygon — or `null` when there is
 * nothing to draw.
 *
 * `null` for the degenerate inputs, because both are real states a merchant's screen hits on
 * a cold start and both should leave the map with nothing on it rather than a dot or a shape
 * spanning the antimeridian: a radius that is absent, and a centre that is absent. A radius of
 * `0` is a point, not a circle, and drawing it would put a zero-area polygon where the rule
 * says "no courier is eligible".
 *
 * ## The one approximation here, stated rather than hidden
 *
 * **The ring is a reading of the rule, not the rule.** Nobody is admitted or refused by this
 * polygon. The vertices are placed on a circle in the degree plane, which is exact between
 * vertices and does apply the `cos(latitude)` shortening of longitude, so it agrees with the
 * server's great-circle distance to within the sagitta quoted above. The authority for who
 * receives an offer is `haversineKm`, gated by `OFFER_RADIUS_KM`. If the drawn edge and the
 * gate ever disagree, the server is right and this is a picture of it.
 */
export function radiusPolygon(
	centre: { lat: number; lng: number } | null,
	radiusKm: number | null,
): GeoJSON.Feature<GeoJSON.Polygon> | null {
	if (!centre || !radiusKm || radiusKm <= 0) return null;

	// Longitude degrees shrink with latitude, so the same kilometre budget spans more and more
	// degrees as the shop moves poleward. At 9.93°N that factor is 0.9877, so a 15 km ring is
	// 0.1349° tall and 0.1366° wide — a circle in kilometres, not in degrees.
	const latDelta = radiusKm / KM_PER_DEGREE;
	const lngDelta =
		radiusKm / (KM_PER_DEGREE * Math.cos((centre.lat * Math.PI) / 180));

	// GeoJSON positions are `[lng, lat]` — the opposite order to the `{ lat, lng }` every other
	// signature in this app uses, and the single easiest thing to get wrong here.
	const ring = Array.from({ length: RADIUS_SIDES }, (_, step) => {
		const bearing = (step / RADIUS_SIDES) * 2 * Math.PI;
		return [
			centre.lng + lngDelta * Math.cos(bearing),
			centre.lat + latDelta * Math.sin(bearing),
		] as [number, number];
	});

	// A GeoJSON linear ring is closed: the first vertex repeated as the last. Leaving it out
	// is not a shorter way of writing the same polygon, it is a different — invalid —
	// geometry, and MapLibre drops a polygon whose ring is not closed rather than repairing it.
	const [first] = ring;
	// `RADIUS_SIDES` is 64, so the ring is never empty and `first` is always set. The guard is
	// for `noUncheckedIndexedAccess`, not for a case that can occur, and `!` would be
	// asserting a fact about a constant instead of narrowing a variable.
	if (first) ring.push(first);

	return {
		type: "Feature",
		properties: {},
		geometry: { type: "Polygon", coordinates: [ring] },
	};
}

/** The smallest camera rectangle containing the polygon's geographic edge. */
export function radiusPolygonBounds(
	polygon: GeoJSON.Feature<GeoJSON.Polygon> | null,
): [west: number, south: number, east: number, north: number] | null {
	const ring = polygon?.geometry.coordinates[0];
	if (!ring?.length) return null;
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (const [lng, lat] of ring) {
		if (lng === undefined || lat === undefined) continue;
		west = Math.min(west, lng);
		south = Math.min(south, lat);
		east = Math.max(east, lng);
		north = Math.max(north, lat);
	}
	return Number.isFinite(west) &&
		Number.isFinite(south) &&
		Number.isFinite(east) &&
		Number.isFinite(north)
		? [west, south, east, north]
		: null;
}
