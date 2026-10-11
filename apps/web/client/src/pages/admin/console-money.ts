import { formatMoney, isCurrency, parseMoney } from "@pymeshub/shared";

/**
 * The console's money, in the console's own module for the same reason `console-sort.ts`
 * is: so the rules can be asserted without mounting the console.
 *
 * `console.tsx` pulls in the trpc client, the query client and a dozen tab components. A
 * test that wanted to ask "what does ₡10 900 look like in the arrears column" would have
 * to mount all of it to read one function — and so the function stayed untested, which is
 * how it stayed wrong. The split is the same one `console-tabs.ts` argues for at length:
 * a pure function in a file of its own is something a test can import.
 *
 * ## What the bug was
 *
 * Both of these used to reimplement the currency exponent by hand:
 *
 *     money(minor, currency)  ->  Intl.NumberFormat(...).format(minor / 100)
 *     toMinor(typed)          ->  Math.round(Number.parseFloat(typed) * 100)
 *
 * That is the reference implementation `@pymeshub/shared` replaced. The exponent that
 * turns a stored amount into a display value belongs to **the currency**, and CRC's is
 * **zero** — the colón has no minor unit. `LAUNCH_PRICE_BOOK` states it as plain numbers:
 * `EMPRENDE: MONTHLY` is `10_900`, meaning ₡10 900, and migration `0027` divided the
 * hundred-fold figures the book originally carried.
 *
 * So the console printed every amount a hundredth of its value. A subscription on the
 * `EMPRENDE` plan showed `₡109` under **Precio** and `₡109` under **Debe** — the debt an
 * operator is chasing — while the pricing page, the seed and the price book all said
 * ₡10 900. An order total and a gross-volume figure were out by the same factor.
 *
 * The write side was worse than the read side, because it did not merely misstate a
 * figure: `toMinor` sent a hundred times the amount the operator typed, and the API
 * accepted it. Typing `10900` into "Monto recibido" recorded ₡1 090 000.
 */

/**
 * A stored amount, as an operator reads it.
 *
 * `isCurrency` is the guard, and **it is a guard rather than a cast** because
 * `AdminSubscription.currency` is `z.string()` while `formatMoney` takes the `Currency`
 * union. An unrecognised code must not be relabelled: falling back to `"CRC"` here would
 * print a confidently wrong symbol next to a real number, which is a worse thing to show
 * an operator than admitting the row holds a currency this console cannot draw. So it
 * prints `10900 XYZ` and the cell keeps its figure.
 *
 * That also means **there is no `try`/`catch`**, where the previous version had one. The
 * catch existed because `Intl.NumberFormat` raises `RangeError` on a currency code it does
 * not know, and a thrown render takes a whole table down with it. `isCurrency` decides
 * that question before the formatter is ever asked, so there is nothing left to catch —
 * and `packages/shared/src/money.ts` is explicit that it refuses to swallow a bad tag
 * itself, on the grounds that a fallback would quietly change the string.
 */
export function money(minor: number, currency: string): string {
  if (!isCurrency(currency)) return `${minor} ${currency}`;
  return formatMoney(minor, currency);
}

/**
 * Colones as an operator types them, to the amount the API takes.
 *
 * The round trip is the whole point and it is not a formality: `₡1.500` on a Costa Rican
 * keyboard is fifteen hundred colones, not one and a half. A currency with no minor unit
 * has no cents for a dot to be a decimal point in, so `parseMoney` reads it as grouping —
 * and it accepts what `money` prints, so the placeholder in the payment dialog is
 * something the operator can type over verbatim.
 *
 * `null` rather than `0`, and that distinction is load-bearing twice over. **Zero is a real
 * amount** — a merchant who paid nothing off an arrears balance is a fact worth recording —
 * so it must not be what an empty form sends. And the non-positive refusal is kept here
 * rather than left to the API, because `recordPaymentInput.amountMinor` is
 * `z.number().int().positive()` and `createPriceBookInput` refuses anything under `100`:
 * the form should say so before the round trip, not after it.
 */
export function toMinor(typed: string): number | null {
  const parsed = parseMoney(typed, "CRC");
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}
