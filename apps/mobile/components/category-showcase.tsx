import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Category } from "@pymeshub/shared";
import { type Href, router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { categoryIcon } from "@/lib/category-icon";
import { useT } from "@/lib/i18n";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Card } from "./card";
import { Image } from "./image";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The home feed's category shortcuts, with a stocked sector's children as an optional strip.
 *
 * ## What this replaced, and why the scroller came back in a box
 *
 * This was a scrolling rail of chips, and `/categories`' own docblock is the argument against it:
 * *"the rail shows the first six categories and hides the rest behind a gesture nobody is told
 * about."* So the feed stopped scrolling — and then a full-bleed photograph with the name drawn
 * over it turned out to need a scrim, a theme-independent ink, and a hand-measured opacity to be
 * legible on a light-on-light set of pictures. **A title on a photograph is a contrast problem
 * before it is a design problem.** Putting the title on the card's own surface deletes that
 * whole class of bug: the pair is `foreground` on `card`, a pairing the palette already defines
 * and already measures, so there is no number here that can be wrong.
 *
 * The horizontal strip *did* come back, and the difference from the rail is the box. A gesture
 * that hides twelve sectors is a defect; the same gesture inside a card with a title naming what
 * it holds is a disclosure. Card 2 says what it is — a sector, by name, with its product count —
 * and the sub-card cut off at the edge says it scrolls. `View all` keeps the full taxonomy
 * one tap away without letting eighteen choices crowd the first viewport.
 *
 * ## Card 1 is positional, and card 2 is a fact
 *
 * Card 1 takes the first three sectors in `sortOrder`, which the API owns. Nothing names a sector,
 * so a reordering in the database is what changes this screen. An earlier draft picked its two
 * hero cards by slug; that was an editorial decision wearing a data-driven costume.
 *
 * Card 2 picks the sector with the most active products across its children. The API's
 * `productCount` is per-category, so reading only the parent would miss leaf products. An
 * unstocked catalogue does not draw a second card of empty destinations.
 *
 * ## Three across, not four, and the number that decided it
 *
 * A sub-card is 98.3 points wide and `Entretenimiento` — the widest single word in all eighteen
 * sector names — measures **90.5 at `caption`**. Four across would be 71.8 points, and five
 * sector names would break mid-word: `Entretenimiento`, `Coleccionables`, `Pasatiempos`,
 * `Especialidad`, `Capacitación`. A broken word is not an ellipsis, it is a *mangled* word, and
 * `./product-tile`'s docblock forbids it. `lib/category-showcase.test.ts` measures all eighteen
 * rather than trusting this paragraph, and asserts the margin rather than the fit.
 *
 * Card 2's sub-cards are wider — 120 points — because a strip can afford to be: the widest leaf
 * word in the whole taxonomy is `Electrodomésticos` at **106.6**, and 120 holds it with air.
 *
 * ## The photographs are cutouts, and `contain` draws either kind
 *
 * Every sub-card is a tinted panel with a subject floating on it, which needs an image with
 * **alpha**. The eighteen assets seeded on 2026-10-01 are full-bleed 1254x1254 squares on a warm
 * off-white ground, so they cannot do this yet — and `resizeMode="contain"` is the choice that
 * survives both: a cutout is contained and the panel shows through around the subject, a square
 * is contained and fills its box. It degrades to "photograph above a caption" rather than to
 * broken. `scripts/category-images.mjs` and `assets/categories/README.md` hold the cutout route.
 *
 * ## The glyph fallback is not dead code
 *
 * It is what a category the operator has not photographed draws, and what `app/categories` and
 * every leaf in the search rail draw today. `lib/category-icon` decides whether this build can
 * name the icon at all and warns in `__DEV__` when it cannot.
 *
 * ## Re-tapping the card you are standing on
 *
 * `replace` rather than `push`, for the reason `./category-rail` states: a push onto the screen
 * the finger is already on leaves that screen twice on the stack.
 */
export function CategoryShowcase({
	categories,
	selectedSlug,
	allHref,
}: {
	/**
	 * Every active category the caller has — sectors **and** their children.
	 *
	 * Not pre-filtered by the caller: card 2 needs a sector's children, and a component handed
	 * only the sectors cannot find them. `catalog.feed` hands over all of them in one flat list
	 * with every sector immediately followed by what it holds, so splitting here costs nothing
	 * and saves the caller knowing that card 2 exists.
	 */
	categories: Category[];
	selectedSlug?: string;
	/**
	 * Where card 1's `View all` goes — the taxonomy index.
	 *
	 * `Href` rather than `string`, of expo-router's own route union, so a literal the caller
	 * passes is checked against the routes that exist: a `View all` that 404s is worse than one
	 * that does not compile.
	 */
	allHref?: Href;
}) {
	const { t, tp, locale } = useT();
	const { colors } = useTheme();

	// Both hooks run before the guard below, which is what makes the early return legal.

	if (categories.length === 0) return null;

	const sectors = categories.filter((category) => category.parentId === null);
	const childrenOf = (id: string): Category[] =>
		categories.filter((category) => category.parentId === id);

	const stockedChildrenOf = (id: string): Category[] =>
		childrenOf(id).filter((child) => (child.productCount ?? 0) > 0);
	const buyableCount = (sector: Category): number =>
		stockedChildrenOf(sector.id).reduce(
			(total, child) => total + (child.productCount ?? 0),
			0,
		);

	const featured = [...sectors]
		.filter((sector) => stockedChildrenOf(sector.id).length > 1)
		.sort((first, second) => buyableCount(second) - buyableCount(first))[0];

	const count = featured ? buyableCount(featured) : 0;
	// A zero is not a fact worth printing on a discovery card; see the note at the draw site.
	const hasCount = count > 0;

	const gridSectors = sectors.slice(0, GRID_COUNT);
	const featuredChildren = featured ? stockedChildrenOf(featured.id) : [];

	// Fewer than three is a real state, not an error: a fresh install can hold fewer sectors.
	// A card with an empty grid inside it is worse than no card, so each is conditional.
	return (
		<View style={styles.showcase}>
			{gridSectors.length > 0 ? (
				<Card style={styles.card}>
					<View style={styles.cardHead}>
						<Text variant="heading" bold>
							{t("search.categories")}
						</Text>
						{allHref ? (
							<Pressable
								onPress={() => router.push(allHref)}
								accessibilityRole="link"
								accessibilityLabel={t("action.viewAll")}
								style={styles.viewAll}
							>
								<Text variant="label" tone="action">
									{t("action.viewAll")}
								</Text>
								<Ionicons
									name="chevron-forward"
									size={icon.control}
									color={colors.action}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
							</Pressable>
						) : null}
					</View>

					{/*
					    Fixed rows of `GRID_PER_ROW`, built as rows rather than left to wrap: `flexWrap`
					    would put three on the first row and whatever fitted on the second, so a name
					    that wraps taller than its neighbours would unbalance the row count. Stating
					    it means the card's height is a fact rather than a consequence.
					*/}
					{/*
					    Keyed on the row's first category rather than on its index. The rows never
					    reorder — they come from the API's `sortOrder` — but an index key is remounted if
					    they ever did, and a sub-card holds a loaded photograph, so a remount is a
					    refetch a reader would watch happen.
					*/}
					{chunk(gridSectors, GRID_PER_ROW).map((row) => (
						<View key={row[0]?.id ?? row.length} style={styles.gridRow}>
							{row.map((category) => (
								<CategoryTile
									key={category.id}
									category={category}
									label={localizedName(category, locale)}
									selected={category.slug === selectedSlug}
								/>
							))}
						</View>
					))}
				</Card>
			) : null}

			{hasCount && featured && featuredChildren.length > 0 ? (
				<Card style={styles.card}>
					<View style={styles.cardHead}>
						{/*
						    The sector's own name is the card's title, and the count beneath it is
						    `store.category.count` read with `tp` — that key has a `_plural`
						    sibling, so it is a count of *products* and the noun has to agree.
						    `productCount` counts public active listings, including sold-out items,
						    so "128 productos" never claims stock that is all drafts.
						*/}
						<View style={styles.cardHeadText}>
							<Text variant="heading" bold>
								{localizedName(featured, locale)}
							</Text>
							{/*
							    Only when it is something. The summed count names active products, so a
							    marketplace whose catalogue is all drafts reads `0` — true, and useless on
							    a discovery card. "Food & Beverage / 0 productos" advertises an empty shelf as
							    though it, and a reader who cannot buy anything there learns nothing they did
							    not already see. The line is the sector's own name's subtitle, so with no
							    count it simply is not drawn and the card is its title.
							*/}
							{hasCount ? (
								<Text variant="caption" tone="muted">
									{tp("store.category.count", count)}
								</Text>
							) : null}
						</View>
					</View>

					{/*
					    The strip. A `ScrollView` and not a `FlatList` because the length is known and
					    small — a median of 12 children, 29 at the most — and there is nothing to
					    virtualise at that size; the whole point of a `FlatList` is not mounting rows
					    nobody is looking at, and twelve sub-cards is not that.

					    The trailing spacer is the **peek**, and it is the deliberate signal that this
					    scrolls: 2.6 sub-cards are visible, so the third is always cut at the edge.
					    That is the thing the old rail got wrong by accident — it also cut a chip at
					    the edge, but with nothing above it saying what the row held, so the cut
					    read as broken rather than as "there is more".
					*/}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.strip}
					>
						{featuredChildren.map((category) => (
							<CategoryTile
								key={category.id}
								category={category}
								label={localizedName(category, locale)}
								selected={category.slug === selectedSlug}
								width={STRIP_WIDTH}
							/>
						))}
						<View style={styles.stripEnd} />
					</ScrollView>
				</Card>
			) : null}
		</View>
	);
}

/**
 * One sub-card: a subject on a tinted panel, the category's name beneath it.
 *
 * The picture area is `aspectRatio: 1` rather than a stated height, because the width is a
 * fraction of the screen in card 1 and a stated constant in card 2, and a square derived from
 * whatever width it has is the one that cannot be wrong on a device nobody tested.
 *
 * `resizeMode="contain"` — see the note on `resizeMode` in the file docblock. It is the only
 * value that draws a cutout *and* a full-bleed square correctly, which is what buys this
 * component the ability to take either asset without a code change.
 */
function CategoryTile({
	category,
	label,
	selected = false,
	width,
}: {
	category: Category;
	label: string;
	selected?: boolean;
	/** `undefined` in the grid, where the tile is `flex: 1` across `GRID_PER_ROW`. */
	width?: number;
}) {
	const { colors } = useTheme();
	const fill = selected ? colors.primary : colors.accent;
	const ink = selected ? colors.primaryForeground : colors.foreground;

	return (
		<Pressable
			onPress={() => pushCategory(category.slug, selected)}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={selected ? { selected: true } : undefined}
			style={[
				styles.tile,
				// The caption's own width, stated for the reason the old rail's was: `alignItems`
				// does not bound a child, so a `Text` sizes itself to its content and the longest
				// name would run past the panel and be clipped by its `overflow`.
				{ width: width ?? "100%", backgroundColor: fill },
				{
					borderColor: selected ? colors.primaryForeground : colors.border,
					borderWidth: selected ? 2 : 1,
				},
			]}
		>
			{category.imageUrl ? (
				<Image
					uri={category.imageUrl}
					resizeMode="contain"
					style={styles.tilePhoto}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : (
				<View style={styles.tileGlyph}>
					<Ionicons
						name={categoryIcon(category.iconName ?? "pricetag-outline")}
						size={GLYPH_SIZE}
						color={
							selected ? colors.primaryForeground : colors.accentForeground
						}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</View>
			)}
			<Text variant="caption" style={{ color: ink, width: "100%" }}>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * Where a sub-card goes, and whether it replaces.
 *
 * `replace` on the category already being shown, so a tap cannot leave the same screen twice on
 * the stack with a back gesture that appears to do nothing. Everything else pushes.
 */
function pushCategory(slug: string, selected: boolean): void {
	const href = { pathname: "/category/[slug]" as const, params: { slug } };
	if (selected) router.replace(href);
	else router.push(href);
}

/**
 * Split a list into fixed-size rows.
 *
 * A `flexWrap` row would do this by itself, and that is the reason it does not: a wrap row is
 * sized by its tallest child, so one name that wraps to three lines would push its neighbours
 * out of the row's alignment and leave the grid ragged in a way `alignItems: "stretch"` cannot
 * repair. Rows of three make the card's height a fact.
 */
function chunk<T>(items: T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		rows.push(items.slice(i, i + size));
	}
	return rows;
}

/**
 * The layout's four numbers, all of them consequences rather than tastes.
 *
 * `GRID_PER_ROW` is **3**, and that is the only value at which no sector name breaks mid-word.
 * At 4 across a sub-card is 71.8 points and five names overflow it — `Entretenimiento` at 90.5,
 * `Coleccionables` at 87.6, and three more. A broken word is not an ellipsis, it is a mangled
 * word, and the margin at 3 is 7.8 points, which is thin enough that the test asserts it rather
 * than asserting the fit.
 *
 * `GRID_COUNT` is three: one row of high-level choices before the shoppable feed.
 *
 * `STRIP_WIDTH` is **120**, sized by the widest word in the *whole* taxonomy rather than in the
 * sectors — `Electrodomésticos`, 106.6 at `caption`. Card 1's grid could be narrower because it
 * only ever draws sectors; card 2's strip draws leaves, and 120 holds the longest of those with
 * air. It is a stated width rather than a `flex: 1` because a strip's items do not divide a
 * screen.
 *
 * `PEEK` is `space.lg`, and it is a **negative** margin that cancels the card's own padding on
 * the right only: a `ScrollView`'s content is clipped by its container, so the last sub-card
 * would be cut 16 points short of the card's edge and the strip would look like it stopped
 * before the card did. Letting the content run to the card's own edge is what makes the cut
 * sub-card read as "there is more" rather than as "this is all of it".
 */
const GRID_PER_ROW = 3;
const GRID_COUNT = 3;
const STRIP_WIDTH = 120;
const PEEK = space.lg;

/**
 * The glyph on a sub-card with no photograph.
 *
 * 32 rather than the rail's 40 at its 108-point tile, because a grid sub-card is 98.3 points
 * and a strip's is 120 — so 32 is 33% and 27% respectively. Stated as a proportion in the test,
 * because a glyph at a fixed size across two different tile widths is the kind of number that
 * reads fine on one screen and wrong on the next.
 */
const GLYPH_SIZE = 32;

const styles = StyleSheet.create({
	// `space.lg`, because the feed's own sections inset by it (`sectionHead` in
	// `app/(customer)/index.tsx` is `paddingHorizontal: space.lg`). A showcase on a different
	// inset would be the one thing on the screen not lining up with its neighbours.
	showcase: { paddingHorizontal: space.lg, gap: space.xl },
	// `gap` on the column rather than a `marginTop` on the second card: `Card` owns its own
	// padding and margin, and stacking a margin on top of it is how the gap between two cards
	// ends up different from the gap between two sub-cards.
	card: { overflow: "hidden" },
	// The title row: the card's name, and on card 1 the link to the index.
	cardHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
	},
	// Card 2's title and count, stacked. `flex: 1` so the pair takes the row's width and a long
	// sector name wraps against the card rather than against its own content.
	cardHeadText: { flex: 1 },
	viewAll: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	gridRow: { flexDirection: "row", gap: space.sm, marginTop: space.md },
	// The strip's items. `marginTop` matches `gridRow`'s so the gap under a card's title is the
	// same in both cards — a strip that sat closer to its title than the grid does would read
	// as belonging to the title above it.
	strip: { gap: space.sm, marginTop: space.md, paddingRight: -PEEK },
	// The peek's own width: `space.xl` (20), less than a sixth of a 120-point sub-card. It is
	// not a destination, it is the edge of one.
	stripEnd: { width: space.xl },
	tile: {
		flex: 1,
		borderRadius: radius.md,
		overflow: "hidden",
		alignItems: "center",
		paddingTop: space.xs,
		paddingBottom: space.xs,
		paddingHorizontal: space.xs,
	},
	// Square, derived from the sub-card's own width. `contain` so a cutout floats on the panel
	// and a full-bleed square fills it.
	tilePhoto: { width: "100%", aspectRatio: 1 },
	tileGlyph: {
		width: "100%",
		aspectRatio: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});

/**
 * The touch minimum, restated because a sub-card is not obviously one.
 *
 * A strip sub-card is 120 wide and card 1's are 98.3 across and at least that tall, so every
 * target here clears `MIN_TOUCH_TARGET` by more than double. `lib/category-showcase.test.ts`
 * holds the grid's sub-card to it at the narrowest supported width, because that is the one that
 * moves with the screen.
 */
export const TOUCH_MINIMUM = MIN_TOUCH_TARGET;

/**
 * `icon` is imported for the chevron beside `View all`; named here so the import list and the
 * styles above cannot drift without this file failing to compile.
 */
const icon = { control: 18 } as const;
