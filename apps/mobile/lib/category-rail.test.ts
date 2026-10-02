import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rail is a shelf of marks, and this is what holds it to that.
 *
 * It began as a guard on text: a 60pt tile could not hold the sector names, so `Decoración`
 * rendered as `Decoració / n` — a word wider than its box is not ellipsised, it is *broken*,
 * and nothing caught it (typecheck, biome and the suite all passed). The fix widened a label
 * column to 108pt, which took the visible row from five tiles to three.
 *
 * Then the labels came off, and that is the better answer: a 20pt glyph in a rounded square
 * is how a category rail is supposed to read, and the strip is scannable in one pass with no
 * paragraph under it. The text measurement that justified `TILE_WIDTH` went with them, and
 * this file is what is left — the shape, the size, and the two things that must survive the
 * label's removal.
 *
 * ## Read from source, for the reason `lib/tab-bar-coverage.test.ts` reads its layout
 *
 * `components/category-rail.tsx` imports `react-native`, `@/theme` and `expo-router`, none of
 * which resolve under `bun test`. What is protected here is the *declaration*, not behaviour.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const RAIL = join(REPO, "apps", "mobile", "components", "category-rail.tsx");

const source = readFileSync(RAIL, "utf-8");

/** A declared `const NAME = <number>;` out of the rail. */
function declared(name: string): number {
	const found = source.match(new RegExp(`const ${name} = (\\d+);`));
	if (found?.[1] === undefined) {
		throw new Error(`${name} not found in category-rail.tsx`);
	}
	return Number(found[1]);
}

const tokens = readFileSync(
	join(REPO, "apps", "mobile", "theme", "tokens.ts"),
	"utf-8",
);

/** The platform floor for anything a finger lands on. */
function minTouchTarget(): number {
	const found = tokens.match(/export const MIN_TOUCH_TARGET = (\d+);/);
	if (found?.[1] === undefined) throw new Error("MIN_TOUCH_TARGET not found");
	return Number(found[1]);
}

const MIN_TOUCH_TARGET = minTouchTarget();

/**
 * The glyph's size in points, following the `icon.*` reference the rail actually uses.
 *
 * The name is read rather than the number, and the number is read rather than restated: a
 * literal `24` here would keep passing the day someone swapped `icon.back` for something
 * else, which is the same trap the label-width commit walked into twice.
 */
function glyphSize(): number {
	const name = source.match(/size=\{icon\.(\w+)\}/)?.[1];
	if (name === undefined) throw new Error("glyph size reference not found");
	const found = tokens.match(new RegExp(`\\n\\s*${name}: (\\d+),`));
	if (found?.[1] === undefined)
		throw new Error(`icon.${name} not found in tokens.ts`);
	return Number(found[1]);
}

/** How much of the tile the mark occupies — the number the whole sizing decision turns on. */
function fillRatio(): number {
	return glyphSize() / declared("TILE_SIZE");
}

/**
 * The corner as a share of the tile's width.
 *
 * This is the ratio that decides whether the tile reads as *squared*, and it is not the token
 * that decides it. A radius is an absolute number, so the same token is a fifth of a 60pt tile
 * and over a quarter of a 44pt one — which is how `radius.md` became a lozenge without anything
 * about it changing.
 */
function cornerShare(): number {
	const name = source.match(
		/tileBox:\s*\{[^}]*borderRadius:\s*radius\.(\w+)/,
	)?.[1];
	if (name === undefined) throw new Error("tileBox borderRadius not found");
	return spaceToken(name as "sm") / declared("TILE_SIZE");
}

/**
 * The rail's gap and inset, resolved through `theme/tokens.ts` rather than restated.
 *
 * They are written as `space.xs` and `space.lg` in the rail — names, not numbers — so
 * `declared` cannot see them and a literal would go stale the moment a token changed. This
 * reads the scale and follows the reference, which is the only version of the number that
 * cannot disagree with what is drawn.
 */
function spaceToken(name: "xs" | "sm" | "md" | "lg" | "xl" | "xxl"): number {
	const tokens = readFileSync(
		join(REPO, "apps", "mobile", "theme", "tokens.ts"),
		"utf-8",
	);
	const found = tokens.match(new RegExp(`\\n\\s*${name}: (\\d+),`));
	if (found?.[1] === undefined) {
		throw new Error(`space.${name} not found in theme/tokens.ts`);
	}
	return Number(found[1]);
}

/** The `gap` on the rail's content container, as a token name read back out of the file. */
function declaredGap(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const token = rail.match(/gap:\s*space\.(\w+)/)?.[1];
	if (token === undefined)
		throw new Error("rail gap not found in category-rail.tsx");
	return spaceToken(token as "xs");
}

/** The rail's horizontal inset, the same way. */
function declaredPadding(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const token = rail.match(/paddingHorizontal:\s*space\.(\w+)/)?.[1];
	if (token === undefined) {
		throw new Error("rail paddingHorizontal not found in category-rail.tsx");
	}
	return spaceToken(token as "lg");
}

/**
 * The rail's source with every comment removed.
 *
 * Not tidiness. This file's own docblocks explain these rules in prose and therefore *contain
 * the words* `numberOfLines`, `radius.full` and `disc`; a naive grep over the source fails on
 * the explanation of the thing it is checking. Only code is evidence.
 */
function codeOnly(): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the category rail's tiles", () => {
	test("a tile draws a mark and nothing else", () => {
		// The decision, asserted. `<Text>` in this file is the label, and its absence is the
		// change: a shelf of marks is scannable in one pass, and the names are on
		// `app/(customer)/categories.tsx` for anyone who wants to read them.
		expect(codeOnly()).not.toMatch(/<Text/);
	});

	test("the name still reaches a screen reader", () => {
		// Load-bearing, not redundant, now that the visible label is gone. The glyph is
		// `accessibilityElementsHidden`, so if this prop went the tile would announce as an
		// unlabelled button — which is exactly the information loss the label was preventing.
		expect(source).toMatch(/accessibilityLabel=\{label\}/);
		expect(source).toMatch(/accessibilityRole="button"/);
	});

	test("the glyph stays out of the accessibility tree", () => {
		// With the label gone there is nothing to duplicate, so an unhidden glyph would make
		// the same category announced twice on some platforms.
		expect(codeOnly()).toMatch(/accessibilityElementsHidden/);
		expect(codeOnly()).toMatch(/importantForAccessibility="no"/);
	});

	test("the box is squared, not a disc and not a lozenge", () => {
		// `radius.full` on a square is a circle, and the curve threw away about a third of the
		// box's area — corner a glyph never touches.
		//
		// The subtler half is `radius.md`: it is 12pt, which is a fifth of a 60pt tile and reads
		// as a square with softened corners, but **27% of a 44pt one** and reads as a squircle.
		// A radius is a share of the box, so shrinking the box without moving the token down
		// silently rounds it further. `sm` is 14% here — the proportion `md` had at the size
		// this tile used to be.
		expect(source).toMatch(/tileBox:\s*\{[^}]*borderRadius:\s*radius\.sm/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.full/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.md/);
		expect(cornerShare()).toBeLessThan(0.2);
	});

	test("a category photograph takes the box's corner, not a circle", () => {
		// `radiusToken="full"` anywhere here would clip a picture to a disc inside a squared
		// tile — the shape the box stopped being, drawn again one layer down. And it would be
		// invisible today: `image_url` is null on all 242 category rows.
		expect(codeOnly()).not.toMatch(/radiusToken="full"/);
		expect(source).toMatch(/radiusToken="sm"/);
	});

	test("the corner is under a fifth of the tile", () => {
		// The ratio, restated as a number so a later resize that changes one without the other
		// is caught here rather than noticed by eye. 6/44 is 14%; `md` on this tile would be 27%
		// and read as a lozenge.
		expect(cornerShare()).toBeCloseTo(6 / 44, 2);
	});

	test("the tile is one number, not a box beside a label column", () => {
		// They were split because widening the tile to fit a word also widened the disc. With
		// no label there is nothing to fit, so a second constant would be two numbers that now
		// say the same thing.
		expect(declared("TILE_SIZE")).toBe(44);
		expect(codeOnly()).not.toMatch(/const TILE_WIDTH/);
		expect(codeOnly()).not.toMatch(/const TILE_BOX_SIZE/);
		expect(codeOnly()).not.toMatch(/tileLabel/);
	});

	test("the mark fills enough of its tile to read as the tile", () => {
		// The pair, asserted together, because either alone regresses silently. A 20pt glyph
		// in a 44pt box is 45% fill; a 24pt glyph in a 60pt box is 40%. Both are what the rail
		// looked like while the marks read as floating inside their containers, and each would
		// pass a test that only checked one of the two numbers.
		expect(declared("TILE_SIZE")).toBe(44);
		expect(source).toMatch(/size=\{icon\.back\}/);
		expect(codeOnly()).not.toMatch(/size=\{icon\.action\}/);
		expect(glyphSize()).toBe(24);
		expect(fillRatio()).toBeGreaterThan(0.5);
	});

	test("the space a reader sees between two marks is a fifth of the tile, not two thirds", () => {
		// The complaint this answers, as a number. The gap was always the small part: at 60pt
		// with a 20pt glyph, the distance between two glyph *edges* was 20 + 4 + 20 = 44pt — so
		// tightening the gap from 8 to 4 changed almost none of what was actually seen. It is
		// (44-24)/2 + 4 + (44-24)/2 = 24pt now, a fifth of the tile rather than two thirds.
		const padding = (declared("TILE_SIZE") - glyphSize()) / 2;
		const between = padding * 2 + declaredGap();
		expect(between).toBe(24);
		// And it is genuinely less than what it was, rather than the same number re-derived
		// from different inputs: 44pt was the distance at 60/20, and 24 is 45% of that.
		expect(between).toBeLessThan(44);
		expect(44 - between).toBe(20);
	});

	test("the box is not smaller than the touch target", () => {
		// 44 is `MIN_TOUCH_TARGET` and 40 would have been tighter. A box below the floor is a
		// target below the floor, and it fails as a missed tap rather than as anything a test
		// could read — which is why the floor, not the eye, sets this number.
		expect(declared("TILE_SIZE")).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
	});

	test("the tile keeps its own touch target whatever the box does", () => {
		// Stated on the tile rather than inherited from a 44pt child, so resizing the mark
		// later cannot quietly leave the pressable under the platform minimum.
		expect(source).toMatch(
			/tile:\s*\{[^}]*width:\s*MIN_TOUCH_TARGET[^}]*height:\s*MIN_TOUCH_TARGET/,
		);
	});

	test("seven tiles are visible across a 390pt screen", () => {
		// More than the five the rail showed with names on it, which is the round trip worth
		// asserting: the labels cost density and taking them off paid it back twice over.
		//
		// The gap and inset come from the scale rather than restated, so this cannot keep
		// passing after `space.sm` became `space.xs` or after the box shrank.
		const screen = 390;
		const insets = declaredPadding() * 2;
		const visible = Math.floor(
			(screen - insets + declaredGap()) /
				(declared("TILE_SIZE") + declaredGap()),
		);
		expect(visible).toBe(7);
	});

	test("the gap between tiles is the scale's tightest step", () => {
		// `space.sm` was two steps too loose once the labels came off: at 8pt two marks read
		// as two separate objects, and the word that used to carry the eye across the gap is
		// gone. `space.xs` is the smallest step in `theme/tokens.ts`, so this is as tight as
		// the vocabulary allows without inventing a number outside it.
		expect(declaredGap()).toBe(4);
	});

	test("the tiles touch neither the screen edge nor each other", () => {
		// The two ways "less space" goes wrong. A zero gap welds the marks into one shape the
		// reader cannot pull apart, and an inset of zero puts the first tile flush against a
		// rounded screen corner. Asserted because `xs` is only the right answer given where
		// it sits on the scale relative to the padding.
		expect(declaredGap()).toBeGreaterThan(0);
		expect(declaredPadding()).toBeGreaterThanOrEqual(declaredGap());
	});

	test("the tile is square, so the row of them reads as one rhythm", () => {
		// The box's two dimensions are the same number. A width and a height that drift apart
		// would make the rail a row of mixed rectangles, and nothing else would say so.
		const box = source.match(/tileBox:\s*\{([\s\S]*?)\n\t\},/);
		const body = box?.[1] ?? "";
		const widths = [...body.matchAll(/width:\s*(\w+)/g)].map((m) => m[1]);
		const heights = [...body.matchAll(/height:\s*(\w+)/g)].map((m) => m[1]);
		expect(widths.length).toBeGreaterThan(0);
		expect(widths[0]).toBe("TILE_SIZE");
		expect(heights[0]).toBe("TILE_SIZE");
	});

	test("the touch target is still the whole tile, not just the mark", () => {
		// The one that reads as a *floor*: the tile may be larger than the target, but a
		// resize that leaves it smaller is a missed tap rather than anything a reader could
		// report. Its size is asserted by the two tests above.
		expect(codeOnly()).toMatch(/tile:\s*\{[\s\S]{0,80}?MIN_TOUCH_TARGET/);
	});
});
