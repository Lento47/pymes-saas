import { describe, expect, test } from "bun:test";

import {
	BUSINESS_THEME_IDS,
	type BusinessThemeId,
	DEFAULT_BUSINESS_THEME,
} from "./business-theme-ids";
import {
	businessThemeOrder,
	resolveBusinessTheme,
} from "./business-theme-select";

/**
 * The theme rule, tested as the rule rather than as a rendered screen.
 *
 * Same reasoning as `select.test.ts`, and the file is importless for the same reason it is
 * there: `business-theme-select.ts` imports only `./business-theme-ids`, which has no
 * imports at all, so this runs against the real function with no React Native runtime, no
 * module mock and no preload. `./tokens.ts` is unreachable from here — it reaches
 * `react-native` for `Platform` — which is why the ids were moved out into a file that has
 * no dependencies to reach.
 *
 * The palette values themselves are checked by a separate gate rather than here, because
 * contrast is a computation and not a lookup: this file proves *which* theme is in force,
 * and the other proves whether it is legible.
 */

describe("resolveBusinessTheme", () => {
	test("an untouched device gets the palette the tree always drew", () => {
		// The reason `DEFAULT_BUSINESS_THEME` is `lime` and not `BUSINESS_THEME_IDS[0]`: a
		// reader who never opens the picker must get exactly the app they had before it
		// existed. If the default is ever changed away from the historical palette this
		// assertion is the one that should fail, loudly and on purpose.
		expect(resolveBusinessTheme(null)).toBe("lime");
		expect(DEFAULT_BUSINESS_THEME).toBe("lime");
	});

	test("every id in force resolves back to itself", () => {
		for (const id of BUSINESS_THEME_IDS) {
			expect(resolveBusinessTheme(id)).toBe(id);
		}
	});

	describe("a stored value this build does not have", () => {
		// Ids are persisted, so a theme removed in a later build leaves a real string under
		// the key on every device that had picked it. Resolving to a hole instead of a
		// palette is not a crash — it is a screen whose every colour is `undefined`, which
		// is the failure that gets reported as "the app looks broken" with no stack.
		test("falls back rather than casting", () => {
			expect(resolveBusinessTheme("midnight")).toBe(DEFAULT_BUSINESS_THEME);
			expect(resolveBusinessTheme("")).toBe(DEFAULT_BUSINESS_THEME);
			expect(resolveBusinessTheme("LIME")).toBe(DEFAULT_BUSINESS_THEME);
			expect(resolveBusinessTheme(" lime")).toBe(DEFAULT_BUSINESS_THEME);
			expect(resolveBusinessTheme("lime ")).toBe(DEFAULT_BUSINESS_THEME);
		});

		test("a value that is not a string at all is not a theme", () => {
			// `AsyncStorage` hands back `string | null`, so this cannot happen through the
			// provider. The signature is `unknown`-tolerant anyway, because the alternative
			// is a cast at the one call site that reads it.
			expect(resolveBusinessTheme(undefined)).toBe(DEFAULT_BUSINESS_THEME);
		});
	});
});

describe("businessThemeOrder", () => {
	test("the default is drawn first", () => {
		// The picker opens on the palette an untouched device is already in, so the control
		// an operator is about to tap is where their hand already is.
		expect(businessThemeOrder()[0]).toBe(DEFAULT_BUSINESS_THEME);
	});

	test("the order is the declaration order, and it is stable", () => {
		// A picker that reorders itself when a theme is added moves the control out from
		// under the finger that was reaching for it. `businessThemeOrder` exists so the
		// order is one decision in one place rather than a property of a `Set` iteration.
		expect(businessThemeOrder()).toEqual([...BUSINESS_THEME_IDS]);
		expect(businessThemeOrder()).toEqual(businessThemeOrder());
	});

	test("every id is distinct", () => {
		// Two themes sharing an id would be a palette the picker cannot choose between, and
		// `resolveBusinessTheme` would hand back whichever the table happened to hold last.
		expect(new Set(BUSINESS_THEME_IDS).size).toBe(BUSINESS_THEME_IDS.length);
	});

	test("the ids are what gets written to storage, so they are lowercase and url-safe", () => {
		// These strings are the persisted format. Anything needing escaping or a case fold
		// is a value that has to be normalised on every read, which is the same place a bug
		// would live.
		for (const id of BUSINESS_THEME_IDS) {
			expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
		}
	});
});

describe("the id type and the table cannot disagree", () => {
	test("resolveBusinessTheme only ever returns a declared id", () => {
		// The narrow return type says this at compile time. The assertion is here because
		// the type is erased at runtime and this is the seam where a bad value would enter.
		const checked: BusinessThemeId[] = [
			resolveBusinessTheme(null),
			resolveBusinessTheme("amber"),
			resolveBusinessTheme("nonsense"),
		];
		for (const id of checked) {
			expect(BUSINESS_THEME_IDS).toContain(id);
		}
	});
});
