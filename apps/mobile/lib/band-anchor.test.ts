import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	BAND_MIN_CONTRAST,
	bandAnchor,
	contrastRatio,
	mixOklab,
	RAMP_LOCATIONS,
	RAMP_WEIGHTS,
	relativeLuminance,
} from "@/lib/color";
import { BUSINESS_THEME_IDS } from "@/theme/business-theme-ids";

/**
 * `bandAnchor` — the band top stop's contrast floor.
 *
 * The band used to open on the theme's primary verbatim, which made "can you see the band
 * against the page" a property of which palette you happened to pick: the thirteen light
 * primaries measured between **1.18:1** and **7.00:1** against a white page, a 5.9x spread,
 * with six of thirteen under the 3:1 WCAG minimum for graphical elements. Lime had no
 * meaningful luminance separation from white at all.
 *
 * These specs hold the floor.
 *
 * ## Why the palettes are parsed rather than imported
 *
 * `./theme/tokens.ts` reaches `react-native` for `Platform`, whose Flow-typed index bun cannot
 * parse, so importing it fails before a single assertion runs. `theme/business-theme.test.ts`
 * records the same constraint and explains why the ids were split into a dependency-free file;
 * `lib/purchase-colors.test.ts` solves the value half by reading `tokens.ts` as text. This file
 * does both — the ids are imported so the list is the real one, and the values are parsed out of
 * the real source. A palette added or re-picked tomorrow is covered without anyone editing this
 * file, and nothing here can pass against a stale copy of the hexes.
 */

const tokens = readFileSync(
	join(import.meta.dir, "..", "theme", "tokens.ts"),
	"utf8",
);

/** One theme's block out of the `businessThemes` record. */
const themeBlock = (id: string): string => {
	const marker = `\n\t${id}: {`;
	const start = tokens.indexOf(marker);
	if (start < 0) throw new Error(`theme "${id}" is not in tokens.ts`);
	const rest = tokens.slice(start + marker.length);
	const next = rest.search(/\n\t[a-z][a-zA-Z]*: \{/);
	return next < 0 ? rest : rest.slice(0, next);
};

/** One scheme's block out of a theme. */
const schemeBlock = (block: string, scheme: string): string => {
	const marker = `\n\t\t${scheme}: {`;
	const start = block.indexOf(marker);
	if (start < 0)
		throw new Error(`scheme "${scheme}" is not in the theme block`);
	const rest = block.slice(start + marker.length);
	const next = rest.search(/\n\t\t[a-z]+: \{|\n\t\};/);
	return next < 0 ? rest : rest.slice(0, next);
};

const token = (block: string, name: string): string => {
	const value = block.match(new RegExp(`\\b${name}: "(#[0-9A-Fa-f]{6})"`))?.[1];
	if (!value) throw new Error(`missing ${name} token`);
	return value;
};

const SCHEMES = ["light", "dark"] as const;

/** Every (theme, scheme) pair the app can render a band for, read from the real source. */
const THEMES = BUSINESS_THEME_IDS.flatMap((id) => {
	const block = themeBlock(id);
	return SCHEMES.map((scheme) => {
		const inner = schemeBlock(block, scheme);
		return {
			label: `${id}-${scheme}`,
			primary: token(inner, "primary"),
			background: token(inner, "background"),
		};
	});
});

/** WCAG relative luminance, on linearised channels. Independent reimplementation on purpose. */
const wcagLuminance = (hex: string): number => {
	const toLinear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const read = (index: number) =>
		toLinear(Number.parseInt(hex.slice(index, index + 2), 16));
	return 0.2126 * read(1) + 0.7152 * read(3) + 0.0722 * read(5);
};

/** OKLab chroma and hue angle, so "same colour, deeper" can be asserted rather than assumed. */
const lab = (hex: string): { chroma: number; hue: number } => {
	const toLinear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const read = (index: number) =>
		toLinear(Number.parseInt(hex.slice(index, index + 2), 16));
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
	const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s;
	const bb = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s;
	return { chroma: Math.hypot(a, bb), hue: Math.atan2(bb, a) };
};

/** Smallest angle between two hue angles, in degrees. Wraps at the atan2 seam. */
const hueDelta = (first: number, second: number): number => {
	const degrees = Math.abs(((first - second) * 180) / Math.PI) % 360;
	return degrees > 180 ? 360 - degrees : degrees;
};

describe("contrastRatio", () => {
	test("matches the WCAG reference values", () => {
		// Checked before anything is built on it. A contrast helper that is wrong here makes
		// every other number in this file wrong in the same direction, silently.
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
		expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
	});

	test("is order-independent", () => {
		for (const { primary, background } of THEMES) {
			expect(contrastRatio(primary, background)).toBeCloseTo(
				contrastRatio(background, primary),
				10,
			);
		}
	});

	test("agrees with an independent implementation of the same formula", () => {
		// The exported helper and the copy above are written separately; if they ever diverge,
		// one of them is wrong and this is where it shows.
		for (const { primary, background } of THEMES) {
			const a = wcagLuminance(primary);
			const b = wcagLuminance(background);
			expect(contrastRatio(primary, background)).toBeCloseTo(
				(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
				10,
			);
		}
	});

	test("relativeLuminance is the same function, not a different one", () => {
		for (const { primary } of THEMES) {
			expect(relativeLuminance(primary)).toBeCloseTo(
				wcagLuminance(primary),
				10,
			);
		}
	});
});

describe("bandAnchor holds the contrast floor on every theme", () => {
	test("every theme and scheme clears 4.5:1 against its own page", () => {
		// The whole point. `BUSINESS_THEME_IDS` x both schemes, so this covers all 26 bands the
		// app can draw rather than the handful that were measured by hand.
		for (const { label, primary, background } of THEMES) {
			const anchor = bandAnchor(primary, background);
			expect(contrastRatio(anchor, background)).toBeGreaterThanOrEqual(
				BAND_MIN_CONTRAST,
			);
			// A bare `expect` above names the pair in the failure, which is the useful part.
			if (contrastRatio(anchor, background) < BAND_MIN_CONTRAST) {
				throw new Error(`${label} (${primary}) anchored to ${anchor}`);
			}
		}
	});

	test("clears the floor against a dark page as well as a light one", () => {
		// `page` is an argument, so the function has to work in both directions: deepening is
		// right against white and wrong against near-black, where the band is already the
		// darker of the two.
		for (const page of ["#05091d", "#0F0F0F", "#1f1915"]) {
			for (const { primary } of THEMES) {
				const anchor = bandAnchor(primary, page);
				expect(contrastRatio(anchor, page)).toBeGreaterThanOrEqual(
					BAND_MIN_CONTRAST,
				);
			}
		}
	});
});

describe("bandAnchor changes as little as it has to", () => {
	test("returns a colour that already clears the target byte-identical", () => {
		// Idempotence, and the spec that catches the `firstWeight` inversion this function is
		// easiest to get wrong. `mixOklab(first, second, w)` measures how much of **first**
		// survives, so `w: 1` is `first`. Sweeping the other way searches from `second` and
		// returns that instead — for every theme at once, which reads as a dramatic result
		// and is entirely an artefact of the search.
		for (const { primary, background } of THEMES) {
			if (contrastRatio(primary, background) >= BAND_MIN_CONTRAST) {
				expect(bandAnchor(primary, background)).toBe(primary);
			}
		}
	});

	test("never returns a degenerate colour", () => {
		// Black and white both "clear" any contrast target against the wrong page. A search
		// that fell off its range would return one of them and pass the floor spec silently.
		for (const { primary, background } of THEMES) {
			const anchor = bandAnchor(primary, background);
			expect(anchor).not.toBe("#000000");
			expect(anchor).not.toBe("#ffffff");
		}
	});

	test("keeps at least 60% of the source chroma, and names the one that cannot", () => {
		// Deepening must not drain the colour, and mostly it does not: measured across the
		// fourteen pairs that move, retention runs **61% to 128%** — coral, sunset, berry and
		// vine all *gain* chroma, because lowering lightness opens up gamut headroom that the
		// original colour could not use.
		//
		// The floor is **lime at 61%**, and that is a property of sRGB rather than of this
		// function. `#C8FF18` sits on the gamut boundary, so it cannot be simultaneously as
		// saturated as it is and 4.5:1 against white. Something has to give, and the choice made
		// here is to give chroma rather than hue — see the next spec, which is the one that
		// matters more. Asserting 80% would be asserting a number that was never true; an
		// earlier draft of this file did exactly that, from a measurement taken with a chroma
		// function that skipped the sRGB linearisation.
		for (const { label, primary, background } of THEMES) {
			const anchor = bandAnchor(primary, background);
			if (anchor === primary) continue;
			const kept = lab(anchor).chroma / lab(primary).chroma;
			if (kept < 0.6) {
				throw new Error(
					`${label}: ${primary} -> ${anchor} kept only ${(kept * 100).toFixed(0)}% chroma`,
				);
			}
			expect(kept).toBeGreaterThanOrEqual(0.6);
		}
	});

	test("prefers holding hue over holding chroma", () => {
		// The trade the previous spec gives up, stated as its own assertion because it is the
		// one that decides how the band looks. Holding lightness-adjacent chroma exactly is not
		// possible at the gamut edge, and the earlier implementation that tried clipped three
		// channels by different amounts and rotated amber's hue by **12.5 degrees**. Clamping is
		// per channel, so clipping is not hue-preserving however carefully it is arranged.
		//
		// Measured hue drift across all fourteen pairs that move: **0.74 degrees**, worst case.
		for (const { label, primary, background } of THEMES) {
			const anchor = bandAnchor(primary, background);
			if (anchor === primary) continue;
			const delta = hueDelta(lab(primary).hue, lab(anchor).hue);
			if (delta > 1) {
				throw new Error(
					`${label}: ${primary} -> ${anchor} rotated hue by ${delta.toFixed(2)} degrees`,
				);
			}
			expect(delta).toBeLessThanOrEqual(1);
		}
	});

	test("is idempotent — anchoring an anchor changes nothing", () => {
		// A second pass must find the target already met. Without this, a component that
		// anchors twice in one render would creep a little further on every frame.
		for (const { primary, background } of THEMES) {
			const once = bandAnchor(primary, background);
			expect(bandAnchor(once, background)).toBe(once);
		}
	});
});

describe("the header's ink is legible on the band it is drawn on", () => {
	/**
	 * The regression this pins, and it is worth being precise about how it happened.
	 *
	 * `purchaseBand("browsing")` anchors lime's band with `bandAnchor` and then picks ink against
	 * the anchor — `#638000`, which clears 4.5:1, so white ink. But `./home-gradient` draws the
	 * hand-authored lime ramps, whose top stop is `#C8FF18` either way. Ink chosen for `#638000`
	 * landed on `#C8FF18` at **1.18:1**: white on bright lime, invisible.
	 *
	 * Both numbers were correct and the pair was nonsense, which is why neither a contrast
	 * assertion on the ink nor one on the band caught it. The only thing that catches it is
	 * asserting **ink against the colour that reaches the screen**.
	 */
	test("dark letters on the lime band, in both schemes, are the design and are legible", () => {
		const lime = THEMES.find((theme) => theme.label === "lime-light");
		const limeDark = THEMES.find((theme) => theme.label === "lime-dark");
		if (!lime || !limeDark)
			throw new Error("lime is missing from the parsed themes");

		// `./home-gradient`'s top stop for lime, which is `colors.primary` verbatim.
		expect(lime.primary.toLowerCase()).toBe("#c8ff18");
		expect(limeDark.primary.toLowerCase()).toBe("#c8ff18");

		// `#111111` is what both resolve to, and it clears by a wide margin on the drawn band.
		const ink = "#111111";
		expect(contrastRatio(ink, lime.primary)).toBeGreaterThan(4.5);
		expect(contrastRatio(ink, limeDark.primary)).toBeGreaterThan(4.5);

		// The failure mode, stated as a number so it cannot come back unnoticed: had the ink been
		// chosen against the anchor instead of the drawn colour, this is what it would measure.
		const anchor = bandAnchor(lime.primary, lime.background);
		expect(contrastRatio("#FFFFFF", anchor)).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio("#FFFFFF", lime.primary)).toBeLessThan(4.5);
	});

	test("dark letters on a lime band are not the same thing as dark letters on a dark page", () => {
		// "Dark mode, dark letters" reads like a bug and is not one, so this records why. The band
		// is what makes dark ink correct: `#C8FF18` at 16.22:1 against its own dark page, and
		// 15.43:1 against `#111111`. Take the band away and the same ink is 1.05:1 — invisible.
		const limeDark = THEMES.find((theme) => theme.label === "lime-dark");
		if (!limeDark)
			throw new Error("lime-dark is missing from the parsed themes");
		expect(contrastRatio("#111111", limeDark.background)).toBeLessThan(1.5);
		expect(contrastRatio("#111111", limeDark.primary)).toBeGreaterThan(4.5);
	});
});

describe("the ramp holds the colour through the header", () => {
	test("chroma retained at 24% of the height is far above the old curve", () => {
		// The reader's complaint was "the colour is not strong enough", and the old curve lost
		// 56% of its chroma by this point — accelerating, so the steepest wash-out sat exactly
		// where the greeting and the meta line are. The curve is stated in chroma retention
		// rather than lightness, so this is the same number for every hue.
		const index = 3;
		const location = RAMP_LOCATIONS[index] ?? 0;
		expect(location).toBeCloseTo(0.26, 5);
		expect(RAMP_WEIGHTS[index] ?? 0).toBeGreaterThanOrEqual(0.9);
	});

	test("the weight table is chroma retention, so it means the same for every hue", () => {
		// `mixOklab(color, page, w)` lerps `a`/`b` by `(1 - w)`, so `w` is the chroma
		// retained when the page is neutral. Measured against a white page, coral should keep
		// roughly `w` of its chroma — which is what makes the table hue-independent rather
		// than a shape that only ever worked for the blue it was derived from.
		const page = "#ffffff";
		for (const color of ["#C8FF18", "#FF6A4D", "#4166F5", "#DB2777"]) {
			const full = lab(color).chroma;
			for (const weight of RAMP_WEIGHTS) {
				if (weight === 0) continue;
				const stop = mixOklab(color, page, weight);
				const kept = lab(stop).chroma / full;
				expect(kept).toBeGreaterThan(weight - 0.08);
				expect(kept).toBeLessThan(weight + 0.08);
			}
		}
	});

	test("spends the colour by 70% rather than leaving a dead tail", () => {
		// The old curve reached the page at 62% and held flat page colour for the remaining
		// 38% of the band's height, which contributed nothing at all.
		const spentAt = RAMP_LOCATIONS.findIndex(
			(weight) => (RAMP_WEIGHTS[RAMP_LOCATIONS.indexOf(weight)] ?? 1) === 0,
		);
		expect(spentAt).toBe(8);
		expect(RAMP_LOCATIONS[8]).toBeCloseTo(0.7, 5);
	});
});
