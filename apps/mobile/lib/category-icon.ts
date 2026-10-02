import Ionicons from "@expo/vector-icons/Ionicons";

/**
 * The glyph a category gets, and the reason this is a lookup rather than a cast.
 *
 * `Category.iconName` is a **bare string from the database** — an admin types it into a
 * free-text field (`apps/web/components/admin/category-dialog.tsx`) — so a name this app
 * cannot draw is a thing that reaches a screen, not a hypothetical. `@expo/vector-icons`
 * renders an unknown name as a **tofu box** rather than as nothing, so all six seeded
 * categories drew a `?` where the glyph belongs: not a blank space, a visible defect.
 *
 * `Ionicons.glyphMap` is the authority on what this app can draw, and it is asked here rather
 * than trusted from the server, because the server cannot know which icon package a client
 * installed.
 *
 * ## Why it is a module and not a line in the chip
 *
 * It lived inside `components/category-rail.tsx`'s `Chip` while the rail was the only surface
 * that drew a category. `app/categories` draws the same glyph for the same rows, and the choice
 * was between a second copy of this lookup — which is the copy that gets the `hasOwn` and not
 * the `in`, or the `__DEV__` warning and not both — and one file both surfaces read. Two
 * copies of a guard are two chances to draw the box, and the box is what the guard exists to
 * prevent.
 */

/**
 * The glyph a category falls back to when the name it was given is not one Ionicons has.
 *
 * It is `pricetag-sharp` — the shape a marketplace uses for "a thing being sold" — which is
 * the same glyph a caller's `?? FALLBACK_CATEGORY_ICON` applies to a *missing* name. The
 * difference this constant makes is the other case: a name that is present but wrong.
 */
export const FALLBACK_CATEGORY_ICON = "pricetag-sharp";

/** The line-art suffix Ionicons gives 421 of its 1357 glyphs. */
const OUTLINE_SUFFIX = "-outline";

/** The heavier stroke of the same drawing. Ionicons ships no filled family — see below. */
const SHARP_SUFFIX = "-sharp";

/**
 * Ionicons' heavier variant of a glyph name.
 *
 * ## Why this exists, and what it is not
 *
 * Ionicons has exactly two families: 421 `-outline` and 421 `-sharp`, and **no filled set**.
 * Every outline glyph has a sharp twin — every one, which is what makes this a total mapping
 * rather than a lookup with fallbacks in it — so `-sharp` is not a *different* drawing of a
 * price tag, it is the same drawing with more weight behind it. That is a legibility change at
 * `icon.action` (20pt inside a 60pt disc), not a change of style.
 *
 * Anyone reading "not flat" into this should know it cannot deliver that. Ionicons is a line
 * set; a solid shape would be a different icon set entirely (`@expo/vector-icons` bundles
 * thirteen more, several with real filled variants, all already installed) or a photograph via
 * `Category.imageUrl` — the branch `./category-rail`'s tile already draws, unused by all 242
 * rows today. Both are larger decisions than a weight change.
 *
 * ## Why it is derived here and not migrated in the database
 *
 * Because the mapping is total, so it needs no data change at all: the 242 rows keep whatever
 * an admin typed, and this turns each into the heavier glyph on the way to the screen. A
 * migration would have to touch every row *and* would stop applying the moment somebody added
 * a category — at which point `categoryIcon` would be the only thing still holding the weight.
 *
 * The fallback moves with it. 224 of the 242 rows have `icon_name` set to `NULL` and were
 * drawing `pricetag-outline`, so leaving the fallback alone would have drawn the heaviest
 * weight for a real icon and the lightest for every category that never picked one.
 */
function sharper(name: string): string {
	if (!name.endsWith(OUTLINE_SUFFIX)) return name;
	return `${name.slice(0, -OUTLINE_SUFFIX.length)}${SHARP_SUFFIX}`;
}

/** An Ionicons name this build can actually draw. */
export type CategoryIconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * `iconName` from the API, resolved to a name this build has a glyph for.
 *
 * `null` and `undefined` are the caller's `??` cases and land on the fallback without a
 * warning — a category with no icon is a valid row, not a content problem.
 *
 * `hasOwn` and not `in`: `in` walks the prototype chain, so `"constructor"`, `"toString"` and
 * the rest of `Object.prototype` satisfied the guard this replaced, skipped the warning below
 * and went on to be drawn as icon names — the guard answering "known" for names the set has
 * never held. The question here is what the glyph map *has*, which is the whole difference
 * between the two operators.
 *
 * The fallback is silent to a customer on purpose — a tile is not the place to report a content
 * problem — and that silence is the risk it carries, because a name that is *misspelled* now
 * looks exactly like one that is merely generic, forever. So it speaks to the only reader who
 * can do something about it: a developer, in development, with the offending name in the
 * message. Guarded by `__DEV__` rather than routed through a logger, because there is no logger
 * here and this must not reach a customer's device at all.
 *
 * ## The order is load-bearing: validate, *then* sharpen
 *
 * `known` is computed on the name the database sent, before `sharper` ever sees it. That is the
 * whole reason the misspelling warning still works: `restaurant-outlin` is not a glyph, so it is
 * caught and reported, rather than becoming `restaurant-sharp` — which *is* a real name, and
 * would then pass a check performed on the derived value and report nothing.
 *
 * So the derived name is never the thing being validated, which also means a row stored as
 * `-sharp` already arrives heavy and is left alone rather than doubled up.
 */
export function categoryIcon(
	iconName: string | null | undefined,
): CategoryIconName {
	if (iconName === null || iconName === undefined) {
		return FALLBACK_CATEGORY_ICON;
	}

	const known = Object.hasOwn(Ionicons.glyphMap, iconName);

	if (__DEV__ && !known) {
		console.warn(
			`[category-icon] "${iconName}" is not an Ionicons name; drew "${FALLBACK_CATEGORY_ICON}" instead.`,
		);
	}

	return (
		known ? sharper(iconName) : FALLBACK_CATEGORY_ICON
	) as CategoryIconName;
}
