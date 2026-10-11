import { LAUNCH_PRICE_BOOK, priceMinorFor } from "@pymeshub/shared";
import { describe, expect, it } from "vitest";

import { money, toMinor } from "./console-money";

/**
 * The console's money, asserted without mounting the console.
 *
 * These exist because of a hundred-fold error that reached an operator. The console
 * reimplemented the currency exponent by hand — `minor / 100` on the way out,
 * `value * 100` on the way in — on the assumption that every currency has hundredths.
 * The colón has none, so a subscription on the ₡10 900 `EMPRENDE` plan read `₡109`
 * under **Precio** and **Debe**, and an operator typing `10900` into the payment
 * dialog sent ₡1 090 000.
 *
 * `packages/shared/src/money.ts` replaced that assumption with a per-currency exponent
 * table, and the storefront, the cart and the order pages were migrated. The console and
 * the marketing pricing page were not, so the same product quoted two different prices
 * for the same plan depending on where you read it.
 *
 * The assertions below are mostly phrased against `LAUNCH_PRICE_BOOK` rather than against
 * literal numbers on purpose: the book is what the Worker prices from, so a figure that
 * moves there moves here too, and a test pinned to a hardcoded `10900` would keep passing
 * after the bug came back by exactly the amount that matters.
 */
const emprendeMonthly = priceMinorFor("EMPRENDE", "MONTHLY", LAUNCH_PRICE_BOOK);
const businessYearly = priceMinorFor("BUSINESS", "YEARLY", LAUNCH_PRICE_BOOK);

/** The digits a rendered amount carries, so a separator or symbol cannot fail the test. */
const digitsOf = (rendered: string) => rendered.replace(/\D/g, "");

describe("money", () => {
	it("prints a plan price at the magnitude the price book holds", () => {
		// ₡10 900, not ₡109. This is the assertion the whole module exists for.
		expect(digitsOf(money(emprendeMonthly, "CRC"))).toBe("10900");
		expect(digitsOf(money(businessYearly, "CRC"))).toBe("599000");
	});

	it("does not invent cents for a currency that has none", () => {
		expect(money(emprendeMonthly, "CRC")).not.toMatch(/[.,]\d\d$/);
	});

	it("keeps the cents a two-decimal currency does have", () => {
		// The exponent is per currency, not a global `/100`. A dollar business is a real
		// value of `business.currency`, and reading it as colones would have been the
		// second half of the same bug. `es-CR` writes the decimal point as a comma, so the
		// two decimals are asserted as `,00` rather than `.00`.
		const rendered = money(1500, "USD");

		expect(digitsOf(rendered)).toBe("1500");
		expect(rendered).toMatch(/,\d\d$/);
	});

	it("prints an unknown currency raw rather than relabelling it", () => {
		// Falling back to `"CRC"` would draw a confidently wrong symbol next to a real
		// number. Admitting the code keeps the figure and stops the lie.
		expect(money(10900, "XYZ")).toBe("10900 XYZ");
	});

	it("renders zero as an amount, not as nothing", () => {
		expect(digitsOf(money(0, "CRC"))).toBe("0");
	});
});

describe("toMinor", () => {
	it("sends what the operator typed, unscaled", () => {
		// The write-side half of the same bug: `10900` used to become `1090000`.
		expect(toMinor("10900")).toBe(10900);
		expect(toMinor(String(emprendeMonthly))).toBe(emprendeMonthly);
	});

	it("reads what money prints, so the dialog placeholder is typeable", () => {
		expect(toMinor(money(emprendeMonthly, "CRC"))).toBe(emprendeMonthly);
	});

	it("reads a Costa Rican thousands separator as grouping, not as cents", () => {
		// ₡1.500 is fifteen hundred colones. There are no cents for a dot to be a decimal
		// point in, so this cannot mean one and a half.
		expect(toMinor("1.500")).toBe(1500);
		expect(toMinor("10.900")).toBe(10900);
	});

	it("tolerates a symbol pasted in with the figure", () => {
		expect(toMinor("₡10.900")).toBe(10900);
	});

	it("refuses an empty or non-positive field rather than sending zero", () => {
		// Zero is a real amount to record against a debt, so it must never be what an
		// untouched form sends. `recordPaymentInput.amountMinor` is `.positive()`.
		expect(toMinor("")).toBeNull();
		expect(toMinor("   ")).toBeNull();
		expect(toMinor("0")).toBeNull();
		expect(toMinor("-5000")).toBeNull();
		expect(toMinor("abc")).toBeNull();
	});

	it("round-trips every price in the launch book", () => {
		for (const [plan, cadences] of Object.entries(LAUNCH_PRICE_BOOK.prices)) {
			for (const [cadence, minor] of Object.entries(cadences)) {
				const label = `${plan}:${cadence}`;
				expect(toMinor(money(minor as number, "CRC")), label).toBe(minor);
			}
		}
	});
});
