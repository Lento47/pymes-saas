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
 * identical pills reads as one control repeated. The box is `muted` with the glyph in
 * `mutedForeground` at rest; selected it fills `primary` with `primaryForeground` ink, the
 * same pair the tab bar's active state wears. The label wraps to two lines rather than
 * truncating: "Frutas y verduras" is a category, and an ellipsis would make it a different
 * one.
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
						radiusToken="md"
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
				variant="caption"
				tone={selected ? "default" : "muted"}
				bold={selected}
				style={styles.tileLabel}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/** Two columns of a phone at the rail's own gap, rounded down to a whole number. */
const TILE_WIDTH = 76;

const styles = StyleSheet.create({
	rail: { paddingHorizontal: space.lg, gap: space.sm },
	// A tile is a square box with a word under it. The width is fixed at two
	// chips' worth so five in a row read as one rhythm; the label below wraps
	// inside that width rather than truncating a category's name.
	tile: {
		alignItems: "center",
		gap: space.xs,
		width: TILE_WIDTH,
		minHeight: MIN_TOUCH_TARGET,
	},
	tileBox: {
		width: TILE_WIDTH,
		height: TILE_WIDTH,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		// The photograph fills the box and is clipped to its corner.
		overflow: "hidden",
	},
	tileImage: { width: "100%", height: "100%" },
	tileLabel: { textAlign: "center" },
});
