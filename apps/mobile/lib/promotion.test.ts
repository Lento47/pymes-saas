import { describe, expect, test } from "bun:test";
import { createTranslator } from "@pymeshub/i18n";
import { formatMoney } from "@pymeshub/shared";

import { promotionCopy } from "./promotion";

describe("selected offer copy", () => {
	test("keeps a percentage benefit and its threshold in the reader's language", () => {
		const promotion = {
			kind: "PERCENT" as const,
			value: 35,
			currency: "CRC" as const,
			minOrderMinor: 1_500,
		};
		const english = createTranslator("en");
		const spanish = createTranslator("es");

		expect(promotionCopy(promotion, english.t, english.intlLocale)).toEqual({
			benefit: "35% off",
			minimum: `Spend at least ${formatMoney(1_500, "CRC", { locale: english.intlLocale })} on products`,
			eligibility: null,
		});
		expect(promotionCopy(promotion, spanish.t, spanish.intlLocale)).toEqual({
			benefit: "35% de descuento",
			minimum: `Compra al menos ${formatMoney(1_500, "CRC", { locale: spanish.intlLocale })} en productos`,
			eligibility: null,
		});
	});

	test("formats fixed discounts in the shop's currency", () => {
		const translator = createTranslator("en");
		const offer = promotionCopy(
			{
				kind: "FIXED",
				value: 2_500,
				currency: "CRC",
				minOrderMinor: null,
			},
			translator.t,
			translator.intlLocale,
		);
		expect(offer.benefit).toBe(
			`${formatMoney(2_500, "CRC", { locale: translator.intlLocale })} off`,
		);
		expect(offer.minimum).toBeNull();
		expect(offer.eligibility).toBeNull();
	});

	test("shows no invented threshold on free delivery", () => {
		const translator = createTranslator("en");
		expect(
			promotionCopy(
				{
					kind: "FREE_DELIVERY",
					value: 0,
					currency: "CRC",
					minOrderMinor: 0,
				},
				translator.t,
				translator.intlLocale,
			),
		).toEqual({
			benefit: "Free delivery",
			minimum: null,
			eligibility: null,
		});
	});

	test("does not invent terms when an older feed omits the minimum", () => {
		const english = createTranslator("en");
		const spanish = createTranslator("es");
		const promotion = {
			kind: "PERCENT" as const,
			value: 35,
			currency: "CRC" as const,
		};
		expect(promotionCopy(promotion, english.t, english.intlLocale)).toEqual({
			benefit: "35% off",
			minimum: null,
			eligibility: "Check offer requirements in your cart",
		});
		expect(promotionCopy(promotion, spanish.t, spanish.intlLocale)).toEqual({
			benefit: "35% de descuento",
			minimum: null,
			eligibility: "Revisa los requisitos en tu carrito",
		});
	});
});
