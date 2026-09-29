import { type Currency, currencyExponent } from "@pymeshub/shared";

/**
 * A currency's own mark, for the reader's locale, and the placeholder a money box
 * shows when it is empty.
 *
 * These live here rather than in the one form that first needed them because both
 * answers are *derived from the shop's currency* and are therefore the same answer
 * for every form that writes money. `./tokens.ts` gives the reason this repo treats
 * a copy as a defect rather than a convenience: a value typed beside one call site
 * is a value the next call site retypes differently, and the two then disagree on a
 * screen the reader is looking at.
 */

/**
 * The currency's own mark, alone, from CLDR rather than from a table written here.
 *
 * A table of one glyph per currency cannot express what CLDR does: `₡` for a Costa Rican
 * shop and `$` for a US one, `A$` beside `AU$`. The mark is chosen by the *locale as well
 * as the currency*, so it is derived from both or it is wrong for somebody — and the day a
 * shop is billed in a currency nobody wrote down, a table draws a three-letter code in the
 * chip and the screen looks broken.
 *
 * `formatToParts` rather than `format`, because `format` returns the *amount* with the mark
 * somewhere inside it and a leading chip wants the mark on its own.
 *
 * The `catch` is not decoration: this runs during a render, and a runtime whose `Intl`
 * cannot build the pair throws rather than degrades. The bare ISO code is an ugly chip,
 * and an ugly chip beats a blank screen.
 */
export function currencySymbol(currency: Currency, locale: string): string {
	try {
		const parts = new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			currencyDisplay: "symbol",
		}).formatToParts(0);
		return parts.find((part) => part.type === "currency")?.value ?? currency;
	} catch {
		return currency;
	}
}

/**
 * The zero a money box is empty with, at the currency's own precision.
 *
 * `"0"` for a currency with no minor unit and `"0.00"` for one with two, taken from
 * `currencyExponent` rather than written per call site, so a form that prefills a price
 * and a form that prefills a minimum order cannot disagree about how many decimals the
 * shop's money has. It is a *placeholder* and not a prefill: the boxes stay empty, because
 * a box holding a zero is a box the owner has to clear, and a currency mark sitting in
 * front of a zero the form chose is a character `parseMoney` then has to strip.
 */
export function amountHint(currency: Currency): string {
	return currencyExponent(currency) === 0 ? "0" : "0.00";
}
