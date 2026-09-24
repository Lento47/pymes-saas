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
 * It is `pricetag-outline` — the shape a marketplace uses for "a thing being sold" — which is
 * the same glyph a caller's `?? "pricetag-outline"` applies to a *missing* name. The difference
 * this constant makes is the other case: a name that is present but wrong.
 */
export const FALLBACK_CATEGORY_ICON = "pricetag-outline";

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

	return (known ? iconName : FALLBACK_CATEGORY_ICON) as CategoryIconName;
}
