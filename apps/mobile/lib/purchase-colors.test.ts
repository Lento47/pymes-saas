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
			expect(purchaseBand("basket", palette, scheme)).toEqual({
				color: color(block, "basket"),
				ink: color(block, "basketForeground"),
			});
			const confirmed = purchaseBand("confirmed", palette, scheme);
			const delivery = purchaseBand("delivery", palette, scheme);
			expect(delivery?.color).toBe(confirmed?.color);
			expect(
				contrast(delivery?.color ?? "#000000", delivery?.ink ?? "#000000"),
			).toBeGreaterThanOrEqual(4.5);
			expect(statusBarStyleForInk(delivery?.ink ?? "#000000")).toBe(
				scheme === "dark" ? "dark" : "light",
			);
			expect(purchaseBand("paid", palette, scheme)?.color).toBe(
				color(block, "success"),
			);
			for (const stage of [
				"basket",
				"inCart",
				"checkout",
				"confirmed",
				"paid",
			] as const) {
				const band = purchaseBand(stage, palette, scheme);
				expect(band).not.toBeNull();
				expect(statusBarStyleForInk(band?.ink ?? "#000000")).toBe(
					stage === "basket"
						? "dark"
						: stage === "inCart" || stage === "checkout"
							? "dark"
							: scheme === "dark"
								? "dark"
								: "light",
				);
			}
		});
	}
});
