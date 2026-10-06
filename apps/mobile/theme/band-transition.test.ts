import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mixHex, mixOklab } from "@/lib/color";

import { bandColorAt, easeOutCubic } from "../theme/transition-math";

/**
 * The band's colour tween.
 *
 * The band snapped on a stage change while the palette glided, and the cause was that
 * two inputs to one colour moved at different speeds: `theme/transition.tsx` animates
 * `ThemeColors` and knows nothing about a `purchaseStage`, while `screen.tsx`
 * substituted one band token for another in a single render. `expo-linear-gradient`
 * swaps colours, it does not animate them.
 *
 * The pure half is separated from the hook for the same reason `transition-math.ts` is
 * separate from `transition.tsx`: answering "does this land on its endpoints, and in
 * which colour space" needs no renderer, a `requestAnimationFrame`, or a mounted tree.
 */

const LIME = "#c8ff18";
const CYAN = "#00bfff";

/** How far a colour sits from a target, in raw channel terms — no perceptual claims. */
function channelDistance(hex: string, target: string): number {
	return [1, 3, 5].reduce(
		(total, index) =>
			total +
			Math.abs(
				Number.parseInt(hex.slice(index, index + 2), 16) -
					Number.parseInt(target.slice(index, index + 2), 16),
			),
		0,
	);
}

describe("bandColorAt", () => {
	test("lands exactly on both endpoints", () => {
		expect(bandColorAt(LIME, CYAN, 0).toLowerCase()).toBe(LIME);
		expect(bandColorAt(LIME, CYAN, 1).toLowerCase()).toBe(CYAN);
	});

	test("never moves away from the target once it has started", () => {
		// What makes "blend from what is on screen" safe when a tween is interrupted: no
		// step is ever further from the target than the one before it. A tween that
		// overshoots, or that runs backwards, reads as a flash.
		//
		// **Non-increasing, not strictly decreasing.** The last few steps land on the same
		// 8-bit code value — `easeOutCubic(0.975)` is 0.99998, which rounds to the target
		// exactly — so "strictly closer" would fail on the quantisation floor rather than
		// on a defect. The floor is real and is why the band is built from ten stops
		// rather than a continuous ramp.
		const steps = 40;
		let previousDistance = Number.POSITIVE_INFINITY;
		for (let step = 0; step <= steps; step += 1) {
			const distance = channelDistance(
				bandColorAt(LIME, CYAN, step / steps),
				CYAN,
			);
			expect(distance).toBeLessThanOrEqual(previousDistance);
			previousDistance = distance;
		}

		// ...and it does arrive, rather than flattening early.
		expect(previousDistance).toBe(0);
	});

	test("mixes in Oklab, not in sRGB — the two are not the same mid-way", () => {
		// The assertion that pins the colour-space decision. `mixHex` is the sRGB lerp the
		// palette transition uses and the one this deliberately does not: swatches are
		// near-neighbours and it is good enough there, but a stage jump is a *hue* change
		// and sRGB passes through a duller mid-way.
		//
		// Both are asked at the **same** `firstWeight`, so the colour space is the only
		// thing that differs. Which weight that is, is the next spec's business.
		const t = 0.5;
		const weight = 1 - easeOutCubic(t);
		expect(bandColorAt(LIME, CYAN, t).toLowerCase()).not.toBe(
			mixHex(LIME, CYAN, weight).toLowerCase(),
		);
	});

	test("the hue journey passes through a saturated colour, not a grey", () => {
		// The spec that fails if someone reinstates the crossfade. Two full-intensity
		// gradients stacked at partial alpha blend toward the page colour, so the band
		// loses saturation at the midpoint — and a saturated accent is the band's whole job.
		const mid = bandColorAt(LIME, CYAN, 0.5);
		const channels = [1, 3, 5].map(
			(i) => Number.parseInt(mid.slice(i, i + 2), 16) ?? 0,
		);
		const [r = 0, g = 0, b = 0] = channels;
		const spread = Math.max(r, g, b) - Math.min(r, g, b);

		expect(spread).toBeGreaterThan(60);
	});

	test("the easing is the palette's, so band and cards arrive together", () => {
		// Anything but `easeOutCubic` here and a swatch-plus-step change shows the band
		// still travelling after the cards have settled, which reads as broken more
		// loudly than a dull mid-way does. The `1 -` is `mixOklab`'s own convention -
		// `firstWeight` is how much of the *first* colour survives.
		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			expect(bandColorAt(LIME, CYAN, t).toLowerCase()).toBe(
				mixOklab(LIME, CYAN, 1 - easeOutCubic(t)).toLowerCase(),
			);
		}
	});
});

describe("the band tween is wired where the band is composed", () => {
	const screen = readFileSync(
		join(import.meta.dir, "..", "components", "screen.tsx"),
		"utf8",
	);

	test("Screen hands the gradient the tweened colour, not the raw one", () => {
		// `band?.color` reaching `HomeGradient` is the bug: a hard substitution in one
		// render, which `<LinearGradient>` then swaps.
		expect(screen).toContain(
			"const bandColor = useTweenedBandColor(band?.color);",
		);
		expect(screen).toContain("bandColor={bandColor}");
		expect(screen).not.toContain("bandColor={band?.color}");
	});

	test("the gradient itself is untouched by the fix", () => {
		// The band redraws per frame already — it just needed to be handed moving values.
		// If a change lands here, the fix was made in the wrong place.
		const gradient = readFileSync(
			join(import.meta.dir, "..", "components", "top-fluid-gradient.tsx"),
			"utf8",
		);
		expect(gradient).toContain("colors={rest}");
		expect(gradient).toContain("colors={inhaled}");
		expect(gradient).not.toContain("useTweenedBandColor");
	});
});
