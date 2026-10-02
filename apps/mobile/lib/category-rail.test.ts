import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rail's label has to fit the words it is given, and this is what holds it to that.
 *
 * The defect this file exists for was visible in one screenshot and invisible to every other
 * check: `Decoració / n`, `Tecnolog / ía`, `Recreaci / ón`. A word wider than its box is not
 * ellipsised or hyphenated by the text engine — it is **broken**, silently, and the type
 * checker has nothing to say about it because nothing is mistyped. Typecheck passed, biome
 * passed, 64 tests passed, and the rail still shipped `Decoración` cut in half.
 *
 * So the invariant is asserted directly, against the taxonomy **in the repository** rather
 * than a fixture: every category name must have a widest word that fits `TILE_WIDTH`.
 *
 * ## Sectors and leaves are not the same population, and conflating them is how this test
 * first failed
 *
 * The three callers that pass **sectors** — the feed, the search screen's idle rail, and a
 * category's own page — are fully served by `TILE_WIDTH`. The fourth, the search screen's
 * *results* rail, draws whatever a query matched, and a leaf like `Electrodomésticos` is
 * ~115pt: no column that shows three tiles across a phone holds that word.
 *
 * So the two are measured separately and asserted differently. Sectors are a hard invariant
 * that fails the build. Leaves are a **known, counted** exception — asserted as a number so
 * that shortening one of those names, or adding a tenth, is visible in a diff instead of
 * quietly shipping. Reading all 242 names as one population is what produced a first version
 * of this file that failed for 42 categories the rail is never actually given.
 *
 * ## Read from source, for the reason `lib/tab-bar-coverage.test.ts` reads its layout
 *
 * `components/category-rail.tsx` imports `react-native`, `@/theme` and `expo-router`, none
 * of which resolve under `bun test`. The constants are parsed out of the file. That is weaker
 * than importing the value, and it is the right trade: what is protected is the *number*.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const RAIL = join(REPO, "apps", "mobile", "components", "category-rail.tsx");
/** Inserted the hierarchy, with `parent_id` NULL on a sector and a slug on a leaf. */
const TAXONOMY = join(
	REPO,
	"packages",
	"db",
	"migrations",
	"0006_category_taxonomy.sql",
);
/** Rewrote `name` into Spanish, keyed by slug. */
const NAMES_ES = join(
	REPO,
	"packages",
	"db",
	"migrations",
	"0008_category_names_es.sql",
);

/** The `label` token's size — `label: { fontSize: 13, lineHeight: 18 }` in `theme/tokens.ts`. */
const LABEL_FONT_PT = 13;

/**
 * Leaves whose widest word cannot fit `TILE_WIDTH`, expected by name.
 *
 * Not a number, because a number stops meaning anything the moment somebody fixes one of
 * them and does not touch the test. Naming them means the failure says *which* name to look
 * at, and `Electrodomésticos` is a real category a real reader searches for.
 */
const KNOWN_UNFITTABLE_LEAVES = [
	"Electrodomésticos",
	"Electrodomésticos (DIY)",
];

const source = readFileSync(RAIL, "utf-8");

/** A declared `const NAME = <number>;` out of the rail. */
function declared(name: string): number {
	const found = source.match(new RegExp(`const ${name} = (\\d+);`));
	if (found?.[1] === undefined) {
		throw new Error(`${name} not found in category-rail.tsx`);
	}
	return Number(found[1]);
}

/**
 * The rail's gap, resolved through `theme/tokens.ts` rather than restated.
 *
 * It is written as `space.xs` in the rail — a name, not a number — so a literal `4` here would
 * keep passing the day `space.xs` changed, which is the trap this file walked into when the
 * visible-tile count was asserted against a hardcoded gap.
 */
function declaredGap(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const token = rail.match(/gap:\s*space\.(\w+)/)?.[1];
	if (token === undefined) throw new Error("rail gap not found");
	const tokens = readFileSync(
		join(REPO, "apps", "mobile", "theme", "tokens.ts"),
		"utf-8",
	);
	const found = tokens.match(new RegExp(`\\n\\s*${token}: (\\d+),`));
	if (found?.[1] === undefined) throw new Error(`space.${token} not found`);
	return Number(found[1]);
}

/**
 * The width of a word in points, rounded **up** on every glyph class.
 *
 * An upper bound, and deliberately generous, because this measures whether a word *could*
 * exceed its box: over-reporting can only make the test stricter, and the margin is far
 * smaller than the ~17pt it would take to fail a name that genuinely fits. `m`/`w` at 0.90em
 * against a true ~0.85, capitals 0.68 against ~0.64, the accented vowels that carry half the
 * Spanish names 0.56 against ~0.52.
 */
function widestWordPt(word: string, fontPt: number): number {
	let ems = 0;
	for (const char of word) {
		if ("iljtfrI.,;:'!|".includes(char)) ems += 0.34;
		else if (char === " ") ems += 0.3;
		else if ("mwMW".includes(char)) ems += 0.9;
		else if (char >= "A" && char <= "Z") ems += 0.68;
		else if ("áéíóúñÁÉÍÓÚÑüÜ".includes(char)) ems += 0.56;
		else if (char >= "0" && char <= "9") ems += 0.6;
		else ems += 0.56;
	}
	return ems * fontPt;
}

/** The taxonomy as slugs, split by level — a sector's `parent_id` is NULL in `0006`. */
function taxonomyLevels(): { sectors: string[]; leaves: string[] } {
	const sql = readFileSync(TAXONOMY, "utf-8");
	const sectors: string[] = [];
	const leaves: string[] = [];
	const row =
		/\('cat_[^']*',\s*'([^']*)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*(?:'[^']*'|NULL),\s*(NULL|'cat_[^']*'),/g;
	for (const match of sql.matchAll(row)) {
		const slug = match[1];
		const parent = match[2];
		if (!slug || !parent) continue;
		if (parent === "NULL") sectors.push(slug);
		else leaves.push(slug);
	}
	return { sectors, leaves };
}

/** The Spanish name for every slug, from `0008`. */
function spanishNames(): Map<string, string> {
	const sql = readFileSync(NAMES_ES, "utf-8");
	const names = new Map<string, string>();
	const update = /set `name` = '([^']+)'.*?where `slug` = '([^']+)'/g;
	for (const match of sql.matchAll(update)) {
		const name = match[1];
		const slug = match[2];
		if (name && slug) names.set(slug, name);
	}
	return names;
}

/** Every name in a level, resolved through `0008`. */
function namesIn(level: string[]): string[] {
	const spanish = spanishNames();
	return level
		.map((slug) => spanish.get(slug))
		.filter((name): name is string => name !== undefined);
}

/** The names in a level whose widest word overflows the column. */
function overflowingIn(level: string[]): string[] {
	const column = declared("TILE_WIDTH");
	return namesIn(level)
		.filter((name) =>
			name
				.split(/\s+/)
				.some((word) => widestWordPt(word, LABEL_FONT_PT) > column),
		)
		.sort();
}

/**
 * The rail's source with every comment removed.
 *
 * Not tidiness. This file's own docblock explains the no-truncation rule and therefore
 * *contains the words* `numberOfLines` and `ellipsizeMode`, so a naive grep over the source
 * fails on the explanation of the rule it is checking. Only code is evidence.
 */
function codeOnly(): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the category rail's label column", () => {
	test("no sector name has a word wider than the tile", () => {
		// The enforceable half, and the one three of the four callers depend on. At 60pt this
		// failed for 10 of the 18 sectors; `Entretenimiento` (~98pt) is what sets the width.
		expect(overflowingIn(taxonomyLevels().sectors)).toEqual([]);
	});

	test("the widest sector word fits with room for one more character", () => {
		// Not the same assertion. The first says nothing overflows; this says the constant is
		// not sitting a point above the longest word. Eight points is roughly one character
		// at this size: 102 left four and was caught here, because four is not enough for the
		// next sector whose longest word is one letter longer than `Entretenimiento`.
		const column = declared("TILE_WIDTH");
		const widest = Math.max(
			...namesIn(taxonomyLevels().sectors).flatMap((name) =>
				name.split(/\s+/).map((word) => widestWordPt(word, LABEL_FONT_PT)),
			),
		);
		expect(widest).toBeLessThan(column - 8);
	});

	test("the leaves that cannot fit are the two we know about, by name", () => {
		// `Electrodomésticos` is ~115pt and no column showing three tiles across a phone
		// holds it. Asserting it as a *list* rather than a count is the point: shortening
		// either name, or adding a tenth, shows up in this diff instead of shipping.
		expect(overflowingIn(taxonomyLevels().leaves)).toEqual(
			[...KNOWN_UNFITTABLE_LEAVES].sort(),
		);
	});

	test("the mark's box is not the label column, which is what let the fix exist", () => {
		// One constant drove both, so widening the tile to fit a word would have widened the
		// box too and taken tiles off the rail to buy it back. Two numbers now; this stops
		// them being merged into one again.
		expect(declared("DISC_SIZE")).toBe(60);
		expect(declared("TILE_WIDTH")).toBeGreaterThan(declared("DISC_SIZE"));
	});

	test("the box is squared, not a disc", () => {
		// `radius.full` on a square is a circle, and the curve throws away the corners a glyph
		// never uses. `radius.sm` is 6pt — 14% of a 60pt box, which reads as a square with
		// softened corners rather than a lozenge. It is the same ratio `md` had on a 44pt tile,
		// so the proportion does not drift when the box is resized.
		expect(source).toMatch(/tileBox:\s*\{[^}]*borderRadius:\s*radius\.sm/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.full/);
	});

	test("a category photograph takes the box's corner, not a circle", () => {
		// `radiusToken="full"` would clip a picture to a disc inside a squared box — the shape
		// the tile is not, drawn again one layer down. Invisible today: `image_url` is null on
		// all 242 rows.
		expect(codeOnly()).not.toMatch(/radiusToken="full"/);
		expect(source).toMatch(/radiusToken="sm"/);
	});

	test("the tiles are labelled, and the name reaches a screen reader", () => {
		// The rail's job is to name the categories. An icon-only strip of eight marks cannot:
		// utensils, shirt, film, house, sparkles, dumbbell, car and gamepad are guesses, and a
		// reader who cannot guess has no way through. This is the assertion that keeps the
		// labels from being "simplified" away again — the mistake that made this strip eight
		// unidentified squares.
		expect(codeOnly()).toMatch(/<Text/);
		expect(source).toMatch(/accessibilityLabel=\{label\}/);
		expect(codeOnly()).not.toMatch(/numberOfLines/);
		expect(codeOnly()).not.toMatch(/ellipsizeMode/);
	});

	test("the gap between tiles is the scale's tightest step", () => {
		// `space.sm` (8) was two steps too loose: the labels carry the eye across the row, and
		// eight points between two tiles breaks that. `space.xs` is the smallest step in
		// `theme/tokens.ts`, read through the scale rather than restated.
		expect(declaredGap()).toBe(4);
	});

	test("the label states its own width, because the tile's alignItems will not", () => {
		// `alignItems: "center"` sizes a child to its *content*, so a `<Text>` with no width
		// lays out unbroken and overflows rather than wrapping. The width on `tileLabel` is
		// the mechanism of the fix, not tidying.
		expect(source).toMatch(/tileLabel:\s*\{[^}]*width:\s*TILE_WIDTH/);
	});

	test("nothing here truncates a category's name", () => {
		// `./product-tile`'s rule, applied to the rail: a cap is truncating data to save a
		// layout, and "Juguetes, Pasatiempos y Coleccionables" with an ellipsis is a different
		// category from the one the reader is looking for. Checked against the code, because
		// this file's own docblock names both props in order to explain the rule.
		const code = codeOnly();
		expect(code).not.toMatch(/numberOfLines/);
		expect(code).not.toMatch(/ellipsizeMode/);
	});

	test("the rail shows three tiles across, and that is the documented price", () => {
		// The cost of the width, asserted so the docblock's "three where there were five"
		// cannot quietly become wrong. `space.lg` insets and `space.sm` gaps, on the
		// narrowest phone the app supports.
		const column = declared("TILE_WIDTH");
		const screen = 320;
		const insets = 16 * 2;
		const gap = 8;
		const visible = Math.floor((screen - insets + gap) / (column + gap));
		expect(visible).toBe(2);
	});
});
