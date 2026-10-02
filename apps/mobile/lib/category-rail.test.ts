import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rail is a strip of marks, and this is what holds it to that.
 *
 * ## The label suite that used to live here
 *
 * There were seven tests measuring Spanish sector names against a text column, because the
 * rail drew `Decoración` as `Decoració / n` — a word wider than its box is not ellipsised, it
 * is *broken*. The fix was a 108pt column wide enough for `Entretenimiento` (~98pt), and it
 * cost the rail its density: three tiles across, ragged one-and-two-line bottoms, for a strip
 * whose job is being scanned in one pass.
 *
 * The names came off. So there is no text to measure and those seven have nothing left to
 * assert — which is worth saying here rather than leaving a reader to wonder whether the
 * taxonomy was forgotten. The mid-word break cannot happen with no text, and
 * "a tile draws a mark and nothing else" is what now prevents it coming back by accident.
 *
 * ## What this file does hold
 *
 * The mark's size and corner, the gap, and the one thing that must survive the label's
 * removal: the category's name. It is on `accessibilityLabel` and nowhere else visible, so it
 * is load-bearing rather than decorative, and the glyph stays out of the tree so it is not
 * announced twice.
 *
 * ## Read from source, for the reason `lib/tab-bar-coverage.test.ts` reads its layout
 *
 * `components/category-rail.tsx` imports `react-native`, `@/theme` and `expo-router`, none of
 * which resolve under `bun test`. What is protected is the declaration, not behaviour.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const RAIL = join(REPO, "apps", "mobile", "components", "category-rail.tsx");

const source = readFileSync(RAIL, "utf-8");
const tokens = readFileSync(
	join(REPO, "apps", "mobile", "theme", "tokens.ts"),
	"utf-8",
);

/** A declared `const NAME = <number>;` out of the rail. */
function declared(name: string): number {
	const found = source.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?);`));
	if (found?.[1] === undefined) {
		throw new Error(`${name} not found in category-rail.tsx`);
	}
	return Number(found[1]);
}

/**
 * A value from one named scale in `theme/tokens.ts`.
 *
 * **Scoped to the scale, and it has to be.** `tokens.ts` declares `sm` more than once:
 * `radius.sm` is 6 and `space.sm` is 8. A helper matching the first `\n sm: (\d+),` in the file
 * returned 6 for a question about *spacing*, so an assertion that "the gap is 8" was answering
 * a different question and passing anyway. The scale is named, its block is extracted, and the
 * key is read from inside it.
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

/**
 * `MIN_TOUCH_TARGET`, read the way it is declared.
 *
 * Not through `token`: that matches an object key (`space.xs`, `icon.action`), and this one is
 * an exported const with an `=`. Two shapes for two kinds of token, both read from
 * `theme/tokens.ts` so neither can go stale against what the theme actually says.
 */
function minTouchTarget(): number {
	const found = tokens.match(/export const MIN_TOUCH_TARGET = (\d+);/);
	if (found?.[1] === undefined) throw new Error("MIN_TOUCH_TARGET not found");
	return Number(found[1]);
}

/**
 * The glyph's size, following the `icon.*` name the rail actually uses.
 *
 * The name is read rather than the number, and the number is read rather than restated: a
 * literal `24` here would keep passing the day someone swapped `icon.back` for something
 * else, which is the trap this file walked into when the tile count was asserted against a
 * hardcoded gap.
 */
function glyphSize(): number {
	const name = source.match(/size=\{icon\.(\w+)\}/)?.[1];
	if (name === undefined) throw new Error("glyph size reference not found");
	return scale("icon", name);
}

/**
 * How much of the tile the mark occupies — the number the sizing decision turns on, and the
 * one that regressed silently when the box shrank to 44 while the glyph stayed at 20.
 */
function fillRatio(): number {
	return glyphSize() / declared("DISC_SIZE");
}

/**
 * The rail's source with every comment removed.
 *
 * Not tidiness. This file's own docblocks explain these rules in prose and therefore *contain
 * the words* `numberOfLines`, `radius.full` and `TILE_WIDTH`; a naive grep over the source
 * fails on the explanation of the thing it is checking. Only code is evidence.
 */
function codeOnly(): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the category rail's marks", () => {
	test("a tile draws a mark and nothing else", () => {
		// The decision this file exists to hold. `<Text>` in this file *was* the label, and its
		// absence is what took the rail from three cramped titled tiles to a strip that can be
		// scanned at all.
		expect(codeOnly()).not.toMatch(/<Text/);
	});

	test("the name still reaches a screen reader", () => {
		// Load-bearing, not redundant, now that the name is nowhere visible. It is the only
		// place the category is identified for a screen reader, and the glyph is hidden from
		// the tree — so if this prop went, the tile would announce as an unlabelled button,
		// which is the whole information loss the label was preventing.
		expect(source).toMatch(/accessibilityLabel=\{label\}/);
		expect(source).toMatch(/accessibilityRole="button"/);
	});

	test("the glyph stays out of the accessibility tree", () => {
		// With no label to duplicate, an unhidden glyph would make the same category announced
		// twice on some platforms.
		expect(codeOnly()).toMatch(/accessibilityElementsHidden/);
		expect(codeOnly()).toMatch(/importantForAccessibility="no"/);
	});

	test("the mark and its box grew together, so the padding inside did not shrink", () => {
		// Box 64, glyph `icon.back` (24). Growing the glyph alone would have been the wrong half
		// of that change — it would have taken the padding inside the tile from 20pt to 18 and
		// made the mark look *more* cramped, which is the opposite of the ask. So what is asserted
		// is the pair and the two numbers derived from it, rather than one frozen size.
		expect(declared("DISC_SIZE")).toBe(64);
		expect(source).toMatch(/size=\{icon\.back\}/);
		expect(codeOnly()).not.toMatch(/size=\{icon\.action\}/);
		expect(glyphSize()).toBe(24);
		// 20pt of breathing room on every side of the glyph.
		expect((declared("DISC_SIZE") - glyphSize()) / 2).toBe(20);
		// And the fill is past the third that read as a speck.
		expect(fillRatio()).toBeGreaterThan(1 / 3);
	});

	test("the box is not smaller than the touch target", () => {
		// 64 clears `MIN_TOUCH_TARGET` (44) with room to spare, and the mark is now the whole
		// tile, so this is the size a finger lands on.
		expect(declared("DISC_SIZE")).toBeGreaterThanOrEqual(minTouchTarget());
	});

	test("the box is squared-rounded, not a disc", () => {
		// `radius.full` on a square is a circle, and the curve throws away corners a glyph never
		// uses. `radius.sm` is 6pt — 10% of a 60pt box, which reads as a square with softened
		// corners. `radius.md` would be 20% here and starts to read as a lozenge.
		expect(source).toMatch(/tileBox:\s*\{[^}]*borderRadius:\s*radius\.sm/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.full/);
		expect(codeOnly()).not.toMatch(/borderRadius:\s*radius\.md/);
		expect(scale("radius", "sm")).toBe(6);
	});

	test("a category photograph takes the box's corner, not a circle", () => {
		// `radiusToken="full"` would clip a picture to a disc inside a squared box — the shape
		// the tile is not, drawn again one layer down. Invisible today: `image_url` is null on
		// all 242 category rows, so the branch is only ever exercised by a future upload.
		expect(codeOnly()).not.toMatch(/radiusToken="full"/);
		expect(source).toMatch(/radiusToken="sm"/);
	});

	test("the gap between tiles leaves a rejection zone between neighbours", () => {
		// `space.md` (12). This number has been fought over three times in this file: 8 to 4 for
		// density, back to 8 because two targets 4pt apart have no dead zone between them, and now
		// 12 because the tiles grew and gained a border — a row of *defined* shapes needs more air
		// than a row of tints did. WCAG 2.5.8 passed at all three, because that guideline is about
		// target *size*; mis-taps come from the gutter.
		expect(declaredGap()).toBe(12);
		expect(declaredGap()).toBe(scale("space", "md"));
	});

	test("tiles land on tile boundaries when the rail is flung", () => {
		// Without this, momentum stops wherever the fling ends and can leave a tile cut at the
		// edge. Invisible in a screenshot — which is why six rounds of tuning, all of which
		// happened through screenshots, missed it.
		//
		// The interval must be the tile *and its gap*, or the rail snaps to a grid that is not
		// the one it draws. That was a real bug introduced alongside the gap change: the gap went
		// to `space.sm` while the snap stayed on `space.xs`, so the rail was snapping 4pt off its
		// own layout and a settled tile never lined up with a drawn one.
		const interval = source.match(
			/snapToInterval=\{DISC_SIZE \+ space\.(\w+)\}/,
		)?.[1];
		if (interval === undefined) throw new Error("snap interval not found");
		expect(scale("space", interval)).toBe(declaredGap());
		expect(declared("DISC_SIZE") + scale("space", interval)).toBe(76);
	});

	test("five tiles are visible, and that is the floor this rail goes no lower", () => {
		// A floor rather than a count, because it is the thing worth protecting: every tightening
		// of this rail has cost a tile, and a category rail showing four is one nobody browses.
		const visible = Math.floor(
			(412 - declaredPadding() * 2 + declaredGap()) /
				(declared("DISC_SIZE") + declaredGap()),
		);
		expect(visible).toBe(5);
	});

	test("the tile has an edge, so it reads as an object rather than a tint", () => {
		// With no label, this boundary is the only thing binding the glyph into something
		// pressable. `accent` on the card is a 2-3% luminance step — detectable, but not enough
		// to *group*, so the glyph floats in a smudge. A border fixes that on every palette,
		// where darkening `accent` would have to be redone per theme.
		expect(source).toMatch(/borderWidth: selected \? 2 : 1/);
		expect(source).toMatch(/borderColor: selected/);
		expect(codeOnly()).toMatch(/colors\.border/);
	});

	test("selection is not signalled by colour alone", () => {
		// WCAG 1.4.1. The label used to go `bold` as well as filling, so the selection was never
		// colour-only; the label went and took the second signal with it. `accessibilityState`
		// reaches a screen reader and nobody else, so a *sighted* colour-blind reader was left
		// with nothing. The scale is the signal, because a size is unambiguous and survives any
		// palette, any colour vision, and greyscale.
		expect(codeOnly()).toMatch(
			/transform: selected \? \[\{ scale: SELECTED_SCALE \}\]/,
		);
		expect(declared("SELECTED_SCALE")).toBeGreaterThan(1);
	});

	test("two selected neighbours cannot touch", () => {
		// The scale grows the tile by `SELECTED_SCALE`, and the gap is what absorbs it. Checked
		// rather than assumed: at 1.06 this would have eaten more than half the gutter.
		const grown = declared("DISC_SIZE") * declared("SELECTED_SCALE");
		expect(grown - declared("DISC_SIZE")).toBeLessThan(declaredGap());
	});

	test("the tiles touch neither the screen edge nor each other", () => {
		// The two ways "less space" goes wrong. A zero gap welds the marks into one shape the
		// reader cannot pull apart, and an inset of zero puts the first tile flush against a
		// rounded screen corner.
		expect(declaredGap()).toBeGreaterThan(0);
		expect(declaredPadding()).toBeGreaterThanOrEqual(declaredGap());
	});

	test("five tiles are in frame and a sixth is cut, and the cut one is the point", () => {
		// A tile cut at the edge is information scent: it is how a reader knows the row scrolls
		// and that five squares are not the whole catalogue. That scent used to be a free
		// remainder and stopped being one — at 64 with a 12pt gap, five tiles plus two 16pt
		// insets is *exactly* 412 on the device this was checked on, so the rail ended flush and
		// looked complete. Hence the trailing spacer, which is asserted here rather than left to
		// an arithmetic accident that holds on one phone and not the next.
		const visible = Math.floor(
			(412 - declaredPadding() * 2 + declaredGap()) /
				(declared("DISC_SIZE") + declaredGap()),
		);
		const remainder =
			412 -
			declaredPadding() * 2 -
			visible * (declared("DISC_SIZE") + declaredGap());
		expect(visible).toBe(5);
		expect(remainder).toBe(0); // the accident this spacer exists to defeat
		expect(spacerWidth()).toBeGreaterThan(remainder);
		// Enough to show the edge of a sixth, not enough to invite a tap on a partial target.
		expect(spacerWidth()).toBeLessThan(declared("DISC_SIZE"));
	});
});

/** The rail's `gap`, following the `space.*` name the rail uses. */
function declaredGap(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const name = rail.match(/gap:\s*space\.(\w+)/)?.[1];
	if (name === undefined) throw new Error("rail gap not found");
	return scale("space", name);
}

/** The rail's horizontal inset, the same way. */
function declaredPadding(): number {
	const rail = source.match(/rail:\s*\{[^}]*\}/)?.[0] ?? "";
	const name = rail.match(/paddingHorizontal:\s*space\.(\w+)/)?.[1];
	if (name === undefined) throw new Error("rail paddingHorizontal not found");
	return scale("space", name);
}

/**
 * The trailing spacer, read off `railEnd`.
 *
 * It is the deliberate peek that guarantees a cut tile in frame. Asserted as a width rather
 * than as a rendered margin, because it is a layout decision and nothing about it is a visual.
 */
function spacerWidth(): number {
	const entry = source.match(/railEnd:\s*\{\s*width:\s*space\.(\w+)/)?.[1];
	if (entry === undefined) throw new Error("railEnd spacer not found");
	return scale("space", entry);
}
