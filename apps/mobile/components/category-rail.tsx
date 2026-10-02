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
			// Tiles land on tile boundaries. Without it momentum stops wherever the fling ends,
			// which can leave a tile cut at the edge — and a cut tile the reader did not leave
			// there reads as broken rather than as "there is more". This is invisible in a
			// screenshot and obvious in the hand, which is why it survived six rounds of
			// tuning that all happened through screenshots.
			snapToInterval={DISC_SIZE + space.md}
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

			{/*
			 * A trailing spacer, and it exists because of arithmetic that happened to bite.

			 * There are 18 sectors and about five fit. A tile cut at the edge is information
			 * scent — it is how a reader knows the row scrolls and that those five are not all
			 * there is. That scent is normally free: whatever the width divides by leaves a
			 * remainder. At `DISC_SIZE` 64 with a 12pt gap, five tiles plus two 16pt insets come
			 * to **exactly** 412 — the device this was checked on — so the rail ended flush and
			 * five squares looked like the whole catalogue.

			 * So the peek is made deliberate rather than left to a remainder that happened to
			 * be non-zero on a different phone. Twenty points is less than half a tile: it is
			 * not a sixth destination, it is the edge of one.
			 */}
			<View style={styles.railEnd} />
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
 * ## There is no label, and that is a decision with a cost
 *
 * There was one, and this file has now had it both ways. `TILE_WIDTH` grew to 108 to hold
 * `Entretenimiento` (~98pt) so that `Decoración` stopped rendering as `Decoració / n` — and
 * three tiles fit across, with ragged one-and-two-line bottoms, for a strip whose whole job
 * is being scanned. The names are long *page* titles; they were never rail labels, and the
 * honest fix for that is a short name in the taxonomy rather than a wide tile in the app.
 *
 * So the names come off and the mark carries the tile, at the size it was already at: the box
 * stays 60pt, the glyph stays `icon.action`, the corner stays squared. What that costs is real
 * and is not offset by anything: a reader who does not recognise the glyph cannot tell
 * `Belleza` from `Hogar`, and in the search screen's *results* rail — the one caller that draws
 * leaves rather than sectors — the loss is sharpest, because `Dispositivos Inteligentes` and
 * `Dispositivos Conectados` are two rows sharing one mark.
 *
 * Which is why `accessibilityLabel` on the tile is load-bearing rather than redundant: it is
 * the only place the name survives, and the glyph stays `accessibilityElementsHidden` so it
 * is not announced twice. `app/(customer)/categories.tsx` is the screen that carries every
 * name, and it is unchanged.
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
						// The edge, and the reason this tile reads as an object rather than as
						// a tint. With no label, this boundary is the only thing binding the glyph
						// into something pressable, and `accent` on the card is a 2-3% luminance
						// step — detectable, but not enough to *group*. A 1pt `border` fixes that on
						// every palette at once, where darkening `accent` would need redoing per theme.
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
						// `icon.back` (24), and **the box grew with it** — 60 to 64. Growing the
						// glyph alone would have been the wrong half of this change: it would have
						// taken the padding inside the tile from 20pt to 18pt and made the mark
						// look *more* cramped, which is the opposite of the ask. At 24 in 64 the
						// padding is 20pt a side and the fill is 37.5%, up from a 33% that read as
						// a speck.
						//
						// It reads heavier now than it did at 20 for a reason worth keeping: the
						// border gave every tile a defined edge, and a glyph inside a visible shape
						// is measured against that shape. Figure-ground first, weight second.
						size={icon.back}
						color={
							selected ? colors.primaryForeground : colors.accentForeground
						}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				)}
			</View>
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
/**
 * The tile: the mark's box, and nothing beside it.
 *
 * It is `DISC_SIZE` and that is the whole tile now. There used to be a second number — a
 * `TILE_WIDTH` of 108 holding `Entretenimiento` (~98pt) so that `Decoración` would stop
 * rendering as `Decoració / n` — and it existed only to give the label room. With the label
 * gone the two numbers say the same thing, so there is one.
 *
 * The box keeps 60pt and the glyph keeps `icon.action`, both unchanged: this change removed a
 * `<Text>` and nothing else. An earlier pass here also resized the mark to 44 and grew the
 * glyph to `icon.back`, which packed eight tiles across and turned the strip into a texture;
 * that was reverted because the labels were the problem, not the sizes.
 */
const DISC_SIZE = 64;

const styles = StyleSheet.create({
	// `space.md` (12). This gap has been the most fought-over number in this file: 8 to 4 for
	// density, then back to 8 because two targets 4pt apart have no dead zone between them and
	// a rail's mis-tap costs a navigation away from the feed, and now 12 because the tiles
	// grew and gained a border, and a row of *defined* shapes needs more air between them than
	// a row of tints did.
	//
	// WCAG 2.5.8 is satisfied at any of the three — 64pt clears the 24pt floor on its own — but
	// that guideline is about target *size*, and mis-taps come from the gutter. Five tiles fit
	// across a 412pt screen here, which is the floor this rail should not go below.
	rail: { paddingHorizontal: space.lg, gap: space.md },
	// The trailing spacer's own width — the deliberate peek. `space.xl`, less than half a tile.
	railEnd: { width: space.xl },
	// The tile is its box. `width`/`height` are not stated so the pressable cannot drift away
	// from the mark it wraps, and `DISC_SIZE` at 60 already clears `MIN_TOUCH_TARGET` (44).
	tile: {},
	tileBox: {
		width: DISC_SIZE,
		height: DISC_SIZE,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		// The photograph fills the box and is clipped to its corner.
		overflow: "hidden",
	},
	tileImage: { width: "100%", height: "100%" },
});

/**
 * How much larger a selected tile draws.
 *
 * The rail's selection used to be carried by the label's weight as well as the fill, so it was
 * never colour-only. The label went, and with it the second signal — which left a *sighted
 * colour-blind* reader with nothing at all, since `accessibilityState` only reaches a screen
 * reader. WCAG 1.4.1 says colour must not be the only visual means of conveying information,
 * and a fill swap on its own is exactly that.
 *
 * A scale is the signal because it is a *size*: nothing about how the reader sees it is
 * ambiguous, and it survives any palette, any colour vision, and greyscale. The 2pt border is
 * the second signal and is worth keeping for a different reason — `DISC_SIZE` at 60 sits under
 * the 8pt gap well enough that a 4% growth cannot make two selected neighbours touch.
 *
 * `DISC_SIZE` and the border are fixed, so the box's outer size does not change when the
 * selection does; React Native's width/height are border-box, and only the content area
 * shrinks by a point. Nothing reflows.
 */
const SELECTED_SCALE = 1.04;
