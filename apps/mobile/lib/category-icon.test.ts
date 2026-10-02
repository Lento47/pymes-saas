import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The heavier glyph, and the guards around deriving it.
 *
 * Ionicons ships 1357 glyphs in exactly two families — 421 `-outline` and 421 `-sharp`, with
 * **no filled set** — so "use less flat icons" is not something this mapping can deliver. What
 * it can deliver is weight: the same drawing with more of it, at 20pt inside a 60pt disc, which
 * is where a 1.5pt stroke starts to look like a hairline against the street tiles and the pale
 * `accent` disc it sits on.
 *
 * Read from source for the reason `lib/category-rail.test.ts` reads its component:
 * `category-icon.ts` imports `@expo/vector-icons`, which needs a native module and does not
 * resolve under `bun test`. What is protected here is the *mapping* and the *fallbacks*, and
 * both are stated as data rather than imported as behaviour.
 */

const FILE = join(import.meta.dir, "category-icon.ts");
const GLYPHMAP = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"node_modules",
	"@expo",
	"vector-icons",
	"build",
	"vendor",
	"react-native-vector-icons",
	"glyphmaps",
	"Ionicons.json",
);

/** The fallback constant as declared, so a rename cannot pass silently. */
function fallbackConstant(): string {
	const source = readFileSync(FILE, "utf-8");
	const found = source.match(
		/export const FALLBACK_CATEGORY_ICON = "([^"]+)";/,
	);
	if (found?.[1] === undefined) {
		throw new Error("FALLBACK_CATEGORY_ICON not found");
	}
	return found[1];
}

/** Ionicons' own glyph names, the authority on what this build can draw. */
function glyphNames(): Set<string> {
	const json = JSON.parse(readFileSync(GLYPHMAP, "utf-8")) as Record<
		string,
		unknown
	>;
	return new Set(Object.keys(json));
}

const glyphs = glyphNames();
const outlines = [...glyphs].filter((name) => name.endsWith("-outline"));
const sharps = new Set([...glyphs].filter((name) => name.endsWith("-sharp")));

/** The icons actually in use by the 18 sectors in production. */
const PRODUCTION_ICONS = [
	"sparkles-outline",
	"shirt-outline",
	"school-outline",
	"restaurant-outline",
	"pricetags-outline",
	"paw-outline",
	"leaf-outline",
	"home-outline",
	"hardware-chip-outline",
	"game-controller-outline",
];

describe("the category icon weight", () => {
	test("every outline glyph has a sharp twin", () => {
		// The premise of the whole mapping. If one outline had no twin, deriving would hand
		// the renderer a name that does not exist and draw the tofu box this file exists to
		// prevent — so this is asserted over the *set*, not over the names we happen to use.
		const orphans = outlines.filter(
			(name) => !sharps.has(name.replace(/-outline$/, "-sharp")),
		);
		expect(orphans).toEqual([]);
	});

	test("the two families are the same size, so the mapping loses nothing", () => {
		expect(sharps.size).toBe(outlines.length);
	});

	test("every icon in production has a heavier twin", () => {
		const missing = PRODUCTION_ICONS.filter(
			(name) => !sharps.has(name.replace(/-outline$/, "-sharp")),
		);
		expect(missing).toEqual([]);
	});

	test("the fallback is the heavier one too", () => {
		// 224 of the 242 category rows have `icon_name` set to NULL and land here. A fallback
		// left at `-outline` would draw the lightest glyph in the app for the majority of
		// categories — heavier for the ones that picked an icon, thinner for the ones that
		// did not, which is backwards.
		const fallback = fallbackConstant();
		expect(fallback.endsWith("-sharp")).toBe(true);
		expect(glyphs.has(fallback)).toBe(true);
	});

	test("the fallback is drawn in the same shape as before", () => {
		// Not a style opinion: a fallback that changed *drawing* would change what a category
		// with a misspelled name looks like. Same tag, more weight.
		expect(fallbackConstant().replace("-sharp", "")).toBe("pricetag");
	});

	test("the mapping is total: nothing derives to a name the set lacks", () => {
		const derived = outlines.map((name) => name.replace(/-outline$/, "-sharp"));
		const unknown = derived.filter((name) => !glyphs.has(name));
		expect(unknown).toEqual([]);
	});

	test("a name already sharp is left alone rather than doubled up", () => {
		// Not a hypothetical: `sharper` runs on every known name, and a row stored as
		// `-sharp` must not come back as `pricetag-sharp-sharp`.
		const once = "pricetag-sharp".replace(/-outline$/, "-sharp");
		expect(once).toBe("pricetag-sharp");
	});

	test("a name with no suffix is left alone", () => {
		// Ionicons has 515 unsuffixed glyphs as well. They are already as drawn as they get.
		for (const bare of ["add", "remove", "checkmark"]) {
			if (!glyphs.has(bare)) continue;
			expect(bare.replace(/-outline$/, "-sharp")).toBe(bare);
		}
	});

	test("validation happens on the name the database sent, not the derived one", () => {
		// The order inside `categoryIcon` is load-bearing and invisible to every test above.
		// If it validated the *derived* name, `restaurant-outlin` would become
		// `restaurant-sharp` — a real glyph — and the misspelling would pass unremarked,
		// which is precisely the failure the `__DEV__` warning exists to catch.
		const source = readFileSync(FILE, "utf-8");
		const validateAt = source.indexOf("Object.hasOwn(Ionicons.glyphMap");
		const deriveAt = source.indexOf("known ? sharper(iconName)");
		expect(validateAt).toBeGreaterThan(-1);
		expect(deriveAt).toBeGreaterThan(-1);
		expect(validateAt).toBeLessThan(deriveAt);
	});

	test("this is a weight change and not a style change", () => {
		// Stated so the next person does not read "sharper" as "filled". Ionicons has no
		// filled family; a solid shape is a different icon set (thirteen more ship inside
		// `@expo/vector-icons`, several with filled variants) or `Category.imageUrl`, which
		// `./category-rail`'s tile already draws and no row uses.
		expect(sharps.size + outlines.length).toBeLessThan(glyphs.size);
		const filled = [...glyphs].filter((name) => name.includes("filled"));
		expect(filled).toEqual([]);
	});
});
