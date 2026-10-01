import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Category } from "@pymeshub/shared";
import { type Href, router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { categoryIcon } from "@/lib/category-icon";
import { useT } from "@/lib/i18n";
import { icon, MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Image } from "./image";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The category rail: the one row that says what this marketplace sells.
 *
 * Extracted from the home feed, where it was a local component, because the search
 * results screen draws the same row and two copies of a chip are two chips that drift.
 * `apps/web/components/catalog/category-strip.tsx` is its counterpart and the two make
 * the same decisions: it scrolls sideways rather than wrapping (a strip of twenty
 * categories wrapped over four lines pushes the actual content below the fold), and every
 * chip is a link into `/category/[slug]`.
 *
 * ## Chips are buttons here, and links on the web
 *
 * Web draws anchors, because a category there is a URL — shareable, crawlable, openable
 * in a new tab. React Native renders no anchors, so a chip is a `Pressable` that pushes
 * the same route; `./pressable` owns the spring, the dim and Android's ripple, and this
 * component types no pixel of its own.
 *
 * ## A rail draws one level, and the caller says which
 *
 * The taxonomy in `category` is two levels: 18 sectors and their 224 children, and
 * `catalog.categories` returns both, a sector immediately followed by the categories it
 * holds. A strip is one flat row, so it can only ever be one of the two, and the *caller*
 * picks — this component draws what it is handed, and it is handed the sectors by the
 * feed (`app/index.tsx`), by the search screen's idle state and by a category's own page.
 * The one caller that passes something else is the search *results* rail, which draws the
 * categories a query matched: that set is capped at ten by `catalog.search`, it means
 * "what your word matched" rather than "the taxonomy", and a child in it is a real answer
 * a reader asked for. Filtering here would have hidden it and left the count above the
 * rail naming rows the rail no longer drew.
 *
 * ## "Todo" is opt-in
 *
 * The all chip is drawn only when the caller passes `allHref` — web's rule, and the same
 * prop name. A rail on a screen that is already showing everything (a set of search
 * results, a category's own page) has no destination to offer it, and a chip that goes
 * where the reader already is is a chip that does nothing.
 *
 * The home feed used to be named in that list and no longer is, and the change is a fact
 * about the app rather than about this component: `catalog.feed` caps `nearby` at twelve
 * (`FEED_NEARBY_LIMIT`, `apps/api/src/services/catalog.ts`), so a feed of twelve is not
 * "everything" and now has somewhere to send the chip — `app/nearby`, which lists every
 * public business with a cursor behind it.
 *
 * ## The selected chip
 *
 * `selectedSlug` is the category being browsed, so a rail on the category page shows
 * where the reader is. The selection is drawn on the **same box** as its neighbours —
 * the chip is a tile and stays one, and it is not a pill against outlined neighbours —
 * with the box's fill moving from `accent` to `primary` and the glyph's ink from
 * `accentForeground` to `primaryForeground`. The second signal is the label's weight,
 * and the state is also stated to the screen reader through `accessibilityState`, which
 * is the half that does not depend on seeing colour at all. It deliberately does *not*
 * borrow the checkmark `app/business.tsx`'s shop tabs draw: those are a choice between
 * alternatives within one screen, and this is a marker on a page whose own title
 * already names the category.
 *
 * Re-tapping the chip you are standing on `replace`s rather than `push`es, so the screen
 * under the finger cannot end up on the stack twice with a back gesture that returns to
 * it. Every other chip pushes, and a rail is navigation: the tap that opens a page is
 * answered by the page, so nothing here fires a haptic.
 *
 * ## Where it is placed
 *
 * The rail owns what is inside it — the horizontal padding its own scroll needs, the gap
 * between chips, the chips themselves. The space *above* it is a screen's, because it
 * differs by screen: the feed puts an `xl` under the search field, search results put a
 * section heading there. A rail that carried its own top margin would be right in one of
 * those places and wrong in the other.
 *
 * Nothing is rendered when there are no categories — a rail of nothing under a section
 * heading is a heading with a shrug under it.
 */
export function CategoryRail({
	categories,
	selectedSlug,
	allHref,
}: {
	categories: Category[];
	selectedSlug?: string;
	/**
	 * Where "Todo" goes. Omitted on a screen that is already showing everything.
	 *
	 * `Href` rather than `string`, of expo-router's own route union, so the literals the
	 * callers pass are checked against the routes that exist — a rail whose "Todo" chip
	 * 404s is worse than one that does not compile.
	 */
	allHref?: Href;
}) {
	const { t, locale } = useT();

	if (categories.length === 0) return null;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.rail}
		>
			{allHref ? (
				<Chip
					label={t("category.all")}
					iconName="grid-outline"
					// "Todo" is this app's own mark rather than a category, so it has no
					// photograph to draw and never will.
					imageUrl={null}
					onPress={() => router.push(allHref)}
				/>
			) : null}

			{categories.map((category) => {
				const selected = category.slug === selectedSlug;
				const href = {
					pathname: "/category/[slug]" as const,
					params: { slug: category.slug },
				};

				return (
					<Chip
						key={category.id}
						label={localizedName(category, locale)}
						iconName={category.iconName ?? "pricetag-outline"}
						imageUrl={category.imageUrl ?? null}
						selected={selected}
						onPress={() =>
							selected ? router.replace(href) : router.push(href)
						}
					/>
				);
			})}
		</ScrollView>
	);
}

/**
 * One tile: a photograph when the category has one, a glyph in a box when it does not.
 *
 * `Category` carries `imageUrl` (`packages/shared/src/schemas/catalog.ts`) and the demo
 * catalogue leaves it null (`packages/db/src/seed.ts`), so today every tile draws the glyph
 * and this is the surface that lights up the day categories have art — no screen change
 * needed. That is the whole reason the branch is here rather than somewhere later: the app
 * is drawn ready for imagery, and `docs/imagery.md` is what has to happen for it to arrive.
 *
 * The two marks are not interchangeable. `imageUrl` is a *photograph* and is drawn by
 * `./image` (the right box from the first frame, a fade on load, the same box if it fails).
 * The glyph is `iconName` from the API — a name from *our* icon set arriving as a bare
 * string, and the lookup that decides whether this build can draw it (including the
 * fallback and the `__DEV__` warning) is `lib/category-icon`, which `app/categories` reads
 * for the same rows.
 *
 * A tile and not a pill: categories are destinations, not filters, and a row of
 * identical pills reads as one control repeated. The box is `accent` with the glyph in
 * `accentForeground` at rest; selected it fills `primary` with `primaryForeground` ink, the
 * same pair the tab bar's active state wears.
 *
 * ## The label wraps as many lines as it needs, and never breaks a word
 *
 * The first half of that is `./product-tile`'s rule and this file's: **nothing here is
 * clamped.** No `numberOfLines`, no ellipsis. "Belleza, Salud y Cuidado Personal" runs to
 * four lines and the tiles below it are uneven, and that is the lesser fault — a cap would
 * be truncating a category's name to save a layout, and `Juguetes, Pasatiempos y
 * Coleccionables` would become a different category than the one the reader is looking for.
 *
 * The second half is what this file got wrong and why `TILE_WIDTH` is measured rather than
 * picked. A word wider than its own box is not ellipsised, it is **broken** — and this rail
 * was rendering `Decoració / n` and `Recreaci / ón` for exactly that reason, with the
 * comment above claiming a two-line wrap that no width at 13pt can deliver and that nothing
 * in the code enforced. See the note on `TILE_WIDTH` for the measurement.
 *
 * The label's `width` is set explicitly for the same reason the tile's is not enough:
 * `alignItems: "center"` sizes a child to its content, so without it the text lays out
 * unbroken and overflows.
 */
function Chip({
	label,
	iconName,
	imageUrl,
	selected = false,
	onPress,
}: {
	label: string;
	iconName: string;
	imageUrl: string | null;
	selected?: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			// The selection reaches the accessibility tree as a state, not only as ink.
			accessibilityState={selected ? { selected: true } : undefined}
			style={styles.tile}
		>
			{/*
			    The tile is `accent` and the glyph `accentForeground` — the palette's own quiet
			    tinted pair, the same one `./business-card`'s letter stand-in sits on. Both pairs
			    on this box are **measured, not assumed**: `accentForeground` on `accent` is
			    **8.9:1** in the light palette and **10.4:1** in the dark one, and the selected
			    pair (`primaryForeground` on `primary`) is **7.0:1** and **6.3:1** — all four past
			    the 4.5 the label owes. A tile moved here from `muted` without that check would
			    have been a contrast decision made by taste.
			*/}
			<View
				style={[
					styles.tileBox,
					{
						backgroundColor: selected ? colors.primary : colors.accent,
					},
				]}
			>
				{imageUrl ? (
					// The photograph fills the box; the tile's own label names the category,
					// so the picture is announced by that and not on its own.
					<Image
						uri={imageUrl}
						radiusToken="full"
						style={styles.tileImage}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				) : (
					<Ionicons
						name={categoryIcon(iconName)}
						size={icon.action}
						color={
							selected ? colors.primaryForeground : colors.accentForeground
						}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				)}
			</View>
			<Text
				variant="label"
				tone="default"
				bold={selected}
				style={styles.tileLabel}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * The label column, and the width a category's name has to be set in.
 *
 * **108 is measured, not chosen.** It is the width at which no single word in any of the
 * **18 sector** names is too wide for its box, which is the whole defect: a word wider than
 * its container is not ellipsised or hyphenated, it is *broken*, and this rail was shipping
 * `Decoració / n`, `Tecnolog / ía` and `Recreaci / ón` because `TILE_WIDTH` was 60 and the
 * longest words in the taxonomy are wider than that.
 *
 * The three that decide it, at the `label` token's 13pt and rounded **up**:
 *
 * | word | sector | width |
 * |---|---|---|
 * | `Entretenimiento` | Libros, Medios y Entretenimiento | ~98pt |
 * | `Coleccionables` | Juguetes, Pasatiempos y Coleccionables | ~95pt |
 * | `Capacitación` | Educación y Capacitación | ~80pt |
 *
 * 98 is the floor and 108 is what this is, because 102 left four points of slack and four
 * points is less than one character: the next sector with a word one letter longer than
 * `Entretenimiento` would have broken again, and the tile count is the same at 102 and 108,
 * so the margin is free. `lib/category-rail.test.ts` asserts it rather than trusting this
 * paragraph.
 *
 * ## The two leaves that do not fit, and are not made to
 *
 * `Electrodomésticos` and `Electrodomésticos (DIY)` are ~115pt: no column that shows three
 * tiles across a phone can hold that word, and widening to 120pt would show two. They reach
 * this rail through exactly one caller — the search screen's *results* rail, which draws the
 * categories a query matched, and a search for "electrodomésticos" matches them. The other
 * three callers pass sectors and are fully fixed by the width above.
 *
 * That is left visible rather than papered over. An ellipsis would hide it, and the rule this
 * repo states (`./product-tile`) is that a cap is truncating data to save a layout; a smaller
 * font would take every sector label down to 10pt to accommodate one word. Both are worse than
 * the defect they remove. The honest fix is a shorter `name` on those two rows, or a
 * `shortName` column for the rail — a change to the taxonomy's content, which is not this
 * file's to make. The test holds both names, so the day one is shortened it says so.
 *
 * ## The price
 *
 * Three tiles across a 390pt screen where there were five. That is what the sector names
 * cost, and it is not avoidable at any width — it is what the names are.
 */
const TILE_WIDTH = 108;

/**
 * The disc, which is **not** `TILE_WIDTH`.
 *
 * One constant used to drive both the disc and the label column, which is why the fix for a
 * label that would not fit had nowhere to go: widening the tile also widened the disc, and
 * the rail would have lost four of its five tiles to buy back a word. Separating them means
 * the disc keeps the size that makes the strip read as a strip, and only the text gets wider.
 */
const DISC_SIZE = 60;

const styles = StyleSheet.create({
	rail: { paddingHorizontal: space.lg, gap: space.sm },
	// A tile is a disc with a word under it, and the two sizes are independent: the disc is
	// the rhythm, the label column is the space the name has to fit in.
	tile: {
		alignItems: "center",
		gap: space.xs,
		width: TILE_WIDTH,
		minHeight: MIN_TOUCH_TARGET,
	},
	tileBox: {
		width: DISC_SIZE,
		height: DISC_SIZE,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		// The photograph fills the box and is clipped to its corner.
		overflow: "hidden",
	},
	tileImage: { width: "100%", height: "100%" },
	// The width is stated here rather than left to the tile's, and that is not redundancy.
	// `tile` sets `alignItems: "center"`, which sizes a child to its *content* rather than
	// to the parent — so an unconstrained `<Text>` would lay out at its full unbroken width
	// and overflow the tile rather than wrap inside it. Naming the width is what forces the
	// wrap at 102pt, which is the entire fix.
	tileLabel: { textAlign: "center", width: TILE_WIDTH },
});
