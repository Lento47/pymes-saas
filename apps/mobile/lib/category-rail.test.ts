import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rail is a staggered strip of photographs with the category's name under each, and this
 * is what holds it to that.
 *
 * ## The label suite that used to live here, and why it is back
 *
 * There were seven tests measuring Spanish sector names against a text column, because the
 * rail drew `Decoración` as `Decoració / n` — a word wider than its box is not ellipsised, it
 * is *broken*. The fix was a 108pt column wide enough for `Entretenimiento` (~98pt), and it
 * cost the rail its density: three tiles across, ragged one-and-two-line bottoms, for a strip
 * whose job is being scanned in one pass.
 *
 * The names then came off, the seven tests went with them, and the tile went to 64 — because
 * that number was chosen for a 24pt *glyph*, which is the point. All 18 sectors now carry a
 * photograph, and a photograph at 64 is legible as *a category* but not as *which* category.
 *
 * So the labels are back at the width that can hold them, the tile is back to 108, and so are
 * the seven tests. A word wider than its box is still a broken word, and `TILE` is now the
 * label column again rather than only a picture.
 *
 * ## What the numbers are, and where they come from
 *
 * `TILE`, `COLUMN_PITCH`, `ROW_OFFSET` and `GLYPH_SIZE` are read out of the rail by name
 * rather than restated here, so this file cannot pass against a layout it is not describing.
 * The `space.*` and `radius.*` values are read from their **own block** in `tokens.ts`:
 * `tokens.ts` declares `sm` more than once — `radius.sm` is 6 and `space.sm` is 8 — and a
 * helper matching the first `\n sm: (\d+),` in the file answers a spacing question with the
 * radius.
 *
 * ## Read from source, for the reason `lib/tab-bar-coverage.test.ts` reads its layout
 *
 * `components/category-rail.tsx` imports `react-native`, `@/theme` and `expo-router`, none of
 * which resolve under `bun test`. What is protected is the declaration, not behaviour.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const RAIL = join(REPO, "apps", "mobile", "components", "category-rail.tsx");
const TAXONOMY = join(
	REPO,
	"packages",
	"db",
	"migrations",
	"0006_category_taxonomy.sql",
);
const NAMES_ES = join(
	REPO,
	"packages",
	"db",
	"migrations",
	"0008_category_names_es.sql",
);

const source = readFileSync(RAIL, "utf-8");
const tokens = readFileSync(
	join(REPO, "apps", "mobile", "theme", "tokens.ts"),
	"utf-8",
);

/** A declared `const NAME = <number>;` out of the rail. */
function declared(name: string): number {
	const found = source.match(
		new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?);`),
	)?.[1];
	if (found === undefined) {
		throw new Error(`${name} not found in category-rail.tsx`);
	}
	return Number(found);
}

/**
 * A value from one named scale in `theme/tokens.ts`.
 *
 * Scoped to the scale's own block, because `sm` means 6 in `radius` and 8 in `space`.
 */
function scale(name: "space" | "radius" | "icon", key: string): number {
	const block = tokens.match(
		new RegExp(`export const ${name} = \\{([^}]*)\\}`),
	)?.[1];
	if (block === undefined) throw new Error(`${name} scale not found`);
	const found = block.match(new RegExp(`\\n\\s*${key}: (\\d+(?:\\.\\d+)?),`));
	if (found?.[1] === undefined) {
		throw new Error(`${name}.${key} not found in tokens.ts`);
	}
	return Number(found[1]);
}

/** `MIN_TOUCH_TARGET`, read the way it is declared. */
function minTouchTarget(): number {
	const found = tokens.match(/export const MIN_TOUCH_TARGET = (\d+);/)?.[1];
	if (found === undefined) throw new Error("MIN_TOUCH_TARGET not found");
	return Number(found);
}

/** How much of the tile the mark occupies. */
function fillRatio(): number {
	return declared("GLYPH_SIZE") / declared("TILE");
}

/** The rail's source with every comment removed. */
function codeOnly(): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * `const COLUMN_PITCH = TILE + space.md;` - an expression, not a number.
 *
 * `declared()` only reads `= <number>;`, so the two derived constants are resolved
 * here. The gap is read *through* the pitch rather than off `styles.rail`, because the
 * rail's style block no longer carries a `gap`: the stagger moved the spacing into the
 * pitch, and a second number left in the styles is exactly the kind of thing the six
 * rounds of tuning this file documents were about.
 */
function pitch(): number {
	const found = source.match(/const COLUMN_PITCH = TILE \+ space\.(\w+);/);
	if (found?.[1] === undefined) throw new Error("COLUMN_PITCH not found");
	return declared("TILE") + scale("space", found[1]);
}

/** `const ROW_OFFSET = space.xl;` - a scale value under another name. */
function rowOffset(): number {
	const found = source.match(/const ROW_OFFSET = space\.(\w+);/);
	if (found?.[1] === undefined) throw new Error("ROW_OFFSET not found");
	return scale("space", found[1]);
}

/** The gutter between columns, read off the pitch expression. */
function declaredGap(): number {
	const found = source.match(/const COLUMN_PITCH = TILE \+ space\.(\w+);/);
	if (found?.[1] === undefined) throw new Error("rail gap not found");
	return scale("space", found[1]);
}

/** The rail's horizontal inset, the same way. */
function declaredPadding(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const name = rail.match(/paddingHorizontal:\s*space\.(\w+)/)?.[1];
	if (name === undefined) throw new Error("rail paddingHorizontal not found");
	return scale("space", name);
}

/** The trailing spacer, read off `railEnd`. */
function spacerWidth(): number {
	const entry = source.match(/railEnd:\s*\{\s*width:\s*space\.(\w+)/)?.[1];
	if (entry === undefined) throw new Error("railEnd spacer not found");
	return scale("space", entry);
}

/** The caption's own size, because the label column is measured against it. */
const CAPTION_PT = 12;

// ── the taxonomy, read from the repository rather than a fixture ───────────────────────

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

function spanishNames(): Map<string, string> {
	const sql = readFileSync(NAMES_ES, "utf-8");
	const names = new Map<string, string>();
	const update = /set `name` = '([^']+)'.*?where `slug` = '([^']*)'/g;
	for (const match of sql.matchAll(update)) {
		const name = match[1];
		const slug = match[2];
		if (name && slug) names.set(slug, name);
	}
	return names;
}

function namesIn(level: string[]): string[] {
	const spanish = spanishNames();
	return level
		.map((slug) => spanish.get(slug))
		.filter((name): name is string => name !== undefined);
}

/**
 * The width of a word in points, rounded **up** on every glyph class.
 *
 * An upper bound, and deliberately generous, because this measures whether a word *could*
 * exceed its box: over-reporting can only make the test stricter, and the margin is far
 * smaller than the ~17pt it would take to fail a name that genuinely fits.
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

function overflowingIn(level: string[]): string[] {
	const column = declared("TILE");
	return namesIn(level)
		.filter((name) =>
			name.split(/\s+/).some((word) => widestWordPt(word, CAPTION_PT) > column),
		)
		.sort();
}

/**
 * The tightest fit in the taxonomy, and the number this file is really about.
 *
 * `Electrodomésticos` is the longest word in all 241 names and it measures **106.6** at the
 * `caption` token's 12pt, inside a 108 column — by 1.4 points.
 *
 * It did not used to. Under the `label` token's 13pt the same word measured 115.4 and was the
 * reason two leaves carried a documented exception; they no longer do, because the caption is
 * a point smaller than the label and the column is the same 108 the label had. So the known
 * -exception list is gone rather than reduced, and `nothing overflows` is now the honest
 * assertion instead of a tolerated pair.
 *
 * The 1.4 is why the margin is asserted rather than the emptiness alone. A reader of
 * `[] === []` learns nothing about how close this is, and the next person to raise the
 * caption to 13 — or to rename that row — would see a green suite until the word broke.
 */
function tightestFitPt(): number {
	return Math.max(
		...namesIn([
			...taxonomyLevels().sectors,
			...taxonomyLevels().leaves,
		]).flatMap((name) =>
			name.split(/\s+/).map((word) => widestWordPt(word, CAPTION_PT)),
		),
	);
}

describe("the category rail's label column", () => {
	test("no sector name has a word wider than the tile", () => {
		// The defect this file exists for: a word wider than its box is *broken*, not
		// ellipsised, and it is invisible to the type checker because nothing is mistyped.
		expect(overflowingIn(taxonomyLevels().sectors)).toEqual([]);
	});

	test("the widest sector word fits with room for one more character", () => {
		// Not the same assertion. The first says nothing overflows; this says the constant is
		// not sitting a point above the longest word. Eight points is roughly one character at
		// this size, and four is not enough for the next sector whose longest word is one letter
		// longer than `Entretenimiento`.
		const column = declared("TILE");
		const widest = Math.max(
			...namesIn(taxonomyLevels().sectors).flatMap((name) =>
				name.split(/\s+/).map((word) => widestWordPt(word, CAPTION_PT)),
			),
		);
		expect(widest).toBeLessThan(column - 8);
	});

	test("nothing in the whole taxonomy overflows, leaves included", () => {
		// Both levels in one assertion, which the previous suite did not do: the two leaves that
		// used to be the documented exception are now measured with the sectors rather than
		// excused by name.
		expect(overflowingIn(taxonomyLevels().leaves)).toEqual([]);
		expect(overflowingIn(taxonomyLevels().sectors)).toEqual([]);
	});

	test("the tightest name in the taxonomy still has room in it", () => {
		// The measurement behind the assertion above, and the number to look at when it fails.
		// `Electrodomésticos` is the longest word in all 241 names at 106.6 of 108 — 1.4 points
		// of slack. That is enough, and it is thin, and asserting the empty list alone would
		// hide how thin.
		expect(tightestFitPt()).toBeLessThanOrEqual(declared("TILE") - 1);
	});

	test("nothing here truncates a category's name", () => {
		// The rule this repo states on `./product-tile`: a cap is truncating data to save a
		// layout, and "Juguetes, Pasatiempos y Coleccionables" with an ellipsis is a different
		// category from the one the reader is looking for. Checked against the code, because
		// this file's own docblock names both props in order to explain the rule.
		const code = codeOnly();
		expect(code).not.toMatch(/numberOfLines/);
		expect(code).not.toMatch(/ellipsizeMode/);
	});

	test("a tile draws the name under the picture, and the name is the button's label", () => {
		// Both halves. The `Text` is what a sighted reader reads; the `accessibilityLabel` is
		// what overrides it for a screen reader, so the button announces once rather than
		// composing the visible name and the hidden picture.
		expect(codeOnly()).toMatch(/<Text variant="caption"/);
		expect(source).toMatch(/accessibilityLabel=\{label\}/);
		expect(source).toMatch(/accessibilityRole="button"/);
	});

	test("the label states its own width, because the column's alignItems will not", () => {
		// `alignItems: center` sizes a child to its content, so a `Text` with no width lays out
		// unbroken and overflows rather than wrapping. The width on `column` is the mechanism of
		// the fix, not tidying.
		expect(source).toMatch(/column:\s*\{[^}]*width: TILE/);
	});
});

describe("the category rail's marks", () => {
	test("the glyph stays out of the accessibility tree", () => {
		// The picture is decoration; the `accessibilityLabel` on the `Pressable` names it.
		expect(codeOnly()).toMatch(/accessibilityElementsHidden/);
		expect(codeOnly()).toMatch(/importantForAccessibility="no"/);
	});

	test("the mark and its box grew together, so the padding inside did not shrink", () => {
		// Box 108, glyph 40 — the same 37% fill the 64/24 pair had. Growing the glyph alone
		// would have taken the padding from 34pt to 32 and, at the size the glyph is now, made
		// the fallback tiles look *more* cramped next to the sectors that have a photograph.
		expect(declared("TILE")).toBe(108);
		expect(declared("GLYPH_SIZE")).toBe(40);
		expect(codeOnly()).toMatch(/size=\{GLYPH_SIZE\}/);
		expect(fillRatio()).toBeGreaterThan(1 / 3);
	});

	test("the box is not smaller than the touch target", () => {
		expect(declared("TILE")).toBeGreaterThanOrEqual(minTouchTarget());
	});

	test("the box is squared-rounded, not a disc", () => {
		// `radius.full` on a square is a circle, and the curve throws away corners a photograph
		// does use. `radius.sm` is 6pt — 6% of a 108pt box.
		expect(source).toMatch(/tileBox:\s*\{[^}]*borderRadius:\s*radius\.sm/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.full/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.md/);
		expect(scale("radius", "sm")).toBe(6);
	});

	test("a category photograph takes the box's corner, not a circle", () => {
		expect(codeOnly()).not.toMatch(/radiusToken="full"/);
		expect(source).toMatch(/radiusToken="sm"/);
	});

	test("the gap between tiles leaves a rejection zone between neighbours", () => {
		// `space.md` (12). Mis-taps come from the gutter rather than from target size, and a
		// 108pt target leaves 7.7pt of clear air at this gap.
		expect(declaredGap()).toBe(12);
		expect(declaredGap()).toBe(scale("space", "md"));
	});

	test("columns land on column boundaries when the rail is flung", () => {
		// The interval must be the tile *and its gap*, or the rail snaps to a grid it does not
		// draw. Invisible in a screenshot, which is why six rounds of tuning through
		// screenshots missed it the first time it was wrong.
		expect(codeOnly()).toMatch(/snapToInterval=\{COLUMN_PITCH\}/);
		expect(pitch()).toBe(declared("TILE") + declaredGap());
	});

	test("the pitch is what getItemLayout reports, so snap and layout cannot disagree", () => {
		// The stagger moves a column down, not sideways, so every column is exactly one pitch
		// wide and `getItemLayout` can state that rather than the list measuring at scroll
		// time. A layout that is measured but not reported is a snap that drifts.
		expect(codeOnly()).toMatch(/getItemLayout/);
		expect(codeOnly()).toMatch(/length: COLUMN_PITCH/);
		expect(codeOnly()).toMatch(/offset: COLUMN_PITCH \* index/);
	});

	test("three tiles are visible, and the rail virtualises rather than mounting eighteen", () => {
		// The count and the reason for the `FlatList`. A horizontal `ScrollView` mounts every
		// child, so with all 18 sectors carrying a photograph the home feed's first paint
		// fetched all 18 — about 772 KB — and 13 of them were for tiles nobody was looking at.
		// `initialNumToRender` is two stagger columns: one more than fits, so a fling is covered
		// without paying for the tail.
		const visible = Math.floor(
			(412 - declaredPadding() * 2 + declaredGap()) / pitch(),
		);
		expect(visible).toBe(3);
		expect(codeOnly()).toMatch(/<FlatList/);
		expect(codeOnly()).not.toMatch(/<ScrollView/);
		const render = source.match(/initialNumToRender=\{(\d+)\}/)?.[1];
		expect(Number(render)).toBeGreaterThanOrEqual(visible);
		expect(Number(render)).toBeLessThanOrEqual(visible * 2);
	});

	test("the tile has an edge, so it reads as an object rather than a tint", () => {
		// On a photograph the boundary is also what separates the picture from the canvas, which
		// matters because the set is mostly light-on-light: a burger on white and a sofa on
		// white are the same value until something bounds them.
		expect(source).toMatch(/borderWidth: selected \? 2 : 1/);
		expect(source).toMatch(/borderColor: selected/);
		expect(codeOnly()).toMatch(/colors\.border/);
	});

	test("selection is not signalled by colour alone", () => {
		// WCAG 1.4.1. `accessibilityState` reaches a screen reader and nobody else, so a
		// *sighted* colour-blind reader needs a second signal. A scale is one: it is a size, so
		// it survives any palette, any colour vision, and greyscale.
		expect(codeOnly()).toMatch(
			/transform: selected \? \[\{ scale: SELECTED_SCALE \}\]/,
		);
		expect(declared("SELECTED_SCALE")).toBeGreaterThan(1);
	});

	test("two selected neighbours cannot touch", () => {
		// The scale grows the tile, and the gap absorbs it. At 1.04 on a 108pt tile that is
		// 4.3pt of growth against a 12pt gutter.
		const grown = declared("TILE") * declared("SELECTED_SCALE");
		expect(grown - declared("TILE")).toBeLessThan(declaredGap());
	});

	test("the stagger is `space.xl`, and `space.xl` is 20", () => {
		// Asserted as an exact value against the scale, not as a bound. It was previously
		// `ROW_OFFSET < TILE / 3` — which is 36 — so it passed at 20 *and* at 30, and the
		// docblock next to the constant claimed 30 for months because nothing could tell. The
		// bound was loose enough to be unfalsifiable, which is the failure mode worth avoiding
		// rather than the number being wrong.
		expect(rowOffset()).toBe(20);
		expect(rowOffset()).toBe(scale("space", "xl"));
		// And the share of the tile, as a fact rather than a bound: 20 of 108 is 18.5%. The
		// docblock used to call this "about a quarter", which it is not.
		expect(rowOffset() / declared("TILE")).toBeLessThan(0.2);
		// Applied by parity, so the two rows alternate rather than the whole rail shifting.
		expect(codeOnly()).toMatch(/index % 2 === 0 \? 0 : ROW_OFFSET/);
		expect(codeOnly()).toMatch(/marginTop: offset/);
	});

	test("the tiles touch neither the screen edge nor each other", () => {
		// A zero gap welds the marks into one shape the reader cannot pull apart, and an inset
		// of zero puts the first tile flush against a rounded screen corner.
		expect(declaredGap()).toBeGreaterThan(0);
		expect(declaredPadding()).toBeGreaterThanOrEqual(declaredGap());
	});

	test("there is a peek past the last column, because the rail scrolls", () => {
		// A tile cut at the edge is information scent. It is also a `ListFooterComponent` now
		// rather than a child: a `FlatList` virtualises children away, and a spacer that
		// disappears on a long list is a spacer that was never there. Less than half a tile, so
		// it shows the edge of a next destination rather than inviting a tap on a partial one.
		expect(codeOnly()).toMatch(/ListFooterComponent/);
		expect(spacerWidth()).toBeGreaterThan(0);
		expect(spacerWidth()).toBeLessThan(declared("TILE"));
	});
});
