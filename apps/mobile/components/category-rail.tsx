import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Category } from "@pymeshub/shared";
import { type Href, router } from "expo-router";
import {
	FlatList,
	type ListRenderItemInfo,
	StyleSheet,
	View,
} from "react-native";

import { categoryIcon } from "@/lib/category-icon";
import { useT } from "@/lib/i18n";
import { radius, space, useTheme } from "@/theme";

import { Image } from "./image";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The category rail: the one strip that says what this marketplace sells.
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
 * in a new tab. React Native renders no anchors, so a chip is a `Pressable` that pushes the
 * same route; `./pressable` owns the spring, the dim and Android's ripple, and this
 * component types no pixel of its own.
 *
 * ## A rail draws one level, and the caller says which
 *
 * The taxonomy in `category` is two levels: 18 sectors and their 223 children, and
 * `catalog.categories` returns both, a sector immediately followed by the categories it
 * holds. A strip is one flat list, so it can only ever be one of the two, and the *caller*
 * picks — this component draws what it is handed, and the search screen's idle state
 * hands it the sectors.
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
 * results) has no destination to offer it, and a chip that goes
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
 * `selectedSlug` can mark the category being browsed. The selection is drawn on the
 * **same box** as its neighbours —
 * the chip is a tile and stays one, and it is not a pill against outlined neighbours —
 * with the box's fill moving from `accent` to `primary` and the glyph's ink from
 * `accentForeground` to `primaryForeground`. The second signal is the tile's scale, and
 * the state is also stated to the screen reader through `accessibilityState`, which is the
 * half that does not depend on seeing colour at all. It deliberately does *not* borrow
 * the checkmark `app/business.tsx`'s shop tabs draw: those are a choice between
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

	const items = [
		...(allHref
			? [
					{
						key: "__all",
						label: t("category.all"),
						iconName: "grid-outline",
						// "Todo" is this app's own mark rather than a category, so it has no
						// photograph to draw and never will.
						imageUrl: null as string | null,
						selected: false,
						onPress: () => router.push(allHref),
					},
				]
			: []),
		...categories.map((category) => {
			const selected = category.slug === selectedSlug;
			const href = {
				pathname: "/category/[slug]" as const,
				params: { slug: category.slug },
			};
			return {
				key: category.id,
				label: localizedName(category, locale),
				iconName: category.iconName ?? "pricetag-outline",
				imageUrl: category.imageUrl ?? null,
				selected,
				onPress: () => (selected ? router.replace(href) : router.push(href)),
			};
		}),
	];

	const renderItem = ({
		item,
		index,
	}: ListRenderItemInfo<(typeof items)[number]>) => (
		<Chip
			label={item.label}
			iconName={item.iconName}
			imageUrl={item.imageUrl}
			selected={item.selected}
			// The stagger. Even indexes sit on the upper row, odd ones drop by `ROW_OFFSET`,
			// which is what makes the strip read as a shelf rather than a queue.
			offset={index % 2 === 0 ? 0 : ROW_OFFSET}
			onPress={item.onPress}
		/>
	);

	return (
		<FlatList
			horizontal
			data={items}
			renderItem={renderItem}
			keyExtractor={(item) => item.key}
			// Exact geometry, stated rather than measured by the list at scroll time: the
			// stagger makes every column the same width, so one number describes all of them
			// and `snapToInterval` can use the pitch instead of guessing.
			getItemLayout={(_, index) => ({
				length: COLUMN_PITCH,
				offset: COLUMN_PITCH * index,
				index,
			})}
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.rail}
			// Tiles land on column boundaries. Without it momentum stops wherever the fling
			// ends, which can leave a tile cut at the edge — and a cut tile the reader did not
			// leave there reads as broken rather than as "there is more". This is invisible
			// in a screenshot and obvious in the hand, which is why it survived six rounds of
			// tuning that all happened through screenshots.
			snapToInterval={COLUMN_PITCH}
			/*
			 * Virtualization, and it is the reason this is a `FlatList`.
			 *
			 * A horizontal `ScrollView` mounts every child, so with all 18 sectors now
			 * carrying a photograph the first paint of the home feed fetched all 18 — about
			 * 772 KB — before the reader had scrolled a single pixel, and 13 of them were
			 * for tiles nobody was looking at.
			 *
			 * Six renders is two full stagger columns, which is one more than fits on a
			 * 390pt screen, so the buffer covers a fling without paying for the tail.
			 */
			initialNumToRender={6}
			maxToRenderPerBatch={4}
			windowSize={5}
			// The deliberate peek, as a footer rather than a child. A `ScrollView`'s trailing
			// spacer was a child, which a `FlatList` would virtualise away — and the peek is
			// the only signal that the row scrolls. `space.xl` is less than half a tile: it is
			// not a fourth destination, it is the edge of one.
			ListFooterComponent={<View style={styles.railEnd} />}
		/>
	);
}

/**
 * One column: a photograph when the category has one, a glyph in a box when it does not,
 * and the category's name under it.
 *
 * `Category` carries `imageUrl` (`packages/shared/src/schemas/catalog.ts`) and all 18
 * sectors have one, seeded by `scripts/seed-category-images.py` into the `MEDIA` bucket
 * and served by `/files/:id`. The glyph branch is not dead code: it is what a category the
 * operator has not given a photograph yet draws, and what `app/categories` and a leaf in
 * the search results rail still draw today.
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
 * ## The name is under the picture and is not capped
 *
 * There is no `numberOfLines` here and there never will be, for the reason `./product-tile`
 * states: a cap truncates data to save a layout, and "Juguetes, Pasatiempos y Coleccionables"
 * with an ellipsis is a different category from the one the reader is looking for. So a long
 * name wraps, and the columns end ragged — which the stagger was chosen to make look
 * deliberate rather than accidental.
 *
 * That is affordable *because* the tile is 108 wide, which is the width this file used to
 * give the label before the labels came off. The number did not change; what it was for
 * did. At 60 the same names broke across lines (`Decoració / n`, `Recreaci / ón`), which is
 * what removed them.
 *
 * ## The tile got bigger because a photograph is not a glyph
 *
 * `DISC_SIZE` was 64 and every decision in it was icon geometry: a 24pt glyph in a 60pt box
 * reads at that size, and the six rounds of tuning the gap comments describe were all about
 * packing five of them across. A photograph at 64 is legible as *a category* and not as
 * *which* category — a reader could not tell the burger from a bagel without looking twice.
 *
 * At 108 the subject is identifiable, which is the whole argument for photographs over
 * glyphs, and the column pitch of 120 still shows three of them across a 390pt screen.
 */
function Chip({
	label,
	iconName,
	imageUrl,
	selected = false,
	offset = 0,
	onPress,
}: {
	label: string;
	iconName: string;
	imageUrl: string | null;
	selected?: boolean;
	/** `ROW_OFFSET` on the lower row of the stagger, 0 on the upper. */
	offset?: number;
	onPress: () => void;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			// Overrides the children's names, so the button announces once: the label is read
			// from here rather than composed from the visible `Text` plus the hidden picture.
			accessibilityLabel={label}
			// The selection reaches the accessibility tree as a state, not only as ink.
			accessibilityState={selected ? { selected: true } : undefined}
			style={[styles.column, { marginTop: offset }]}
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
						// The edge, and the reason this tile reads as an object rather than as
						// a tint. On a photograph the boundary is also what separates the
						// picture from the canvas behind it, which matters because the set is
						// mostly light-on-light: a burger on white and a sofa on white are the
						// same value until something bounds them. A 1pt `border` fixes that on
						// every palette at once, where darkening `accent` would need redoing per
						// theme.
						borderWidth: selected ? 2 : 1,
						// Selected, the ring is `primaryForeground` on a `primary` fill — the same
						// pair the tile's ink already wears, so it reads as the same object and not
						// as a second outline drawn on top of it.
						borderColor: selected ? colors.primaryForeground : colors.border,
						transform: selected ? [{ scale: SELECTED_SCALE }] : undefined,
					},
				]}
			>
				{imageUrl ? (
					// The photograph fills the box; the tile's own label names the category,
					// so the picture is announced by that and not on its own.
					<Image
						uri={imageUrl}
						radiusToken="sm"
						style={styles.tileImage}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				) : (
					<Ionicons
						name={categoryIcon(iconName)}
						// 40, not `icon.back`. The old 24 was sized for a 64 box at a 37.5% fill;
						// carried across unchanged to a 108 box it would have been a 9% speck and
						// the glyph tiles — the categories with no photograph yet, and every leaf
						// in the search results rail — would have looked broken next to the ones
						// that have one. 40 in 108 holds the same proportion the 24-in-64 did.
						size={GLYPH_SIZE}
						color={
							selected ? colors.primaryForeground : colors.accentForeground
						}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				)}
			</View>

			<Text variant="caption" style={styles.label}>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * The three numbers the layout is made of.
 *
 * `TILE` is the old `TILE_WIDTH` of 108, unchanged — the width at which no single word in
 * any of the **18 sector** names is too wide for its box. That was measured once and it is
 * the reason the labels can come back: `Entretenimiento` is ~98pt and `Coleccionables`
 * ~95pt at the `label` token, so 98 is the floor and 108 has ten points of slack over it.
 * `lib/category-rail.test.ts` asserts it rather than trusting this paragraph.
 *
 * The two leaves that still do not fit are `Electrodomésticos` and
 * `Electrodomésticos (DIY)` at ~115pt. They reach this rail through exactly one caller —
 * the search screen's *results* rail — and no column showing three tiles across a phone can
 * hold them. They are left wrapping rather than papered over with an ellipsis, and the test
 * holds both names so the day one is shortened it says so.
 *
 * `PITCH` is what `snapToInterval` snaps to and what `getItemLayout` reports, and it is
 * exact: every column is `TILE` plus the gap, at either vertical offset, because the
 * stagger moves a column down rather than sideways.
 *
 * `ROW_OFFSET` is the stagger. It is `space.xl`, which is **20** — 18.5% of the tile. Enough
 * to break the straight edge that makes a row read as a queue; little enough that the lower row
 * is not left hanging below the strip's own height by half a picture.
 *
 * It was previously written up here as "space.xl (30) — about a quarter of a tile". `space.xl`
 * is 20. The code always said `space.xl` and always drew 20; the number in this paragraph was
 * the only thing that was wrong, and nothing caught it because the test asserted
 * `ROW_OFFSET < TILE / 3` — a bound loose enough to pass at 20 *or* at 30, written for the 30.
 * `lib/category-rail.test.ts` now asserts the exact value.
 */
const TILE = 108;
const COLUMN_PITCH = TILE + space.md;
const ROW_OFFSET = space.xl;

/**
 * The glyph inside a tile that has no photograph.
 *
 * Sized as a proportion rather than taken from `theme`'s `icon` roles: the largest role is
 * `back` at 24, which is chrome at the top of a pushed screen. A 108pt tile holding a 24pt
 * glyph is the 9% speck described on the `Ionicons` above.
 */
const GLYPH_SIZE = 40;

const styles = StyleSheet.create({
	// `space.md` (12) between columns. Unchanged from the single row: mis-taps come from the
	// gutter, and 12 still leaves 7.7pt of clear air between two 108pt targets, which is
	// wider than the 1.04 selected scale grows a tile by (2.2pt a side).
	rail: { paddingHorizontal: space.lg, alignItems: "flex-start" },
	// The trailing spacer's own width — the deliberate peek. `space.xl` (20), less than a
	// fifth of a 108pt tile.
	railEnd: { width: space.xl },
	// A column is the picture and its name, stacked. `width` is stated so the caption wraps
	// against the tile rather than against the column's content, and `alignItems: center`
	// centres the name under its own picture rather than under the column's widest child.
	column: { width: TILE, alignItems: "center" },
	tileBox: {
		width: TILE,
		height: TILE,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		// The photograph fills the box and is clipped to its corner.
		overflow: "hidden",
	},
	tileImage: { width: "100%", height: "100%" },
	// `space.xs` (4) between the picture and the name. The caption is 12/16, so this leaves
	// the pair reading as one object: the gap has to be smaller than the caption's own line
	// box, or the name detaches and looks like a footnote to the picture.
	label: { marginTop: space.xs, textAlign: "center" },
});

/**
 * How much larger a selected tile draws.
 *
 * A scale is the signal because it is a *size*: nothing about how the reader sees it is
 * ambiguous, and it survives any palette, any colour vision, and greyscale. The 2pt border
 * is the second signal and is worth keeping for a different reason — a 4% growth on a 108pt
 * tile is 4.3pt, or 2.2pt a side, which is well inside the 12pt gutter and cannot make two
 * selected neighbours touch.
 *
 * The width and height are border-box and unchanging, so only the content area shrinks by a
 * point when selected. Nothing reflows.
 */
const SELECTED_SCALE = 1.04;
