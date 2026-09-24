/**
 * Money tests. These are the cheapest tests in the repo and the ones whose absence
 * costs the most: a rounding mistake here is a customer charged ₡1 500 for a ₡15
 * product, and it is found by the customer, not by us.
 */

import { describe, expect, test } from "bun:test";
import {
	applyDiscount,
	currencyExponent,
	type Discount,
	discountAmountOf,
	formatMoney,
	parseMoney,
	percentageOf,
	sumMoney,
} from "./money";

describe("currencyExponent", () => {
	test("colones and pesos have no minor unit", () => {
		expect(currencyExponent("CRC")).toBe(0);
		expect(currencyExponent("CLP")).toBe(0);
		expect(currencyExponent("JPY")).toBe(0);
	});

	test("dollars have two", () => {
		expect(currencyExponent("USD")).toBe(2);
		expect(currencyExponent("EUR")).toBe(2);
	});
});

describe("formatMoney", () => {
	test("₡1500 renders as fifteen hundred colones, not fifteen", () => {
		const formatted = formatMoney(1500, "CRC", { locale: "es-CR" });
		// The bug this guards: dividing by 100 unconditionally gives "₡15,00".
		expect(formatted).not.toContain("15,00");
		expect(formatted).not.toContain("15.00");
		expect(formatted.replace(/\D/g, "")).toBe("1500");
	});

	test("USD keeps its cents, even when they are zero", () => {
		const formatted = formatMoney(1500, "USD", { locale: "en-US" });
		expect(formatted.replace(/[^\d.]/g, "")).toBe("15.00");
	});

	test("an explicit zero fraction for colones never grows decimals", () => {
		const formatted = formatMoney(1500, "CRC", { locale: "es-CR" });
		expect(formatted).not.toMatch(/[.,]\d/);
	});

	test("zero is a price, not an empty string", () => {
		expect(formatMoney(0, "CRC", { locale: "es-CR" }).replace(/\D/g, "")).toBe(
			"0",
		);
	});

	test("a signed format shows a plus on a positive refund", () => {
		const formatted = formatMoney(500, "CRC", {
			locale: "es-CR",
			signed: true,
		});
		expect(formatted).toContain("+");
	});
});

describe("parseMoney", () => {
	test("es-CR grouping with a decimal comma", () => {
		expect(parseMoney("1.500,50", "USD")).toBe(150050);
	});

	test("a dot-grouped integer in a zero-decimal currency stays whole", () => {
		// The bug this guards: a colon amount has no cents, so "1.500" can only be
		// fifteen hundred — reading the dot as a decimal point gives ₡2.
		expect(parseMoney("1.500", "CRC")).toBe(1500);
		expect(parseMoney("1.500", "CRC")).not.toBe(2);
	});

	test("three digits after a dot in a two-decimal currency is grouping too", () => {
		expect(parseMoney("1.500", "USD")).toBe(150_000);
	});

	test("more precision than the currency has is still a price, not an error", () => {
		expect(parseMoney("25.005", "USD")).toBe(2_500_500);
	});

	test("plain digits", () => {
		expect(parseMoney("2500", "CRC")).toBe(2500);
		expect(parseMoney("25.00", "USD")).toBe(2500);
	});

	test("currency symbols and spaces are ignored", () => {
		expect(parseMoney("₡ 2 500", "CRC")).toBe(2500);
	});

	test("garbage is null, not zero — zero is a real price and null is not", () => {
		expect(parseMoney("", "CRC")).toBeNull();
		expect(parseMoney("abc", "CRC")).toBeNull();
	});

	test("a typed number is treated as major units", () => {
		expect(parseMoney(15, "USD")).toBe(1500);
		expect(parseMoney(1500, "CRC")).toBe(1500);
		expect(parseMoney(Number.NaN, "CRC")).toBeNull();
	});
});

describe("percentageOf", () => {
	test("takes a percentage, not a fraction", () => {
		expect(percentageOf(1000, 13)).toBe(130);
		expect(percentageOf(999, 10)).toBe(100);
		// The bug a fraction would hide: 0.13 as a percent would be 0.13%.
		expect(percentageOf(1000, 13)).not.toBe(13000);
	});

	test("a zero rate is zero, not a rounding artefact", () => {
		expect(percentageOf(1234, 0)).toBe(0);
	});
});

describe("applyDiscount", () => {
	test("a fixed discount subtracts in minor units", () => {
		expect(applyDiscount(5000, { kind: "FIXED", valueMinor: 1200 })).toBe(3800);
	});

	test("a percentage discount is computed against the amount in front of it", () => {
		expect(applyDiscount(5000, { kind: "PERCENT", percent: 20 })).toBe(4000);
	});

	test("the same percentage against a different amount is a different discount", () => {
		const coupon: Discount = { kind: "PERCENT", percent: 10 };
		expect(discountAmountOf(1000, coupon)).toBe(100);
		expect(discountAmountOf(9999, coupon)).toBe(1000);
	});

	test("never goes below zero — a discount larger than the order is free, not negative", () => {
		expect(applyDiscount(1000, { kind: "FIXED", valueMinor: 5000 })).toBe(0);
		expect(applyDiscount(1000, { kind: "PERCENT", percent: 150 })).toBe(0);
	});

	test("a discount never takes off more than the order is worth", () => {
		expect(discountAmountOf(1000, { kind: "FIXED", valueMinor: 5000 })).toBe(
			1000,
		);
		expect(discountAmountOf(1000, { kind: "PERCENT", percent: 150 })).toBe(
			1000,
		);
	});

	test("a negative fixed discount is a zero discount, not a surcharge", () => {
		expect(discountAmountOf(1000, { kind: "FIXED", valueMinor: -500 })).toBe(0);
	});
});

describe("sumMoney", () => {
	test("adds minor units without floating point drift", () => {
		expect(sumMoney([10, 20, 30])).toBe(60);
		expect(sumMoney([])).toBe(0);
	});
});
