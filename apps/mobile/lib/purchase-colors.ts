import type { ColorScheme, ThemeColors } from "@/theme";

import { mixHex } from "./color";

import type { PurchaseStage } from "./purchase-state";

export function purchaseBand(
	stage: PurchaseStage,
	colors: ThemeColors,
	scheme: ColorScheme,
): { color: string; ink: string } | null {
	switch (stage) {
		case "browsing":
			return colors.primary.toLowerCase() === "#c8ff18"
				? {
						color: colors.primary,
						ink:
							scheme === "dark"
								? colors.primaryForeground
								: colors.secondaryForeground,
					}
				: null;
		case "basket":
			return { color: colors.basket, ink: colors.basketForeground };
		case "inCart":
			return { color: colors.inCart, ink: colors.inCartForeground };
		case "checkout":
			return { color: colors.checkout, ink: colors.checkoutForeground };
		case "confirmed":
			return { color: colors.info, ink: colors.infoForeground };
		case "delivery":
			return { color: colors.info, ink: colors.infoForeground };
		case "paid":
			return { color: colors.success, ink: colors.successForeground };
	}
}

export function statusBarStyleForInk(ink: string): "dark" | "light" {
	const red = Number.parseInt(ink.slice(1, 3), 16);
	const green = Number.parseInt(ink.slice(3, 5), 16);
	const blue = Number.parseInt(ink.slice(5, 7), 16);
	return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 128 ? "dark" : "light";
}

export function deliveryFluidColor(
	bandColor: string,
	primaryColor: string,
	scheme: ColorScheme,
): string {
	return scheme === "dark" ? bandColor : mixHex(bandColor, primaryColor, 0.65);
}
