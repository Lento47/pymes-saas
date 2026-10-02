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

	test("the box is a rounded square, not a disc", () => {
		// `radius.full` on a square is a circle, and the curve threw away about a third of a
		// 60pt box's area — corner a 20pt glyph never touches. `radius.md` is `./card`'s own
		// corner, so the rail is the same kind of surface as the storefront card beside it.
		expect(source).toMatch(/tileBox:\s*\{[^}]*borderRadius:\s*radius\.md/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.full/);
	});

	test("a category photograph takes the box's corner, not a circle", () => {
		// `radiusToken="full"` anywhere here would clip a picture to a disc inside a rounded
		// square — the shape the box just stopped being, drawn again one layer down. And it
		// would be invisible today: `image_url` is null on all 242 category rows.
		expect(codeOnly()).not.toMatch(/radiusToken="full"/);
		expect(source).toMatch(/radiusToken="md"/);
	});

	test("the tile is one number, not a box beside a label column", () => {
		// They were split because widening the tile to fit a word also widened the disc. With
		// no label there is nothing to fit, so a second constant would be two numbers that now
		// say the same thing.
		expect(declared("TILE_SIZE")).toBe(60);
		expect(codeOnly()).not.toMatch(/const TILE_WIDTH/);
		expect(codeOnly()).not.toMatch(/const TILE_BOX_SIZE/);
		expect(codeOnly()).not.toMatch(/tileLabel/);
	});

	test("five tiles are visible across a 390pt screen again", () => {
		// The cost of the labels, now paid back. Five is what the rail showed before the name
		// column existed, so this asserts the round trip rather than the number alone.
		const screen = 390;
		const insets = 16 * 2;
		const gap = 8;
		const visible = Math.floor(
			(screen - insets + gap) / (declared("TILE_SIZE") + gap),
		);
		expect(visible).toBe(5);
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
		// A 60pt mark clears `MIN_TOUCH_TARGET` (44) by itself, but the pressable is what a
		// finger actually lands on and it must not shrink below the platform floor.
		expect(source).toMatch(
			/tile:\s*\{[\s\S]{0,80}?minHeight:\s*MIN_TOUCH_TARGET/,
		);
	});
});
