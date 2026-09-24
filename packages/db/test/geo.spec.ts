import { describe, expect, test } from "bun:test";

import {
	boundingBox,
	encodeGeohash,
	geohashNeighbours,
	geohashSearchCells,
	haversineKm,
} from "../src/geo";

/** The market this is built for: San José, Costa Rica. */
const SAN_JOSE = { lat: 9.9281, lng: -84.0907 };
/** Escazú, 5.5 km west — the town a customer would still call "near me". */
const ESCAZU = { lat: 9.9189, lng: -84.14 };

/** Degrees of longitude per metre, at a given latitude. */
function metresToLng(metres: number, lat: number): number {
	return metres / (111320 * Math.cos((lat * Math.PI) / 180));
}

function metresToLat(metres: number): number {
	return metres / 111320;
}

describe("encodeGeohash", () => {
	// The two published examples every implementation is checked against. If the
	// bit interleaving or the alphabet were wrong, these are where it shows.
	test("matches the canonical reference hashes", () => {
		expect(encodeGeohash(42.6, -5.6, 5)).toBe("ezs42");
		expect(encodeGeohash(57.64911, 10.40744, 9)).toBe("u4pruydqq");
	});

	test("encodes a San José coordinate", () => {
		expect(encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 3)).toBe("d1u");
		expect(encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 9)).toBe("d1u0qrr52");
	});

	test("a shorter hash is a prefix of a longer one", () => {
		const full = encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 9);
		for (let precision = 1; precision <= 9; precision += 1) {
			expect(encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, precision)).toBe(
				full.slice(0, precision),
			);
		}
	});

	test("never exceeds 9 characters, whatever it is asked for", () => {
		expect(encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 20)).toHaveLength(9);
	});

	test("refuses a coordinate that is not on earth", () => {
		expect(() => encodeGeohash(91, 0)).toThrow(RangeError);
		expect(() => encodeGeohash(0, 181)).toThrow(RangeError);
		expect(() => encodeGeohash(Number.NaN, 0)).toThrow(RangeError);
	});
});

describe("geohashNeighbours", () => {
	test("returns eight distinct cells of the same precision", () => {
		const hash = encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 7);
		const neighbours = geohashNeighbours(hash);

		expect(neighbours).toHaveLength(8);
		expect(new Set(neighbours).size).toBe(8);
		expect(neighbours).not.toContain(hash);
		for (const neighbour of neighbours) {
			expect(neighbour).toHaveLength(hash.length);
		}
	});

	/**
	 * The bug this whole function exists for. At precision 8 a cell is about 38 m
	 * across, so a shop 50 m up the street is genuinely in the next cell — and a
	 * lookup that queries only the customer's own hash does not find it.
	 */
	test("finds a business 50 m away that is in the next cell", () => {
		const here = encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 8);
		const nearby = encodeGeohash(
			SAN_JOSE.lat,
			SAN_JOSE.lng + metresToLng(50, SAN_JOSE.lat),
			8,
		);

		expect(nearby).not.toBe(here);
		expect(geohashSearchCells(here)).toContain(nearby);
	});

	test("finds a neighbour one cell north", () => {
		const here = encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 7);
		const north = encodeGeohash(
			SAN_JOSE.lat + metresToLat(120),
			SAN_JOSE.lng,
			7,
		);

		expect(north).not.toBe(here);
		expect(geohashSearchCells(here)).toContain(north);
	});

	/**
	 * The property, rather than eight examples: any point within one cell of the
	 * origin encodes to the origin's hash or to one of its eight neighbours. A
	 * transposed or missing direction in those tables fails here and nowhere else,
	 * because the diagonals are exactly what a four-neighbour implementation drops.
	 */
	test("covers every direction within a cell, diagonals included", () => {
		const cells = geohashSearchCells(
			encodeGeohash(SAN_JOSE.lat, SAN_JOSE.lng, 7),
		);

		for (let north = -110; north <= 110; north += 10) {
			for (let east = -110; east <= 110; east += 10) {
				const hash = encodeGeohash(
					SAN_JOSE.lat + metresToLat(north),
					SAN_JOSE.lng + metresToLng(east, SAN_JOSE.lat),
					7,
				);
				expect(cells).toContain(hash);
			}
		}
	});

	test("a cell on the edge of the world still has neighbours", () => {
		const hash = encodeGeohash(-89.9, 179.9, 6);
		expect(new Set(geohashNeighbours(hash)).size).toBe(8);
	});
});

describe("boundingBox", () => {
	test("is a prefilter: it contains the radius, and a little more", () => {
		const sixKm = boundingBox(SAN_JOSE.lat, SAN_JOSE.lng, 6);
		expect(ESCAZU.lat).toBeGreaterThanOrEqual(sixKm.minLat);
		expect(ESCAZU.lat).toBeLessThanOrEqual(sixKm.maxLat);
		expect(ESCAZU.lng).toBeGreaterThanOrEqual(sixKm.minLng);
		expect(ESCAZU.lng).toBeLessThanOrEqual(sixKm.maxLng);

		// 5.5 km away, so a 5 km box excludes it — the box is not the answer, only
		// the thing that makes the answer cheap to compute.
		const fiveKm = boundingBox(SAN_JOSE.lat, SAN_JOSE.lng, 5);
		expect(ESCAZU.lng).toBeLessThan(fiveKm.minLng);
	});

	test("widens in longitude as latitude increases", () => {
		const atEquator = boundingBox(0, 0, 10);
		const inSanJose = boundingBox(SAN_JOSE.lat, SAN_JOSE.lng, 10);

		const equatorSpan = atEquator.maxLng - atEquator.minLng;
		const sanJoseSpan = inSanJose.maxLng - inSanJose.minLng;
		expect(sanJoseSpan).toBeGreaterThan(equatorSpan);
	});

	test("does not run off the map", () => {
		const box = boundingBox(89.999, 179.999, 50);
		expect(box.maxLat).toBeLessThanOrEqual(90);
		expect(box.maxLng).toBeLessThanOrEqual(180);
	});
});

describe("haversineKm", () => {
	test("measures the distance the delivery radius is judged on", () => {
		expect(haversineKm(SAN_JOSE, ESCAZU)).toBeCloseTo(5.496, 2);
	});

	test("is exact enough to separate 50 m from zero", () => {
		const fiftyMetresEast = {
			lat: SAN_JOSE.lat,
			lng: SAN_JOSE.lng + metresToLng(50, SAN_JOSE.lat),
		};
		expect(haversineKm(SAN_JOSE, fiftyMetresEast)).toBeCloseTo(0.05, 3);
	});

	test("is zero for a point against itself and symmetric otherwise", () => {
		expect(haversineKm(SAN_JOSE, SAN_JOSE)).toBe(0);
		expect(haversineKm(SAN_JOSE, ESCAZU)).toBeCloseTo(
			haversineKm(ESCAZU, SAN_JOSE),
			10,
		);
	});
});
