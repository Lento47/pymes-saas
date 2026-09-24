/**
 * Geohash, because D1 has no spatial index.
 *
 * The pattern the marketplace uses for "near me" is: a geohash prefix narrows the
 * candidate set to one cell, SQL narrows it further with a bounding box, and
 * `haversineKm` does the final check on the handful of rows that survive. At city
 * scale that is exact and cheap; at national scale it is the first thing to
 * replace. See `docs/domain.md`.
 *
 * The one bug worth naming: a business 50 metres away is very often in the *next*
 * cell, because cell edges are arbitrary lines that nothing in the real world
 * respects. Querying a single hash therefore loses the nearest result — the worst
 * possible miss — so every lookup queries the cell and its eight neighbours.
 */

/** The standard geohash alphabet. Excludes `a`, `i`, `l` and `o`. */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

const MAX_PRECISION = 9;

/** Mean earth radius. Good enough for a delivery radius, wrong for a survey. */
const EARTH_RADIUS_KM = 6371.0088;

export interface Coordinates {
	lat: number;
	lng: number;
}

export interface BoundingBox {
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
}

/**
 * Interleave the bits of the longitude and latitude binary searches, five at a
 * time, one base32 character per five bits.
 *
 * Longitude goes first. That is the convention, not a detail: swapping the two
 * produces a hash that looks perfectly well-formed and sorts every neighbouring
 * business into a cell on the other side of the planet.
 */
export function encodeGeohash(
	lat: number,
	lng: number,
	precision = MAX_PRECISION,
): string {
	if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
		throw new RangeError(`Latitude out of range: ${lat}`);
	}
	if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
		throw new RangeError(`Longitude out of range: ${lng}`);
	}

	const chars = Math.max(1, Math.min(MAX_PRECISION, Math.trunc(precision)));

	let latMin = -90;
	let latMax = 90;
	let lngMin = -180;
	let lngMax = 180;

	let hash = "";
	let bits = 0;
	let bitCount = 0;
	let takeLongitude = true;

	while (hash.length < chars) {
		if (takeLongitude) {
			const mid = (lngMin + lngMax) / 2;
			if (lng >= mid) {
				bits = (bits << 1) | 1;
				lngMin = mid;
			} else {
				bits <<= 1;
				lngMax = mid;
			}
		} else {
			const mid = (latMin + latMax) / 2;
			if (lat >= mid) {
				bits = (bits << 1) | 1;
				latMin = mid;
			} else {
				bits <<= 1;
				latMax = mid;
			}
		}

		takeLongitude = !takeLongitude;
		bitCount += 1;

		if (bitCount === 5) {
			hash += BASE32.charAt(bits);
			bits = 0;
			bitCount = 0;
		}
	}

	return hash;
}

/** The four directions a cell can be adjacent in. */
const NEIGHBOUR_TABLE = {
	n: {
		even: "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
		odd: "bc01fg45238967deuvhjyznpkmstqrwx",
	},
	s: {
		even: "14365h7k9dcfesgujnmqp0r2twvyx8zb",
		odd: "238967debc01fg45kmstqrwxuvhjyznp",
	},
	e: {
		even: "bc01fg45238967deuvhjyznpkmstqrwx",
		odd: "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
	},
	w: {
		even: "238967debc01fg45kmstqrwxuvhjyznp",
		odd: "14365h7k9dcfesgujnmqp0r2twvyx8zb",
	},
} as const;

/** The last character that means "this cell is on the edge, carry into the parent". */
const BORDER_TABLE = {
	n: { even: "prxz", odd: "bcfguvyz" },
	s: { even: "028b", odd: "0145hjnp" },
	e: { even: "bcfguvyz", odd: "prxz" },
	w: { even: "0145hjnp", odd: "028b" },
} as const;

type Direction = keyof typeof NEIGHBOUR_TABLE;

function adjacent(hash: string, direction: Direction): string {
	if (hash === "") {
		throw new Error("Cannot find a neighbour of an empty geohash");
	}

	const lastChar = hash[hash.length - 1] as string;
	// Which of the two tables applies flips with the hash length: the bits in a
	// geohash alternate latitude/longitude, so an odd-length hash ends on the
	// opposite axis from an even-length one, and north/south and east/west swap.
	const parity = hash.length % 2 === 1 ? "odd" : "even";
	const parent = hash.slice(0, -1);

	const base = BORDER_TABLE[direction][parity].includes(lastChar)
		? adjacent(parent, direction)
		: parent;

	const index = NEIGHBOUR_TABLE[direction][parity].indexOf(lastChar);
	if (index < 0) {
		throw new Error(`Invalid geohash character: ${lastChar}`);
	}
	return base + BASE32.charAt(index);
}

/**
 * The eight cells around `hash`, in compass order starting north and going
 * clockwise: n, ne, e, se, s, sw, w, nw.
 *
 * Includes the diagonals, which are the ones people leave out and the ones that
 * matter: a shop one cell north and one cell east of the customer is inside the
 * delivery radius and in none of the four orthogonal neighbours.
 */
export function geohashNeighbours(hash: string): string[] {
	const n = adjacent(hash, "n");
	const s = adjacent(hash, "s");
	const e = adjacent(hash, "e");
	const w = adjacent(hash, "w");

	return [
		n,
		adjacent(n, "e"),
		e,
		adjacent(s, "e"),
		s,
		adjacent(s, "w"),
		w,
		adjacent(n, "w"),
	];
}

/** The cell and its eight neighbours — what a nearby search actually queries. */
export function geohashSearchCells(hash: string): string[] {
	return [hash, ...geohashNeighbours(hash)];
}

/**
 * A lat/lng box around a point. Longitude degrees shrink as you leave the
 * equator, so the divisor is `cos(lat)` — without it a radius near the pole
 * covers a sliver of the intended area, and in Costa Rica it is already wrong by
 * about 1%.
 */
export function boundingBox(
	lat: number,
	lng: number,
	radiusKm: number,
): BoundingBox {
	const latDelta = radiusKm / 111.32;
	const cosLat = Math.cos((lat * Math.PI) / 180);
	// A hair off the pole `cos(lat)` is zero and the delta is infinite; clamping the
	// cosine is cheaper than a special case and the box it produces is harmless.
	const lngDelta = radiusKm / (111.32 * Math.max(cosLat, 1e-6));

	return {
		minLat: Math.max(-90, lat - latDelta),
		maxLat: Math.min(90, lat + latDelta),
		minLng: Math.max(-180, lng - lngDelta),
		maxLng: Math.min(180, lng + lngDelta),
	};
}

/**
 * Great-circle distance in kilometres. This is the check that decides whether a
 * business is actually inside the radius: the geohash narrowed the candidates and
 * the bounding box is a square, and a square's corner is 41% further away than
 * its edge.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;
	const dLat = lat2 - lat1;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;

	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
