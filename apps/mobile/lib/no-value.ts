/**
 * The glyph a figure prints when there is no figure.
 *
 * An em dash is punctuation, so it cannot be anybody's name, an amount or a count. It is
 * what a table in any language prints for "no value here", and it is the same glyph in both
 * dictionaries — which is why this is a constant and not a key in `@pymeshub/i18n`: there is
 * nothing in it to translate.
 *
 * ## Why it is one module and not three declarations
 *
 * It was three. `app/account.tsx` and `components/merchant-pulse.tsx` each declared their own
 * correctly-encoded copy, and `app/(business)/index.tsx` had a third that was **not** an em
 * dash at all: the bytes `E2 80 94` had been read as cp1252 somewhere in the file's history and
 * re-saved, which turned one character into three — the Greek capital gamma, a cedilla-bearing
 * C, and an o-umlaut. It shipped. It rendered on the merchant home as `ΓÇö` in place of three
 * dashes, and it was in that file's `accessibilityLabel` too, so a screen reader read the
 * mojibake aloud.
 *
 * Nothing objected along the way, and that is the part worth keeping: the corrupted form is
 * *itself* valid UTF-8, so every tool in the chain — the editor, `tsc`, biome, the bundler —
 * accepted it and passed it through to the screen. A duplicated constant that can rot without
 * failing anything is not a style question, and the argument every other one-source rule in
 * this repo makes applies here exactly: three copies is how two of them come to disagree, and
 * here one of them already had.
 *
 * ## The test beside it
 *
 * `no-value.test.ts` asserts the code point rather than the glyph. A literal comparison would
 * pass on a file that had rotted a second time into something that still looked like a dash;
 * `codePointAt` cannot.
 */

/** U+2014 EM DASH. Not U+2013 (en dash), not U+FF0D (fullwidth hyphen-minus). */
export const NO_VALUE = "—";
