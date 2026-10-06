import { describe, expect, test } from "bun:test";

import type { ThemeColors } from "./tokens";
import { channels, interpolateThemeColors, toHex } from "./transition-math";

/**
 * The colour interpolation, checked without a renderer.
 *
 * **No fixture comes from `theme/tokens.ts`.** That file imports `Platform` from
 * `react-native` for `shadow`, and nothing in this suite can load `react-native` — the same
 * constraint that put the merchant theme ids in their own import-free file. So the palettes here
 * are literals, and the point of the last test is that they were written to match the shape of
 * the real ones: thirteen of the tree's `border` values are eight-digit, and every other token
 * is six.
 */

/** Two palettes of the same shape as the real ones, including the eight-digit borders. */
const LIME_LIGHT = {
	background: "#ffffff",
	foreground: "#111111",
	card: "#ffffff",
	cardForeground: "#111111",
	popover: "#ffffff",
	popoverForeground: "#111111",
	primary: "#c8ff18",
	primaryForeground: "#111111",
	secondary: "#f6f5f1",
	secondaryForeground: "#2e2722",
	muted: "#f6f5f1",
	mutedForeground: "#707070",
	accent: "#efeee9",
	accentForeground: "#111111",
	action: "#111111",
	border: "#11111114",
	ring: "#111111",
	shimmer: "#a39c90",
} as unknown as ThemeColors;

const VINE_LIGHT = {
	background: "#f7f9ff",
	foreground: "#171c2d",
	card: "#ffffff",
	cardForeground: "#171c2d",
	popover: "#ffffff",
	popoverForeground: "#171c2d",
	primary: "#4166f5",
	primaryForeground: "#ffffff",
	secondary: "#e9eeff",
	secondaryForeground: "#171c2d",
	muted: "#e9eeff",
	mutedForeground: "#676c7d",
	accent: "#eae9ff",
	accentForeground: "#171c2d",
	action: "#243b9b",
	border: "#171c2d14",
	ring: "#4166f5",
	shimmer: "#84899a",
} as unknown as ThemeColors;

const channel = (hex: string, i: number) =>
	Number.parseInt(hex.slice(i, i + 2), 16);

describe("theme colour interpolation", () => {
	test("lands exactly on both endpoints", () => {
		// Byte for byte, not "close enough": the transition has to arrive on the target palette,
		// because a transition that settles one code value off is a permanent subtle mismatch
		// between the picker and the screen.
		expect(interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, 0)).toEqual(
			LIME_LIGHT,
		);
		expect(interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, 1)).toEqual(
			VINE_LIGHT,
		);
		expect(interpolateThemeColors(VINE_LIGHT, LIME_LIGHT, 1)).toEqual(
			LIME_LIGHT,
		);
	});

	test("a half-way value is half-way in every channel", () => {
		const mid = interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, 0.5);
		for (const key of [
			"primary",
			"background",
			"foreground",
			"action",
		] as const) {
			for (const offset of [1, 3, 5]) {
				const f = channel(LIME_LIGHT[key] ?? "", offset);
				const t = channel(VINE_LIGHT[key] ?? "", offset);
				expect(
					Math.abs(channel(mid[key] ?? "", offset) - (f + t) / 2),
				).toBeLessThanOrEqual(1);
			}
		}
	});

	/**
	 * The one that would have been a visible bug. `mixHex` reads offsets 1/3/5 and rebuilds a
	 * six-digit hex, and thirteen `border` values in the tree are eight-digit — so interpolating
	 * with it takes every theme's hairline border to fully opaque for the length of the
	 * transition, on the one token that is supposed to be nearly invisible.
	 */
	test("keeps an alpha border transparent instead of flashing it opaque", () => {
		expect(LIME_LIGHT.border).toMatch(/^#[0-9a-f]{8}$/);
		expect(VINE_LIGHT.border).toMatch(/^#[0-9a-f]{8}$/);
		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			const mid = interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, t);
			expect({
				t,
				hex: mid.border,
				ok: /^#[0-9a-f]{8}$/.test(mid.border ?? ""),
			}).toEqual({ t, hex: mid.border, ok: true });
			// Both ends carry the same faint alpha, so it holds throughout.
			expect(mid.border?.slice(7)).toBe(LIME_LIGHT.border?.slice(7));
		}
	});

	test("interpolates alpha when the two ends differ in it", () => {
		const a = { ...LIME_LIGHT, border: "#00000000" };
		const b = { ...LIME_LIGHT, border: "#000000ff" };
		expect(interpolateThemeColors(a, b, 0.5).border).toBe("#00000080");
		expect(interpolateThemeColors(a, b, 0.25).border?.slice(7)).toBe("40");
		expect(interpolateThemeColors(a, b, 0.75).border?.slice(7)).toBe("bf");
	});

	test("a six-digit token stays six-digit, so nothing downstream sees a new shape", () => {
		// A snapshot comparison, a `/^#[0-9a-f]{6}$/` assertion, or an eight-to-six comparison in
		// whatever consumes the palette would all break if a six-digit token briefly became
		// eight. It happens only if alpha is written when it is 1.
		const mid = interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, 0.5);
		for (const key of Object.keys(LIME_LIGHT) as (keyof ThemeColors)[]) {
			const from = LIME_LIGHT[key] ?? "";
			if (from.length !== 7) continue; // the eight-digit borders are covered above
			expect({ key, len: (mid[key] ?? "").length }).toEqual({ key, len: 7 });
		}
	});

	test("every token of a real-shaped pair stays a parseable hex at every step", () => {
		// The transition runs on the Settings screen with the picker open, so a malformed hex
		// here is a screen of invisible text rather than a caught exception.
		for (const t of [0, 0.13, 0.5, 0.87, 1]) {
			const out = interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, t);
			for (const key of Object.keys(VINE_LIGHT) as (keyof ThemeColors)[]) {
				expect({
					key,
					ok: /^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(out[key] ?? ""),
				}).toEqual({ key, ok: true });
			}
		}
	});

	test("handles the `#RGB` shorthand rather than mis-reading it", () => {
		expect(channels("#000")).toEqual({ rgb: [0, 0, 0], alpha: 1 });
		expect(channels("#fff")).toEqual({ rgb: [255, 255, 255], alpha: 1 });
		expect(channels("#f00f")).toEqual({ rgb: [255, 0, 0], alpha: 1 });
		const a = { ...LIME_LIGHT, primary: "#000" };
		const b = { ...LIME_LIGHT, primary: "#fff" };
		expect(interpolateThemeColors(a, b, 0.5).primary).toBe("#808080");
	});

	test("travels straight to the target and stops there", () => {
		// Never reverses, never overshoots, and finishes on the destination's own byte.
		const start = channel(LIME_LIGHT.primary ?? "", 1);
		const end = channel(VINE_LIGHT.primary ?? "", 1);
		let previous = start;
		for (let t = 0.05; t <= 1.0001; t += 0.05) {
			const value = channel(
				interpolateThemeColors(LIME_LIGHT, VINE_LIGHT, t).primary ?? "",
				1,
			);
			if (end > start) expect(value).toBeGreaterThanOrEqual(previous);
			else expect(value).toBeLessThanOrEqual(previous);
			expect(value).toBeLessThanOrEqual(Math.max(start, end));
			expect(value).toBeGreaterThanOrEqual(Math.min(start, end));
			previous = value;
		}
		expect(previous).toBe(end);
	});

	test("channel parsing and rebuilding round-trip a six- and an eight-digit value", () => {
		for (const hex of ["#4166f5", "#171c2d14", "#000000", "#ffffff8c"]) {
			expect(toHex(channels(hex).rgb, channels(hex).alpha).toLowerCase()).toBe(
				hex.toLowerCase(),
			);
		}
	});

	test("clamping: a value outside 0..255 cannot be written out", () => {
		expect(toHex([-20, 300, 128], 1)).toBe("#00ff80");
	});
});
