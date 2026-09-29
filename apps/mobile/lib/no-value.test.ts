import { expect, test } from "bun:test";

import { NO_VALUE } from "./no-value";

/**
 * The glyph, by code point rather than by appearance.
 *
 * A `toBe("—")` would pass on a declaration that had rotted into any other character which
 * happens to render as a horizontal stroke, which is precisely how the copy this module
 * replaced reached a screen: the mojibake was itself valid UTF-8, so every toolchain in the
 * chain accepted it and nothing failed. `codePointAt` is the one assertion that cannot be
 * satisfied by something that merely looks right.
 */
test("NO_VALUE is the em dash and nothing else", () => {
	expect(NO_VALUE.codePointAt(0)).toBe(0x2014);
	expect([...NO_VALUE]).toHaveLength(1);
});

test("NO_VALUE is not the en dash it gets confused with", () => {
	// U+2013 renders almost identically at text sizes and is the substitution a
	// well-meaning edit makes, so it is named rather than left implicit.
	expect(NO_VALUE.codePointAt(0)).not.toBe(0x2013);
});

test("NO_VALUE is not what a latin1 round trip makes of it", () => {
	// The corruption this guards against *was* an encoding round trip through cp1252.
	// Performing it here and comparing is the failure itself, written down: em dash is
	// E2 80 94 in UTF-8, and read as latin1 that is three characters, the first of which is
	// U+00E2. If this ever asserted equal, the constant had been through that boundary and
	// nobody noticed.
	const throughLatin1 = Buffer.from(NO_VALUE, "utf8").toString("latin1");
	expect(throughLatin1.codePointAt(0)).not.toBe(0x2014);
	expect(throughLatin1).not.toBe(NO_VALUE);
});
