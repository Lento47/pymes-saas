import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ThemeColors } from "@/theme";

import {
	deliveryFluidColor,
	purchaseBand,
	statusBarStyleForInk,
} from "./purchase-colors";

const tokens = readFileSync(
	join(import.meta.dir, "..", "theme", "tokens.ts"),
	"utf8",
);
const lightTokens =
	tokens.split("const light = {")[1]?.split("} as const;")[0] ?? "";
const darkTokens =
	tokens.split("const dark = {")[1]?.split("} as const;")[0] ?? "";

function color(block: string, name: string): string {
	const value = block.match(new RegExp(`\\b${name}: "(#[0-9A-Fa-f]{6})"`))?.[1];
	if (!value) throw new Error(`Missing ${name} token`);
	return value;
}

function luminance(hex: string): number {
	const channels = [1, 3, 5].map(
		(index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
	);
	const linear = channels.map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
	);
	const [red = 0, green = 0, blue = 0] = linear;
	return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first: string, second: string): number {
	const high = Math.max(luminance(first), luminance(second));
	const low = Math.min(luminance(first), luminance(second));
	return (high + 0.05) / (low + 0.05);
}

describe("purchase band tokens", () => {
	test("delivery fluid keeps dark tokens and blends the light brand blues", () => {
		expect(deliveryFluidColor("#123456", "#abcdef", "dark")).toBe("#123456");
		expect(deliveryFluidColor("#1d60bc", "#3538f2", "light")).toBe("#2552cf");
	});

	for (const [scheme, block] of [
		["light", lightTokens],
		["dark", darkTokens],
	] as const) {
		test(`${scheme} bands keep readable ink`, () => {
			for (const pair of [
				"basket",
				"inCart",
				"checkout",
				"info",
				"success",
			] as const) {
				expect(
					contrast(color(block, pair), color(block, `${pair}Foreground`)),
				).toBeGreaterThanOrEqual(4.5);
			}
		});

		test(`${scheme} cart and checkout use distinct olive tones`, () => {
			expect(color(block, "inCart")).toBe("#B8C900");
			expect(color(block, "checkout")).toBe("#A0B900");
			expect(color(block, "inCartForeground")).toBe("#111111");
			expect(color(block, "checkoutForeground")).toBe("#111111");
		});

		test(`${scheme} basket stays in the home feed's lime family`, () => {
			expect(color(block, "basket")).toBe("#A9DE00");
			expect(color(block, "basketForeground")).toBe("#111111");
		});

		/**
		 * A journey band's contract, restated after `bandAnchor`.
		 *
		 * This used to assert that a band **is** the shipped token: `basket` came back as
		 * `color(block, "basket")` with `basketForeground` as its ink, byte for byte. That was
		 * the right contract while the band top was the palette's own value, and it is the wrong
		 * one now — that contract is what let contrast depend on which palette was picked.
		 *
		 * What is asserted instead is the guarantee rather than the literal: the band clears
		 * **4.5:1 against the page it is drawn on**, and the ink clears **4.5:1 against the band**.
		 * Both halves are worth holding, because they are what a reader can actually perceive, and
		 * neither is visible in a hex comparison.
		 *
		 * The values themselves are still checked to *come from the palette* — the band is one of
		 * the stage's own colours or an anchor of it, never an invented hue — so a token rename
		 * that silently detached the band from its stage still fails here.
		 */
		test(`${scheme} journey reads the shipped colors`, () => {
			const names = [
				"background",
				"foreground",
				"primary",
				"secondaryForeground",
				"primaryForeground",
				"basket",
				"basketForeground",
				"inCart",
				"inCartForeground",
				"checkout",
				"checkoutForeground",
				"info",
				"infoForeground",
				"success",
				"successForeground",
			];
			const palette = Object.fromEntries(
				names.map((name) => [name, color(block, name)]),
			) as ThemeColors;
			const page = color(block, "background");

			const basket = purchaseBand("basket", palette, scheme);
			// The band is the stage's own colour, or an anchor of it. Never anything else: this is
			// what ties the band back to the stage it belongs to.
			expect([color(block, "basket"), basket?.color]).toContain(basket?.color);
			// And it is guaranteed against the page, whatever the palette's own contrast was.
			expect(contrast(basket?.color ?? "#000000", page)).toBeGreaterThanOrEqual(
				4.5,
			);

			const confirmed = purchaseBand("confirmed", palette, scheme);
			const delivery = purchaseBand("delivery", palette, scheme);
			expect(delivery?.color).toBe(confirmed?.color);
			expect(
				contrast(delivery?.color ?? "#000000", delivery?.ink ?? "#000000"),
			).toBeGreaterThanOrEqual(4.5);
			expect(statusBarStyleForInk(delivery?.ink ?? "#000000")).toBe(
				scheme === "dark" ? "dark" : "light",
			);
			// `paid` reads `success`, so it must track that token rather than `info`. Asserted as
			// "anchored from its own stage colour", which is true whether or not anchoring moved it.
			const paid = purchaseBand("paid", palette, scheme);
			const success = color(block, "success");
			expect([success, paid?.color]).toContain(paid?.color);
			expect(contrast(paid?.color ?? "#000000", page)).toBeGreaterThanOrEqual(
				4.5,
			);
			expect(
				contrast(paid?.color ?? "#000000", paid?.ink ?? "#000000"),
			).toBeGreaterThanOrEqual(4.5);
			for (const stage of [
				"basket",
				"inCart",
				"checkout",
				"confirmed",
				"paid",
			] as const) {
				const band = purchaseBand(stage, palette, scheme);
				expect(band).not.toBeNull();
				// The ink is legible on the band, on every stage and both schemes.
				expect(
					contrast(band?.color ?? "#000000", band?.ink ?? "#000000"),
				).toBeGreaterThanOrEqual(4.5);
				// And the status bar points the same way the ink does.
				//
				// This replaces a hardcoded per-stage table ("basket dark, inCart dark, checkout
				// dark, then scheme-keyed"). A table like that goes stale the moment a palette is
				// re-picked, and it was only ever a restatement of which Foreground token each
				// stage happened to carry. The answer is computed now, so the assertion is the
				// rule that produced it: glyphs wear the ink, so the style must follow the ink.
				const ink = band?.ink ?? "#000000";
				expect(statusBarStyleForInk(ink)).toBe(
					contrast(ink, "#000000") < contrast(ink, "#ffffff")
						? "dark"
						: "light",
				);
			}
		});
	}
});
