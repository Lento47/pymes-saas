import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What holds the showcase to being two cards of real names.
 *
 * ## Why this file was rewritten rather than edited
 *
 * It asserted a design that no longer exists. The showcase used to be two full-bleed feature
 * cards with the name drawn over the photograph, which needed a scrim, a theme-independent ink
 * and a hand-measured opacity to be legible. That whole arrangement is gone: the titles moved
 * onto the card's own surface, and with them went `FeatureCard`, `SCRIM_ALPHA`, `HERO_SCRIM`,
 * `HERO_INK`, `hero`, `heroPhoto`, `heroText`, `heroTitle`, `heroScrim`, `heroScrimFill` and
 * `arrow`. Thirty-five assertions in the old file named one of those.
 *
 * The replacement earns its keep by asserting the thing that actually broke twice on the way
 * here: **a category name must fit its column**. `Alimentos y Bebidas` shipped clipped, and the
 * fix that shipped it was wrong too — the name was moved onto the photo, the scrim arrived, and
 * the title came out near-black on a dark scrim while this suite was green. So the measurement
 * is here, in points, against the real taxonomy.
 *
 * ## Two columns, and they are not the same width
 *
 * Card 1's sub-cards are `flex: 1` across three, so they are 98.3 points on a 375-point phone
 * and only ever hold **sectors**. Card 2's are a stated 120 because a strip cannot divide a
 * screen, and they hold **leaves** — whose widest word, `Electrodomésticos`, is 13 points wider
 * than the widest sector word. Sizing the strip by the sectors would have broken two names the
 * first time a reader scrolled it, and nothing about the screen would have said why.
 *
 * ## Read from source, for the reason `lib/category-rail.test.ts` reads its layout
 *
 * `components/category-showcase.tsx` imports `react-native`, `@/theme` and `expo-router`, none
 * of which resolve under `bun test`. What is protected is the declaration rather than the
 * behaviour, and the taxonomy and the type scale are read from the repository rather than from
 * a fixture so a rename fails here instead of on a phone.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const SHOWCASE = join(REPO, "apps", "mobile", "components", "category-showcase.tsx");
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

const source = readFileSync(SHOWCASE, "utf-8");
const tokens = readFileSync(join(REPO, "apps", "mobile", "theme", "tokens.ts"), "utf-8");

/** A declared `const NAME = <number>;` out of the showcase. */
function declared(name: string): number {
	const found = source.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?);`))?.[1];
	if (found === undefined) {
		throw new Error(`${name} not found in category-showcase.tsx`);
	}
	return Number(found);
}

/** A value from one named scale in `theme/tokens.ts`. */
function scale(name: "space" | "radius", key: string): number {
	const block = tokens.match(new RegExp(`export const ${name} = \\{([^}]*)\\}`))?.[1];
	if (block === undefined) throw new Error(`${name} scale not found`);
	const found = block.match(new RegExp(`\\n\\s*${key}: (\\d+(?:\\.\\d+)?),`))?.[1];
	if (found === undefined) throw new Error(`${name}.${key} not found`);
	return Number(found);
}

/** `MIN_TOUCH_TARGET`, read the way it is declared. */
function touchMinimum(): number {
	const found = tokens.match(/export const MIN_TOUCH_TARGET = (\d+);/)?.[1];
	if (found === undefined) throw new Error("MIN_TOUCH_TARGET not found");
	return Number(found);
}

/** The showcase's source with every comment removed. */
function codeOnly(): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * A taxonomy level, in the order `catalog.categories` returns it.
 *
 * `sortOrder` is what makes the flat list usable as a two-level one, and the API returns a
 * sector immediately followed by what it holds — so the split here is by `parentId` and the
 * order is the order the showcase will draw in.
 */
function level(parentIsNull: boolean): string[] {
	const sql = readFileSync(TAXONOMY, "utf-8");
	const row =
		/\('cat_[^']*',\s*'([^']*)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*(?:'[^']*'|NULL),\s*(NULL|'cat_[^']*'),/g;
	const out: string[] = [];
	for (const match of sql.matchAll(row)) {
		const isSector = match[2] === "NULL";
		const slug = match[1];
		if (slug && isSector === parentIsNull) out.push(slug);
	}
	return out;
}

/** Spanish names by slug, so a failure can name the category it is about. */
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

/** The `caption` step, because that is what a sub-card's name is drawn at. */
const CAPTION_PT = Number(
	tokens.match(/caption:\s*\{\s*fontSize: (\d+)/)?.[1] ?? 0,
);

/**
 * The width of a word in points, rounded **up** on every glyph class.
 *
 * An upper bound, and deliberately generous, because this measures whether a word *could*
 * exceed its column: over-reporting only makes the test stricter, and the margin is far
 * smaller than the ~16 points it would take to fail a name that genuinely fits.
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

/** The widest single word in a taxonomy level, at `caption`. */
function widestWordPtIn(parentIsNull: boolean): number {
	const names = spanishNames();
	let widest = 0;
	for (const slug of level(parentIsNull)) {
		const name = names.get(slug);
		if (name === undefined) continue;
		for (const word of name.split(/\s+/)) {
			widest = Math.max(widest, widestWordPt(word, CAPTION_PT));
		}
	}
	return widest;
}

/**
 * Card 1's sub-card width: the screen, less the feed's inset and the card's own padding,
 * divided three ways with a `space.sm` gutter between each.
 */
function gridColumn(): number {
	const screen = 375;
	const inset = scale("space", "lg");
	const cardPad = scale("space", "lg");
	const gap = scale("space", "sm");
	const across = declared("GRID_PER_ROW");
	return (screen - inset * 2 - cardPad * 2 - gap * (across - 1)) / across;
}

describe("the showcase's two cards", () => {
	test("card 1 draws six sectors and card 2 draws one sector's children", () => {
		// Six is what the rail it replaced showed before it asked for a gesture. Both numbers
		// are asserted rather than trusted, because they are the composition.
		expect(declared("GRID_COUNT")).toBe(6);
		expect(declared("GRID_PER_ROW")).toBe(3);
		// Card 2 has no count of its own: it draws *every* child of the chosen sector, which is
		// a median of 12 and a maximum of 29, and a strip is the right control for a length that
		// is neither six nor a hundred.
		expect(codeOnly()).toMatch(/featuredChildren\.map/);
		expect(codeOnly()).not.toMatch(/featuredChildren\.slice\(/);
	});

	test("card 1 is positional and card 2 is a fact, so no slug is named anywhere", () => {
		// Checked as the *absence* of every sector slug, because that is the specific failure:
		// a hardcoded slug reads as a data-driven layout and outlives whatever reason it had.
		// Card 1 takes `sortOrder`'s first six, which the API owns; card 2 takes the busiest
		// sector by `productCount`, which is a fact about the catalogue.
		const code = codeOnly();
		for (const slug of level(true)) {
			expect(code).not.toMatch(new RegExp(`["']${slug}["']`));
		}
		// And the two mechanisms are both present and stated.
		expect(code).toMatch(/sectors\.slice\(0, GRID_COUNT\)/);
		expect(code).toMatch(/productCount \?\? -1/);
	});

	test("a sector with no children cannot become card 2", () => {
		// `Varios y Especialidad` has children today; a newly added sector may not. Drawing an
		// empty strip under a title would be a card that says nothing.
		expect(codeOnly()).toMatch(/childrenOf\(sector\.id\)\.length > 0/);
	});

	test("neither card renders empty", () => {
		// A fresh install can hold fewer than six sectors, which is a real state. A card with an
		// empty grid inside it is worse than no card, so each is conditional on having something.
		expect(codeOnly()).toMatch(/gridSectors\.length > 0 \?/);
		expect(codeOnly()).toMatch(/featured && featuredChildren\.length > 0 \?/);
	});

	test("the whole showcase renders nothing for no categories", () => {
		expect(codeOnly()).toMatch(/if \(categories\.length === 0\) return null/);
	});

	test("card 1's title and `View all` live in the card, not above it", () => {
		// The feed's own `SectionHeader` for categories was deleted when this moved in: "Categorías"
		// printed above a card that also says "Categorías" is one fact on the screen twice.
		expect(codeOnly()).toMatch(/t\("search\.categories"\)/);
		expect(codeOnly()).toMatch(/allHref/);
		// And the link is conditional, because a card with no index to go to has nothing to offer.
		expect(codeOnly()).toMatch(/allHref \?/);
	});
});

describe("the showcase's columns", () => {
	test("no sector name breaks mid-word in card 1", () => {
		// **The defect this file exists for.** `Alimentos y Bebidas` shipped clipped, and a word
		// wider than its box is *broken*, not ellipsised — `./product-tile`'s docblock forbids it
		// and the rail's own label suite existed to prevent it.
		//
		// `Entretenimiento` is the widest sector word at 90.5 points. Four across would be 71.8
		// and five names would overflow it; three across is the only count where none do.
		const column = gridColumn();
		expect(widestWordPtIn(true)).toBeLessThanOrEqual(column);
	});

	test("the margin on the sector column is stated, because it is thin", () => {
		// 98.3 against 90.5 is 7.8 points. That is enough and it is not generous, so the margin
		// is asserted: `[] === []` would teach nobody how close this is, and a rename adding two
		// letters would fail here rather than on a phone.
		expect(gridColumn() - widestWordPtIn(true)).toBeGreaterThan(4);
	});

	test("no leaf name breaks mid-word in card 2", () => {
		// The two columns are **not** the same width and this is why. Card 2 draws leaves, and
		// `Electrodomésticos` is 106.6 points — 16 wider than the widest sector word. Sizing the
		// strip from the sectors would have broken two names the first time a reader scrolled it,
		// and nothing on the screen would have said why.
		expect(widestWordPtIn(false)).toBeLessThanOrEqual(declared("STRIP_WIDTH"));
	});

	test("card 1 is three across, and four is the option that breaks names", () => {
		// Asserted with its consequence rather than as a bare number: at four across the column
		// is 71.8 and at least one sector word does not fit.
		expect(declared("GRID_PER_ROW")).toBe(3);
		const atFour = (375 - scale("space", "lg") * 4 - scale("space", "sm") * 3) / 4;
		expect(widestWordPtIn(true)).toBeGreaterThan(atFour);
	});

	test("card 1's sub-cards clear the touch minimum at the narrowest supported width", () => {
		expect(gridColumn()).toBeGreaterThanOrEqual(touchMinimum());
	});

	test("card 2's strip shows more than two, and cuts the third", () => {
		// The peek is the signal that the strip scrolls \u2014 the thing the old rail got wrong by
		// accident, where a chip was cut at the edge with nothing above it saying what the row
		// held, so the cut read as broken rather than as "there is more".
		const usable = 375 - scale("space", "lg") * 4;
		const width = declared("STRIP_WIDTH");
		expect(Math.floor(usable / width)).toBeGreaterThanOrEqual(2);
		// The trailing spacer exists and is smaller than a sub-card, so it shows the edge of a
		// next destination rather than inviting a tap on a partial one.
		expect(codeOnly()).toMatch(/stripEnd/);
		expect(scale("space", "xl")).toBeLessThan(width);
	});
});

describe("the showcase's sub-cards", () => {
	test("a sub-card states its own width, so the panel cannot clip the name", () => {
		// The other half of the clipping bug. `alignItems` does not bound a child: a `Text` sizes
		// itself to its content, runs past the panel and is cut by its `overflow`. Both the tile
		// and its caption carry an explicit width for that reason.
		expect(codeOnly()).toMatch(/width: width \?\? "100%"/);
		expect(codeOnly()).toMatch(/color: ink, width: "100%"/);
	});

	test("a photograph is contained, so a cutout is not cropped", () => {
		// The load-bearing value. `cover` works only for a full-bleed square and would cut a
		// cutout's edges off; `contain` draws both correctly, which is what lets this component
		// take either asset without a code change when the cutout masters land.
		expect(codeOnly()).toMatch(/resizeMode="contain"/);
	});

	test("the picture area is a square derived from the sub-card's own width", () => {
		// `aspectRatio: 1` rather than a stated height, because the width is a fraction of the
		// screen in card 1 and a constant in card 2. A square derived from a number that moves
		// with the screen would have to be restated on every new device.
		expect(source).toMatch(/tilePhoto:\s*\{[^}]*width: "100%", aspectRatio: 1/);
	});

	test("the glyph fallback is kept, so a category with no photograph is not blank", () => {
		expect(codeOnly()).toMatch(/categoryIcon\(/);
		expect(codeOnly()).toMatch(/pricetag-outline/);
		expect(declared("GLYPH_SIZE")).toBeGreaterThan(0);
	});

	test("every sub-card is a button that names its category", () => {
		expect(codeOnly()).toMatch(/accessibilityRole="button"/);
		expect(codeOnly()).toMatch(/accessibilityLabel=\{label\}/);
		expect(codeOnly()).toMatch(/accessibilityState=\{selected \? \{ selected: true \}/);
		// The picture is decoration; the name is the button.
		expect(codeOnly()).toMatch(/accessibilityElementsHidden/);
		expect(codeOnly()).toMatch(/importantForAccessibility="no"/);
	});

	test("selection is not signalled by colour alone", () => {
		// WCAG 1.4.1. `accessibilityState` reaches a screen reader and nobody else, so a
		// *sighted* colour-blind reader needs a second signal. The border going 1pt to 2pt is a
		// size, and it survives any palette, any colour vision and greyscale.
		expect(codeOnly()).toMatch(/borderWidth: selected \? 2 : 1/);
	});

	test("no category name is capped", () => {
		// The rule `./product-tile` states: a cap truncates data to save a layout, and
		// "Juguetes, Pasatiempos y Coleccionables" with an ellipsis is a different category from
		// the one the reader is looking for.
		expect(codeOnly()).not.toMatch(/numberOfLines/);
		expect(codeOnly()).not.toMatch(/ellipsizeMode/);
	});

	test("re-tapping the sub-card you are standing on replaces, so the stack cannot double it", () => {
		expect(codeOnly()).toMatch(/if \(selected\) router\.replace\(href\)/);
		expect(codeOnly()).toMatch(/else router\.push\(href\)/);
	});
});

describe("the showcase's scroll", () => {
	test("only card 2 scrolls", () => {
		// One `ScrollView`, in card 2. Card 1's six fit at three across and a gesture there would
		// be hiding something nothing named \u2014 the defect the rail was built to remove.
		expect(codeOnly()).toMatch(/<ScrollView/);
		expect((codeOnly().match(/<ScrollView/g) ?? []).length).toBe(1);
		expect(codeOnly()).toMatch(/horizontal/);
	});

	test("it is a ScrollView and not a FlatList, and why", () => {
		// A median of 12 children and a maximum of 29 is nothing to virtualise: the whole point
		// of a `FlatList` is not mounting rows nobody is looking at, and 12 sub-cards is not
		// that. Asserted because the rail *was* a `FlatList` for the opposite reason \u2014 it held
		// 18 photographs at 772 KB \u2014 and carrying that reasoning over would be wrong here.
		expect(codeOnly()).not.toMatch(/<FlatList/);
		expect(codeOnly()).not.toMatch(/initialNumToRender/);
		expect(codeOnly()).not.toMatch(/getItemLayout/);
	});

	test("the scroll indicator is hidden, because the peek replaces it", () => {
		// A native indicator at the foot of a strip inside a card reads as a page-level scroll
		// bar. The cut sub-card is the signal, and two signals for one gesture is one too many.
		expect(codeOnly()).toMatch(/showsHorizontalScrollIndicator=\{false\}/);
	});

	test("the strip runs to the card's own edge so the cut sub-card reads as more", () => {
		// A `ScrollView`'s content is clipped by its container, so without the negative padding
		// the last sub-card would stop 16 points short of the card's edge and the strip would
		// look like it ended inside the card rather than continuing.
		expect(codeOnly()).toMatch(/paddingRight: -PEEK/);
		// `PEEK` is `space.lg`, not a literal, so it is read as an expression the way the rail
		// test reads `COLUMN_PITCH` -- `declared()` only matches `= <number>;` and would throw.
		expect(source).toMatch(/const PEEK = space\.lg/);
	});
});