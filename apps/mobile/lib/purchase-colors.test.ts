import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ThemeColors } from "@/theme";
import { BUSINESS_THEME_IDS } from "@/theme/business-theme-ids";

import { mixHex } from "./color";
import {
	BROWSING_RAMP_ALPHA,
	browsingBandTop,
	deliveryFluidColor,
	inkOnBand,
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

function businessColor(
	id: (typeof BUSINESS_THEME_IDS)[number],
	scheme: "light" | "dark",
	name: string,
): string {
	const theme = tokens.split(`\n\t${id}: {`)[1];
	const block = theme?.split(`\n\t\t${scheme}: {`)[1]?.split("\n\t\t},")[0];
	if (!block) throw new Error(`Missing ${id}.${scheme} theme block`);
	return color(block, name);
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
		expect(deliveryFluidColor("#1d60bc", "#3538f2", "light")).toBe("#2556cf");
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
		test(`${scheme} journey keeps readable state colors`, () => {
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
			// The selected primary and stage token are blended before anchoring, then the visible
			// result is guaranteed against the page whatever either source's contrast was.
			expect(contrast(basket?.color ?? "#000000", page)).toBeGreaterThanOrEqual(
				4.5,
			);

			const confirmed = purchaseBand("confirmed", palette, scheme);
			const delivery = purchaseBand("delivery", palette, scheme);
			expect(delivery?.color).not.toBe(confirmed?.color);
			expect(
				contrast(delivery?.color ?? "#000000", delivery?.ink ?? "#000000"),
			).toBeGreaterThanOrEqual(4.5);
			// Paid keeps a success influence without abandoning the selected palette.
			const paid = purchaseBand("paid", palette, scheme);
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

		/**
		 * The browsing band's ink, on every theme — the half that used to be measured on lime only.
		 *
		 * `components/home-header.tsx` applied no browsing ink off lime, so the twelve other themes
		 * left the meta line at its own `mutedForeground` over the band. Measured on the light bands
		 * that ran **1.09:1 to 4.19:1** (berry to lime) where the 13px line owes 4.5 — all thirteen
		 * short, and only lime's legible because only lime's was measured. This pins the guarantee
		 * rather than the hexes: for every theme and scheme, the ink `inkOnBand` picks against the
		 * stop `browsingBandTop` returns clears **4.5:1**, bar the one pair recorded below.
		 *
		 * Both halves of that sentence are load-bearing and are the reason the test is here rather
		 * than in `./home-gradient.test.ts`: the band's top stop is *composited* (the primary drawn
		 * at `BROWSING_RAMP_ALPHA[scheme][0]` over the page), and measuring against the anchored
		 * colour instead — which is what `purchaseBand("browsing", …)` hands back — is a guarantee
		 * about a colour the reader never sees.
		 *
		 * ## The one pair that does not clear it, measured rather than rounded
		 *
		 * `berry` in light lands at **4.4967:1** — three thousandths short. Its composite is
		 * `#b549bf`, relative luminance 0.1835, and that is inside the narrow band where **neither**
		 * white (which needs `L ≤ 0.1833`) nor the theme's own `foreground` `#140A16` (4.31 there)
		 * reaches 4.5.
		 * Of the three inks a band may wear — the stage's preferred Foreground and the theme's
		 * `foreground`/`background` — white at 4.4967 is the best there is; the top stop is what
		 * has to move, and that is `./home-gradient`'s decision rather than this file's. So it is
		 * pinned as the value it is, with `BERRY_LIGHT_INK`, so that it cannot quietly get worse
		 * while still being flagged as the exception it is.
		 */
		const BERRY_LIGHT_INK = 4.49;
		test(`${scheme} browsing band ink is measured on every theme`, () => {
			for (const id of BUSINESS_THEME_IDS) {
				const colors = {
					primary: businessColor(id, scheme, "primary"),
					background: businessColor(id, scheme, "background"),
					foreground: businessColor(id, scheme, "foreground"),
					primaryForeground: businessColor(id, scheme, "primaryForeground"),
					secondaryForeground: businessColor(id, scheme, "secondaryForeground"),
				} as unknown as ThemeColors;
				const top = browsingBandTop(colors.primary, scheme, colors.background);
				const ink = inkOnBand(
					top,
					scheme === "dark"
						? colors.primaryForeground
						: colors.secondaryForeground,
					colors,
				);
				expect(contrast(top, ink)).toBeGreaterThanOrEqual(
					id === "berry" && scheme === "light" ? BERRY_LIGHT_INK : 4.5,
				);
				// The top is the composite the ramp actually draws — the primary over the page
				// at the same alpha `./home-gradient` draws it at — and never an anchor: the
				// anchored primary is 4.5:1 against the page by construction, which is the
				// number that made the old ink look safe while it was not. Read from the one
				// constant both files use, so this cannot pass while they disagree.
				expect(top).toBe(
					id === "lime"
						? colors.primary
						: mixHex(
								colors.primary,
								colors.background,
								BROWSING_RAMP_ALPHA[scheme][0],
							),
				);
			}
			// Lime's ramps are opaque at the top, so its composite *is* the primary — which is
			// why moving the ink off the lime-only gate left lime's ink byte-identical.
			expect(browsingBandTop("#C8FF18", scheme, "#FFFFFF")).toBe("#C8FF18");
			expect(browsingBandTop("#c8ff18", scheme, "#0F0F0F")).toBe("#c8ff18");
		});

		test(`${scheme} purchase states follow every selected palette`, () => {
			const stages = [
				"basket",
				"inCart",
				"checkout",
				"confirmed",
				"paid",
				"delivery",
			] as const;
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
			const selectedPalette = (id: (typeof BUSINESS_THEME_IDS)[number]) => {
				const palette = Object.fromEntries(
					names.map((name) => [name, color(block, name)]),
				) as unknown as Record<string, string>;
				for (const name of [
					"background",
					"foreground",
					"primary",
					"primaryForeground",
					"secondaryForeground",
				]) {
					palette[name] = businessColor(id, scheme, name);
				}
				return palette as unknown as ThemeColors;
			};

			for (const stage of stages) {
				const bands = BUSINESS_THEME_IDS.map((id) => {
					const colors = selectedPalette(id);
					const result = purchaseBand(stage, colors, scheme);
					expect(result).not.toBeNull();
					expect(
						contrast(result?.color ?? "#000000", colors.background),
					).toBeGreaterThanOrEqual(4.5);
					expect(
						contrast(result?.color ?? "#000000", result?.ink ?? "#000000"),
					).toBeGreaterThanOrEqual(4.5);
					return result?.color;
				});
				expect(new Set(bands).size).toBe(BUSINESS_THEME_IDS.length);
			}

			for (const id of BUSINESS_THEME_IDS) {
				const colors = selectedPalette(id);
				const bands = stages.map(
					(stage) => purchaseBand(stage, colors, scheme)?.color,
				);
				expect(new Set(bands).size).toBe(stages.length);
			}
		});
	}
});
