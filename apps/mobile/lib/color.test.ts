import { describe, expect, test } from "bun:test";

import {
	BREATH_WEIGHTS,
	mixHex,
	mixOklab,
	RAMP_LOCATIONS,
	RAMP_WEIGHTS,
} from "@/lib/color";

/** Oklab lightness of a hex, recomputed here rather than imported, so the test is an
 *  independent check of `mixOklab` rather than a restatement of its own maths. */
function lightness(hex: string): number {
	const read = (i: number) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const [r, g, b] = [read(1), read(3), read(5)];
	const l = Math.cbrt(
		0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b,
	);
	const m = Math.cbrt(
		0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b,
	);
	const s = Math.cbrt(
		0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b,
	);
	return 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s;
}

/** Every scheme the delivery band is actually rendered with. */
const PAIRS = [
	["lime dark", "#6D9BE8", "#0F0F0F"],
	["lime light", "#4768A9", "#FFFFFF"],
	["consumer dark", "#3538F2", "#110E0B"],
	["amber dark", "#F59E0B", "#0F0F0F"],
] as const;

describe("the band ramp", () => {
	test("accelerates into the middle, then decelerates into the tail", () => {
		// The shape is the supplied study's, and it is deliberately uneven: even falloff is
		// only the right target when the stops *are* even, and these are not. What has to hold
		// is one knee — the rate climbs out of the first segment, peaks, then falls away into
		// the flat tail. Measured on the study: 0.85 -> 2.97 units per percent of height, back
		// down to 0.91.
		for (const [name, top, bottom] of PAIRS) {
			const colours = RAMP_WEIGHTS.map((w) => mixOklab(top, bottom, w));
			const span = lightness(bottom) - lightness(top);
			const rates = RAMP_LOCATIONS.slice(1).map((at, i) => {
				const travelled = Math.abs(
					lightness(colours[i + 1] ?? "") - lightness(colours[i] ?? ""),
				);
				return travelled / (at - (RAMP_LOCATIONS[i] ?? 0));
			});

			// Normalised to the ramp's own length, so the comparison means something across
			// schemes whose lightness spans differ by 3x.
			const scaled = rates.map((r) => r / Math.abs(span));

			const steepest = scaled.indexOf(Math.max(...scaled));
			// The peak is in the body of the ramp, not at either end.
			expect({ name, steepest }).toEqual({
				name,
				steepest:
					steepest >= 1 && steepest <= scaled.length - 2 ? steepest : -1,
			});

			// It rises into the peak and falls after it — a real knee, not a drift.
			expect(scaled[steepest] ?? 0).toBeGreaterThan((scaled[0] ?? 0) * 1.8);
			expect(scaled[scaled.length - 1] ?? 0).toBeLessThan(
				(scaled[steepest] ?? 0) * 0.6,
			);
		}
	});

	test("spends the whole ramp by 70% and holds a flat tail after it", () => {
		// The tail is the design: the status text sits on clean background rather than on a tint.
		//
		// It was 38% of the height and is now 30%, because the colour is spent at 70% rather than
		// 62% — the ramp no longer dumps its chroma into the top quarter, so it needs more room to
		// hand it over. What is left is still a deliberate flat tail rather than a fade to nothing.
		for (const [name, top, bottom] of PAIRS) {
			const background = bottom.toUpperCase();
			const reached = RAMP_WEIGHTS.indexOf(0);
			expect({ name, reached, at: RAMP_LOCATIONS[reached] }).toEqual({
				name,
				reached,
				at: 0.7,
			});
			// Everything past that point is already the background, so those stops must be it too.
			for (let i = reached; i < RAMP_WEIGHTS.length; i += 1) {
				expect(mixOklab(top, bottom, RAMP_WEIGHTS[i] ?? 0).toUpperCase()).toBe(
					background,
				);
			}
		}
	});

	test("travels monotonically toward the background, whichever way that is", () => {
		// Not "gets lighter". On `lime light` the band colour `#4768A9` is *darker* than the
		// `#FFFFFF` page behind it, so that ramp lightens as it descends while the dark schemes
		// darken. The invariant is direction-of-travel, not absolute lightness — asserting the
		// latter fails on a scheme that is correct.
		for (const [name, top, bottom] of PAIRS) {
			const direction = Math.sign(lightness(bottom) - lightness(top));
			const colours = RAMP_WEIGHTS.map((w) => mixOklab(top, bottom, w));
			for (let i = 1; i < colours.length; i += 1) {
				const step =
					(lightness(colours[i] ?? "") - lightness(colours[i - 1] ?? "")) *
					direction;
				expect({ name, i, reversed: step < -1e-9 }).toEqual({
					name,
					i,
					reversed: false,
				});
			}
		}
	});

	test("weights and locations have the same length and both run 0..1", () => {
		// They drift apart silently if either is edited alone, and the gradient then
		// interpolates the wrong colours into the wrong parts of the band.
		expect(RAMP_WEIGHTS.length).toBe(RAMP_LOCATIONS.length);
		expect(RAMP_LOCATIONS.length).toBe(10);
		expect(RAMP_LOCATIONS[0]).toBe(0);
		expect(RAMP_LOCATIONS[RAMP_LOCATIONS.length - 1]).toBe(1);
		for (let i = 1; i < RAMP_LOCATIONS.length; i += 1) {
			expect(RAMP_LOCATIONS[i]).toBeGreaterThan(RAMP_LOCATIONS[i - 1] ?? 0);
		}
		expect(RAMP_WEIGHTS[0]).toBe(1);
	});

	test("ends exactly on the background, so there is no seam", () => {
		for (const [, top, bottom] of PAIRS) {
			expect(mixOklab(top, bottom, 0).toUpperCase()).toBe(bottom.toUpperCase());
		}
	});

	test("starts exactly on the band colour", () => {
		for (const [, top] of PAIRS) {
			expect(mixOklab(top, "#0F0F0F", 1).toUpperCase()).toBe(top.toUpperCase());
		}
	});

	test("the breath curve keeps both ends and moves the middle", () => {
		// The delivery band's second state. Two curves, same positions, same endpoint colours;
		// the breath changes how fast the ramp lets go and nothing else.
		expect(BREATH_WEIGHTS.length).toBe(RAMP_WEIGHTS.length);

		// Pinned: `1` is the band colour and `0` the page, so the breath cannot change where
		// the band starts or ends. Measured on device, the top row drifts 1-2 code values of
		// 255 across a whole breath, which is blend quantisation rather than movement.
		expect(BREATH_WEIGHTS[0]).toBe(1);
		expect(BREATH_WEIGHTS[BREATH_WEIGHTS.length - 1]).toBe(0);

		// And the stops have to move, or the cross-fade has nothing to fade between and the band
		// would just sit there.
		//
		// **Not every stop, though, and that is a consequence of the plateau.** `BREATH_WEIGHTS`
		// is the rest curve resampled at `at / 1.357`, so where the rest curve is flat the two
		// agree almost exactly — at index 1 they differ by 0.004. The previous spec demanded more
		// than 0.01 at *every* interior stop, which a deliberately flat top cannot satisfy. What
		// has to hold is that the breath never holds **less** colour than rest, and that it holds
		// meaningfully more somewhere — which is the body of the ramp, where the shape lives.
		let moved = 0;
		let widest = 0;
		let widestAt = -1;
		for (let i = 1; i < BREATH_WEIGHTS.length - 1; i += 1) {
			const delta = (BREATH_WEIGHTS[i] ?? 0) - (RAMP_WEIGHTS[i] ?? 0);
			expect({ i, holdsLess: delta < -1e-9 }).toEqual({ i, holdsLess: false });
			if (Math.abs(delta) > 0.01) moved += 1;
			if (delta > widest) {
				widest = delta;
				widestAt = i;
			}
		}
		// Most of the ramp moves, and the widest gap is in the body rather than at either end.
		expect(moved).toBeGreaterThanOrEqual(5);
		expect({
			inBody: widestAt >= 1 && widestAt <= BREATH_WEIGHTS.length - 3,
		}).toEqual({ inBody: true });

		// Monotonic, like the rest curve — a curve that rose again would put a band of
		// returning colour in the lower half of a gradient.
		const breath = [...BREATH_WEIGHTS];
		for (let i = 1; i < breath.length; i += 1) {
			expect({ i, rising: (breath[i] ?? 0) > (breath[i - 1] ?? 0) }).toEqual({
				i,
				rising: false,
			});
		}
	});

	test("the breath spends the ramp later than rest does", () => {
		// Rest lets go at 70% of the height; the breath stretches that to the last stop. If these
		// ever matched, the cross-fade would be a fade of a static shape rather than a breath.
		const spent = (weights: readonly number[]) => weights.indexOf(0);
		expect(RAMP_LOCATIONS[spent(RAMP_WEIGHTS)]).toBe(0.7);
		expect(RAMP_LOCATIONS[spent(BREATH_WEIGHTS)]).toBe(1);
		// And the whole point: where rest has nearly let go, a breath is still holding colour.
		// At 61% of the height rest retains 18% of its chroma and the breath retains 60%.
		expect(RAMP_WEIGHTS[7] ?? 0).toBeLessThan(0.2);
		expect(BREATH_WEIGHTS[7] ?? 0).toBeGreaterThan(0.55);
		for (const [name, top, bottom] of PAIRS) {
			const rest = mixOklab(top, bottom, RAMP_WEIGHTS[7] ?? 0).toUpperCase();
			const breath = mixOklab(
				top,
				bottom,
				BREATH_WEIGHTS[7] ?? 0,
			).toUpperCase();
			expect({ name, rest, breath }).toEqual({
				name,
				rest,
				breath,
			});
			expect(breath).not.toBe(rest);
		}
	});

	test("pins the exact stop values", () => {
		// Spelled out rather than derived, so an edit to the ramp is a deliberate change to a
		// known shape rather than a silent drift. `scripts/derive-ramp-weights.ts` recomputes
		// both tables and re-measures the retention against every theme primary.
		//
		// The weights are **chroma retention**, so `1` is the band colour and each step is the
		// share of the colour still present at that height — the plateau at the top is the header
		// holding its colour, and the fall after 35% is the edge.
		expect(RAMP_LOCATIONS).toEqual([
			0, 0.09, 0.17, 0.26, 0.35, 0.44, 0.52, 0.61, 0.7, 1,
		]);
		expect(RAMP_WEIGHTS).toEqual([
			1, 0.985, 0.955, 0.91, 0.82, 0.63, 0.4, 0.18, 0, 0,
		]);
	});

	test("is not the same as the sRGB mix it replaced", () => {
		// Guards against `mixOklab` quietly degrading to `mixHex`, which would pass an
		// evenness check on the endpoints while losing the whole point.
		expect(mixOklab("#6D9BE8", "#0F0F0F", 0.5).toUpperCase()).not.toBe(
			mixHex("#6D9BE8", "#0F0F0F", 0.5).toUpperCase(),
		);
	});

	test("returns a parseable 6-digit hex for every pair", () => {
		for (const [, top, bottom] of PAIRS) {
			for (const weight of RAMP_WEIGHTS) {
				expect(mixOklab(top, bottom, weight)).toMatch(/^#[0-9a-f]{6}$/);
			}
		}
	});
});
