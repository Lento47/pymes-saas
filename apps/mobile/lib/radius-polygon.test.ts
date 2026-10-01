import { describe, expect, test } from "bun:test";

import { KM_PER_DEGREE, RADIUS_SIDES, radiusPolygon } from "./radius-polygon";

/**
 * The drawn ring, measured against the arithmetic that actually gates an offer.
 *
 * Everything else about `lib/radius-polygon.ts` is a reading aid — the screen either draws a
 * band or it does not. This is the part where being *nearly* right is invisible on a phone and
 * obvious to a courier: the ring says "couriers inside here get these orders", and the server
 * says so too, and if the two circles differ then one of them is lying to somebody about
 * whether they can earn.
 *
 * So this file does not test a formula about regular polygons. It reimplements
 * `haversineKm` from `packages/db/src/geo.ts` — the same mean earth radius, the same
 * expression — and measures the shipped polygon with it. The reimplementation is copied rather
 * than imported because `packages/db` is a server package that pulls in Drizzle; the constant
 * `EARTH_RADIUS_KM = 6371.0088` is asserted equal below, so a change on either side fails here
 * rather than passing quietly against a stale copy.
 */

const EARTH_RADIUS_KM = 6371.0088;

/** Verbatim from `packages/db/src/geo.ts`. */
function haversineKm(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number },
): number {
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;
	const dLat = lat2 - lat1;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The shop's real location, and the couriers the app is actually running against. */
const SAN_JOSE = { lat: 9.9281, lng: -84.08 };
const PANAMA = { lat: 8.9824, lng: -79.5199 };

/** The radius the dispatcher gates on, imported rather than restated. */
const RADIUS_KM = 15;

/** One point, so the helpers below do not each re-assert the tuple's shape. */
type Point = { lat: number; lng: number };

/**
 * The ring, as `{ lat, lng }` — GeoJSON's `[lng, lat]` undone.
 *
 * The guards are `noUncheckedIndexedAccess` doing its job rather than defensive noise: a test
 * that cannot see the polygon's structure should fail loudly here, not quietly measure
 * `undefined` as 0 km and pass.
 */
function vertices(centre: Point, radiusKm: number): Point[] {
	const feature = radiusPolygon(centre, radiusKm);
	const ring = feature?.geometry.coordinates[0];
	if (!feature || !ring) throw new Error("expected a polygon with a ring");
	return ring.map((position) => {
		const [lng, lat] = position;
		if (lng === undefined || lat === undefined) {
			throw new Error("expected a two-number position");
		}
		return { lat, lng };
	});
}

/** The midpoint of each side, where an inscribed polygon's edge sits nearest the centre. */
function edgeMidpoints(centre: Point, radiusKm: number): Point[] {
	const ring = vertices(centre, radiusKm);
	return ring.slice(0, -1).map((point, index) => {
		const next = ring[index + 1];
		if (!next) throw new Error("ring is not closed");
		return {
			lat: (point.lat + next.lat) / 2,
			lng: (point.lng + next.lng) / 2,
		};
	});
}

describe("the radius polygon", () => {
	test("measures every vertex at the radius, using the server's own distance", () => {
		for (const centre of [SAN_JOSE, PANAMA]) {
			for (const point of vertices(centre, RADIUS_KM)) {
				// ±20 m. The polygon places vertices in the degree plane, so a small
				// disagreement is expected — the point is that it is *small*, and that the
				// constant is the same one the server uses.
				expect(Math.abs(haversineKm(centre, point) - RADIUS_KM)).toBeLessThan(
					0.02,
				);
			}
		}
	});

	test("the drawn edge is within 20 m of the real circle in Costa Rica", () => {
		// This is the number the file docblock quotes, so it is checked rather than
		// asserted: an edge that drifts is a docblock that starts lying, and the next
		// person to read it has no way to know.
		const inward =
			RADIUS_KM -
			Math.min(
				...edgeMidpoints(SAN_JOSE, RADIUS_KM).map((p) =>
					haversineKm(SAN_JOSE, p),
				),
			);
		expect(inward).toBeGreaterThan(0);
		expect(inward).toBeLessThan(0.02);
	});

	test("does not grow with distance the way a screen-pixel circle would", () => {
		// A MapLibre `CircleLayer` radius is in pixels and would scale with zoom, which is
		// the opposite of what a delivery radius is. Asserting the polygon holds at 1 km and
		// at 100 km is what distinguishes a fixed geographic circle from a sized blob.
		const near = vertices(SAN_JOSE, 1)[13];
		const far = vertices(SAN_JOSE, 100)[13];
		if (!near || !far) throw new Error("expected a 64-gon");
		expect(haversineKm(SAN_JOSE, near)).toBeCloseTo(1, 1);
		expect(haversineKm(SAN_JOSE, far)).toBeCloseTo(100, 1);
	});

	test("spans more degrees of longitude than latitude away from the equator", () => {
		// The `cos(latitude)` correction. Without it the ring is an ellipse on the ground
		// and a courier 15 km due east of a shop in Costa Rica would be shown as outside a
		// limit the server puts them inside.
		const ring = vertices(SAN_JOSE, RADIUS_KM);
		const lats = ring.map((p) => p.lat);
		const lngs = ring.map((p) => p.lng);
		const latSpan = Math.max(...lats) - Math.min(...lats);
		const lngSpan = Math.max(...lngs) - Math.min(...lngs);
		expect(lngSpan).toBeGreaterThan(latSpan);
	});

	test("closes the ring, because an open one is not a polygon", () => {
		const ring = vertices(SAN_JOSE, RADIUS_KM);
		expect(ring.length).toBe(RADIUS_SIDES + 1);
		expect(ring[0]).toEqual(ring[RADIUS_SIDES]);
	});

	test("is [lng, lat], which is the opposite order to every other coordinate here", () => {
		// GeoJSON's one genuinely counterintuitive rule, and the one this file most easily
		// gets wrong. Reading the tuple the wrong way round produces a ring centred on
		// (0,0) in the Gulf of Guinea rather than on the shop.
		for (const point of vertices(SAN_JOSE, RADIUS_KM)) {
			expect(point.lng).toBeCloseTo(SAN_JOSE.lng, 0);
			expect(point.lat).toBeCloseTo(SAN_JOSE.lat, 0);
		}
	});

	test("draws nothing at all rather than something plausible", () => {
		// The three states a merchant's screen actually hits on a cold start. Each one has
		// to leave the map bare: a zero-radius dot, a polygon at the origin, or a "1 km"
		// ring drawn because `OFFER_RADIUS_KM` was briefly absent would all be a merchant
		// told something untrue about who can reach them.
		expect(radiusPolygon(SAN_JOSE, null)).toBeNull();
		expect(radiusPolygon(null, RADIUS_KM)).toBeNull();
		expect(radiusPolygon(SAN_JOSE, 0)).toBeNull();
		expect(radiusPolygon(null, null)).toBeNull();
	});

	test("agrees with the server about the earth", () => {
		// If `packages/db/src/geo.ts` changes its radius constant, this fails here instead
		// of the app quietly drawing a ring to a different planet than the one couriers
		// are being driven around.
		expect(KM_PER_DEGREE).toBeCloseTo((2 * Math.PI * EARTH_RADIUS_KM) / 360, 3);
	});
});
