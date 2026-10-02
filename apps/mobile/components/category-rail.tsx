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
 * ## Why the box is a rounded square and not a disc
 *
 * It was one. `radius.full` on a 60pt square is a circle, and a circle is the wrong shape for
 * this particular job for three reasons that only became clear together.
 *
 * A 20pt glyph sits in the middle of it, so **the curve throws away about a third of the
 * area** — the corners that a square spends on nothing are the corners a glyph does not use.
 * `accent` is `#ececff` on a `#ffffff` card with no border, a tint with no edge, so against a
 * pale surface the disc read as a smudge rather than a shape. And it was the **only rounded
 * circle on a screen made of rounded rectangles**: `./card` draws `radius.md`, the search
 * field draws `radius.md`, and this row of dots sat on top of them speaking a second language.
 *
 * `radius.md` is `./card`'s own corner, so the rail becomes three surfaces of one kind instead
 * of a foreign object laid over them. It is also what makes the photograph branch worth having:
 * at `full` a square picture is clipped to a circle and loses its corners to the curve, and no
 * category row has an image today (`image_url` is null on all 242) so that cost was being paid
 * for a picture that does not exist.
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
						// The box's own radius, not `full`. The tile is a rounded square now, so a
						// circular photograph inside it would draw the disc this change removed,
						// one layer down — and clip the picture's corners for nothing.
						radiusToken="sm"
						style={styles.tileImage}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				) : (
					<Ionicons
						name={categoryIcon(iconName)}
						// `icon.back` (24), not `icon.action` (20), and the reason is the fill
						// ratio rather than the glyph. A 20pt mark in a 44pt box is 45%; at 24 it
						// is **55%**, which is where a glyph stops reading as something floating
						// inside its container and starts reading as the tile itself. It is the
						// next step in the same scale — `theme/tokens.ts` keeps these a handful
						// of sizes rather than an open one, and 24 is the step above `action`.
						//
						// The two numbers are a pair and move together: shrinking `TILE_SIZE`
						// without growing this regresses the fill silently, which is why
						// `lib/category-rail.test.ts` asserts the ratio and not the glyph alone.
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
 * The tile: a mark, and nothing else.
 *
 * There is no label. The names ran to two, three and four lines inside a strip that is
 * supposed to be scannable in one pass, and fixing that honestly cost the rail more than it
 * bought — \TILE_WIDTH\ had to grow to 108pt to stop \Decoración\ breaking mid-word, which
 * took the visible row from five tiles to three. Both problems had the same root, and it was
 * the words: a 20pt glyph in a rounded square says "food" or "clothing" to anyone who has
 * seen a category rail before, and the strip's job is to be a shelf of marks, not a
 * paragraph.
 *
 * ## What this costs, said plainly
 *
 * A reader who does not recognise the glyph has no way to tell \Belleza\ from \Hogar\, and
 * the row of tiles becomes a guessing game where it used to be a list. That is a real loss and
 * it is not offset by anything below. It is also why \ccessibilityLabel\ on the tile is now
 * load-bearing rather than redundant: it is the only place the category's name survives, so
 * the pressable carries it and the glyph stays out of the tree.
 *
 * The rail is also where a search result can be a *leaf* rather than a sector, and there the
 * loss is sharpest — \Dispositivos Inteligentes\ and \Dispositivos Conectados\ are two rows
 * with one mark between them. \pp/(customer)/categories.tsx\ is the screen that carries the
 * names, and it is unchanged.
 *
 * ## The width is one number again
 *
 * It used to be two: a 108pt label column beside a 60pt box, split because widening the tile
 * to fit a word also widened the disc. With the label gone there is nothing to fit, so the
 * split is removed rather than left behind as two constants that now say the same thing.
 *
 * ## 44, and why the space that was left was inside the box
 *
 * It was 60, and the rail still read as though the marks were floating apart after the gap
 * between them came down from 8pt to 4pt. The gap was never where the space was. A 20pt glyph
 * in a 60pt box is **33% fill**: twenty points of empty `accent` on each side, so the distance
 * a reader sees between two glyph *edges* was 20 + 4 + 20 = **44pt**, of which four was the gap
 * and forty was padding inside tiles I had not touched.
 *
 * 44 with a 24pt glyph inverts that ratio — **55% fill** — and takes the space between marks to
 * 24pt, less than half what it was, while a seventh tile fits across a 390pt screen instead of
 * five. 44 is also `MIN_TOUCH_TARGET` exactly, so this is the tightest the touch target allows:
 * a 40pt box would be a target under the platform floor, which is why this is 44 and not 40.
 */
const TILE_SIZE = 44;

const styles = StyleSheet.create({
	// The gap between tiles is `space.xs`, not `space.sm`, and the reason is what is either
	// side of it now. At `sm` (8) two marks sat eight points apart, which at this size
	// reads as two things rather than one row — and once the labels came off there was nothing
	// to carry the eye across the gap, because a word under each tile used to do it and does
	// not any more. `xs` is the scale's own next step down and is the tightest it goes without
	// a value invented outside the vocabulary.
	rail: { paddingHorizontal: space.lg, gap: space.xs },
	// The touch target, stated here rather than inherited from the box.
	//
	// `TILE_SIZE` is 44 and `MIN_TOUCH_TARGET` is 44, so today the tile *happens* to be its own
	// target and this rule does nothing. It is here so that stays true after the next person
	// resizes the box: a 40pt mark would silently become a sub-minimum target, and the failure
	// would only show up as somebody missing a tap rather than as anything a test could read.
	tile: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
	},
	tileBox: {
		width: TILE_SIZE,
		height: TILE_SIZE,
		// `radius.md`, and not `radius.full`. It is the corner `./card` draws, so the rail
		// speaks the app's shape language instead of a second one: the storefront card, the
		// search field and this tile are then three surfaces of the same kind rather than a
		// row of dots pasted onto a page of rounded rectangles.
		//
		// The radius is also what lets a photograph read. At `full` a square photograph is
		// clipped to a circle and loses its corners to the curve; at `md` it keeps the same
		// framing as every other image on the screen, and `overflow: "hidden"` below does
		// the clipping that `./card` does with the same token.
		// `radius.sm`, not `radius.md` — and the reason is that the corner is a *share of the tile*,
		// not an absolute size. `md` is 12pt, which is a fifth of a 60pt tile and reads as a square
		// with softened corners. On a 44pt tile the same 12pt is **27%** of the width and reads as a
		// squircle: the mark sits in a lozenge rather than on a tile. `sm` (6pt) is 14% here, which is
		// the "square with rounded corners" this shape is after, and it is the same ratio `md` had at
		// the size this tile used to be — so the proportion survives the resize instead of drifting.
		//
		// It is no longer `./card`'s corner (`radius.md`), which was the reason to match it in
		// the first place. That trade is deliberate and worth naming: at 44pt, matching `./card`
		// exactly means borrowing a corner proportion the card was never drawn at, and a screen
		// of forty-four rounded squares is a screen of lozenges. The token is one step down the
		// same scale, so the vocabulary still holds.
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		// The photograph fills the box and is clipped to its corner.
		overflow: "hidden",
	},
	tileImage: { width: "100%", height: "100%" },
});
