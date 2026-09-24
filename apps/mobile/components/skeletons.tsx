import {
	type DimensionValue,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { useT } from "@/lib/i18n";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	STATUS_DOT_SIZE,
	space,
	TEXT_STACK_GAP,
	type,
} from "@/theme";

import { Card } from "./card";
import { HERO_MIN_HEIGHT } from "./hero";
import { Skeleton } from "./skeleton";

/**
 * The shape of a list, before the list arrives.
 *
 * `docs/design-mobile.md` puts a skeleton wherever the shape of the answer is known, which
 * on these screens is everywhere except a sign-in round trip and a payment. So these are
 * those shapes, written once and reused: a screen that drew its own grey blocks would draw
 * them at its own heights, and the swap from skeleton to content would jump. A skeleton is
 * only worth having if the layout it stands in for does not move when the data lands.
 *
 * Each block mirrors the component it is standing in for — the same 60pt thumbnail, the
 * same card padding, the same row rhythm — and the line heights are the *text* heights
 * multiplied by the reader's font scale, because the words they stand in for scale too. A
 * skeleton that ignored Dynamic Type would be an exact match at 100% and short of a real row at
 * 200% by at least the growth of one line of that row's own text — `type.body`'s 21-point line
 * is 42 at 200% — which is the one case where the jump is big enough to see.
 *
 * That sentence is only as good as where the heights are written, so it is worth saying where
 * they are *not*: no `type` line height lives in a module-scope style sheet in this file. A
 * line height down there cannot read `fontScale` — a module has no reader — so the three
 * blocks written that way (the two feed section headings and the search count) were frozen at
 * 100% metrics while every block around them scaled, which is how a rule drifts one style at a
 * time. The style sheets below hold widths, control floors and media sizes; every text height
 * comes from `line()` inside a component.
 *
 * `line()` is **exported**, because it was not and the mirror is already in the repo:
 * `app/orders.tsx`'s own `line` holds a byte-for-byte copy of it, written because the
 * original was private to this file. That file is free to import this one now — it is not
 * this file's to edit, and the copy is reported rather than removed.
 *
 * ## What a block does when the screen's block is optional
 *
 * Several of the blocks below stand in for something the screen renders *conditionally* — a
 * storefront's description, a product's tags, a cart's promo detail. Each of those is named
 * where it is drawn, with the line it is conditional on, and the shape chosen is the fuller
 * one. That is a choice and not a measurement: the wait is shown to a reader who is at the
 * *top* of a screen, so a block that is one short costs them nothing they can see, while a
 * block that is one long pulls content up under a thumb that has already scrolled. Where a
 * screen's composition could not be read with confidence, the inference is written down as an
 * inference in the block's own docblock rather than as a number.
 *
 * Every screen in this group strips the body's gutter — `padded={false}` where the lists are
 * edge-to-edge, `contentStyle` on `app/cart` where the header and the bar still want it — so
 * these blocks pay their own horizontal padding, and the storefront header pays the same
 * `space.lg` the real one does while the rows below it carry the segmented block's margin.
 * A screen that added its own padding around one of these would draw a skeleton narrower
 * than the list underneath it, which is the jump the whole exercise is against.
 *
 * ## One group, one announcement
 *
 * The blocks are decorative — grey rectangles read out one by one are noise — so the
 * wrapper is the accessible element and it says "Cargando" once per group. That is also
 * why the leaves are not exported: composing two groups inside one another is how a screen
 * ends up announcing itself three times.
 *
 * ## Reduced motion
 *
 * Nothing here branches. `./skeleton` owns the shimmer and drops it when the reader has
 * asked for less motion, leaving a static `muted` block that still says "this shape is
 * coming". The wait is conveyed by the box, never by the sweep.
 */

/** The line heights above, at the size the reader's text is actually rendering at. */
export function line(variant: keyof typeof type, fontScale: number) {
	return { height: Math.round(type[variant].lineHeight * fontScale) };
}

/**
 * The hairline `./card`, `./button` and `./segmented` all draw, named because three sums
 * below have to count it.
 *
 * Each of those writes `borderWidth: 1` and each box is measured border-box, so a control's
 * box is two points taller than its padding and its line. The "Filtros" block in
 * `CategorySkeleton` already spelled the two out as a bare `1 + … + 1`; naming them is what
 * lets the product page's seller row — the same `./button` at the same size — take the same
 * number instead of a second copy of the arithmetic.
 *
 * The two points are real and not bookkeeping: `./button`'s `minHeight: MIN_TOUCH_TARGET`
 * (`components/button.tsx:215`) is a floor under the box, not the box, and a label plus
 * `space.md` twice is 48 — the border is what makes the control the 50 a reader taps.
 */
const HAIRLINE = 1;

/**
 * A chip's width, as a share of the column it sits in — and nothing but a share.
 *
 * A chip in a `./facts` row is content-sized, and its content is a word nobody has yet, so
 * the only honest width is a percentage: a chip measured in points would be a chip pinned to
 * a column this file has not measured. The template type is narrow for a small reason: a width
 * here is a stand-in, and a stand-in written as a bare number reads as a measurement somebody
 * took.
 *
 * It used to double as the chip's React key — "two chips of the same width in one row *are*
 * the same box" — and that sentence was wrong in the one way that shows up at runtime:
 * `CardBlock` below draws three chips at 44% and `ProductDetailSkeleton` three at 30%, so each
 * row handed the reconciler duplicate keys and RN logged `Encountered two children with the
 * same key, \`44%\`` twice per mounted row (`ReactFabric-dev.js`, `warnOnInvalidKey` under
 * `reconcileChildrenArray`). The width is not an identity here, which is what separates this
 * row from `./review-list`'s pictures: a URL names a picture, and neither a width nor a slot
 * names a placeholder chip. What does is `namedChips` below.
 */
type ChipWidth = `${number}%`;

/**
 * One `./facts` chip, at the reader's text scale.
 *
 * `space.sm + line("label")`: `FACT_INSET_Y` above and below the label's line box, and
 * `FACT_INSET_Y` is `space.sm / 2` — `components/facts.tsx:202`, with the resulting 26
 * written out in that constant's own docblock. The inset does not scale and the line under it
 * does, which is how the real chip behaves.
 */
function chipHeight(fontScale: number) {
	return space.sm + line("label", fontScale).height;
}

/**
 * The discount badge on a grid tile: `space.xs` of inset around a `caption` line.
 *
 * Read off the badge's own box in `./product-tile`'s `badge` rule — `paddingVertical: space.xs / 2`
 * twice plus the line, at `radius.full` and a hairline. It is a different sum from
 * `chipHeight` because it is a different chip: a badge is one short word on a tile, not a
 * fact in a wrapping row.
 */
function badgeHeight(fontScale: number) {
	return space.xs + line("caption", fontScale).height;
}

/**
 * One `./button`, at its own size and the reader's text scale.
 *
 * `components/button.tsx`'s `base` is `minHeight: MIN_TOUCH_TARGET` with a hairline on every
 * variant, and both sizes that matter here are `paddingVertical` twice plus the label's
 * `heading` line — `md` (the 50 that `CategorySkeleton` and the product page's seller row
 * are both built from) and `lg`, which is 58: `space.lg` twice, the `heading` line and the
 * hairline twice. 58 is not `ACTION_BAR_CLEARANCE` either — that constant is its own sum of
 * five terms and comes to 90 (`components/action-bar.tsx:53-54`), and the `lg` box is one of
 * them rather than the whole of it. The floor never binds at either, which is why it is not
 * in the sum.
 */
function buttonHeight(padding: number, fontScale: number) {
	return HAIRLINE * 2 + padding * 2 + line("heading", fontScale).height;
}

function Group({ children }: { children: React.ReactNode }) {
	const { t } = useT();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={t("a11y.loading")}
		>
			{children}
		</View>
	);
}

/** A product row: thumbnail, title, seller line, price — `./product-row`'s rhythm. */
function RowBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={rowStyles.row}>
			<Skeleton style={rowStyles.thumb} />
			<View style={rowStyles.body}>
				<Skeleton style={[styles.threeQuarters, line("body", fontScale)]} />
				<Skeleton style={[styles.half, line("caption", fontScale)]} />
				<Skeleton style={[styles.third, line("body", fontScale)]} />
			</View>
		</View>
	);
}

/**
 * The state, as the dot-and-word pair two components draw for it.
 *
 * `./business-card` (`components/business-card.tsx`'s `statusRow`), `./hours-table`
 * (`components/hours-table.tsx`'s `state`) and `./hero` (`components/hero.tsx`'s `metaRow`) all
 * draw a `STATUS_DOT_SIZE` dot beside a `label` word, and all three are why a shop card, a
 * storefront's hours table and a hero are taller than their text alone. One line where the
 * real row is a dot and a line is a block short of what replaces it.
 *
 * The row wraps in all three (`components/business-card.tsx`'s `statusRow`,
 * `components/hours-table.tsx`'s `head`), which is why this one does: the word is data and at
 * 200% text "Cerrado" does not fit beside its dot.
 *
 * The width is the caller's because the word is data — "Abierto" and "Cerrado" are not the
 * same length, and neither is knowable before the response.
 */
function StateBlock({ width }: { width: DimensionValue }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={stateStyles.row}>
			<Skeleton style={stateStyles.dot} radiusToken="full" />
			<Skeleton style={[{ width }, line("label", fontScale)]} />
		</View>
	);
}

/**
 * The chips of one row, each with a name of its own.
 *
 * The widths repeat on purpose — `CardBlock` draws three at 44% and the product page three at
 * 30% — so a width cannot be the React key. It was, and the reconciler said so at runtime:
 * `Encountered two children with the same key, \`44%\`` twice per mounted row
 * (`ReactFabric-dev.js`, `warnOnInvalidKey` under `reconcileChildrenArray`). A slot would be
 * unique and is still the wrong name; this repo lints under `noArrayIndexKey`, and the rule is
 * right that a position is not an identity. What is an identity is "the second 44% chip" — the
 * width, plus which one of that width this is — which stays true if a row is ever reordered and
 * does not pretend the widths differ when they do not.
 */
function namedChips(
	widths: readonly ChipWidth[],
): { key: string; width: ChipWidth }[] {
	const seen = new Map<ChipWidth, number>();

	return widths.map((width) => {
		const nth = seen.get(width) ?? 0;
		seen.set(width, nth + 1);

		return { key: `${width}#${nth}`, width };
	});
}

/**
 * A `./facts` row: chips of the right height, at widths that are a stand-in.
 *
 * The real row wraps at `gap: space.sm` (`components/facts.tsx`'s `facts`), and the chips in
 * it are content-sized — a chip's width is its word, and the words are not known yet. So
 * this draws the *shape* instead: the widths are fractions chosen so the row wraps onto the
 * number of lines the real one takes at 1×. Three at 44% in a shop card's text column is two
 * per line and one wrapped, which is the two-row shape `./business-card` draws for the five
 * facts it composes (`components/business-card.tsx`'s `<Facts>`).
 */
function ChipRowBlock({ widths }: { widths: ChipWidth[] }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={factStyles.row}>
			{namedChips(widths).map(({ key, width }) => (
				<Skeleton
					key={key}
					style={[{ width }, { height: chipHeight(fontScale) }]}
					radiusToken="full"
				/>
			))}
		</View>
	);
}

/**
 * A shop card: logo, name, category, state, facts — `./business-card`'s rhythm.
 *
 * The card's own padding, and none of this file's. The block used to restate
 * `./business-card`'s `padding: space.md` so the two would agree, which is the wrong kind of
 * agreement: it tied the skeleton to an override on the real card, and the day either number
 * moved the grey block would have been a few points out — the one jump a skeleton exists to
 * prevent. `Card`'s padding is the same number in both places by construction.
 *
 * The body is the same four children the real card's is, in the same order and at the same
 * `TEXT_STACK_GAP`: the name's `heading` line, the category's `label` line, the state row
 * and the chip row (`components/business-card.tsx`'s `body`). It used to be four plain lines,
 * which is what the card looked like before it composed a wrapped `Facts` row — and the
 * difference is not cosmetic: two of those lines were 18-point label lines where the real
 * card now draws a 26-point state row and a chip row that is two of those, so the grey card
 * came out about two chip rows shorter than the card that replaced it.
 *
 * The empty square at the end is `./business-card`'s own `favoriteSlot`
 * (`components/business-card.tsx`'s `favoriteSlot`, `MIN_TOUCH_TARGET` square) — not drawn, but *present*,
 * because it is what makes the text column the width the real card's text column is. A
 * skeleton with the heart's box missing draws its lines a step too wide, and a line that is
 * too wide is a line that wraps in a different place.
 */
function CardBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<Card>
			<View style={cardStyles.row}>
				<Skeleton style={cardStyles.logo} />
				<View style={cardStyles.body}>
					<Skeleton style={[styles.twoThirds, line("heading", fontScale)]} />
					<Skeleton style={[styles.third, line("label", fontScale)]} />
					<StateBlock width="40%" />
					<ChipRowBlock widths={["44%", "44%", "44%"]} />
				</View>
				<View style={cardStyles.favoriteSlot} />
			</View>
		</Card>
	);
}

/**
 * A category chip.
 *
 * One width for all five, because a chip's width is its word and the words are not known
 * yet — a rail of five different widths would be a guess dressed up as information.
 */
function ChipBlock() {
	return <Skeleton style={chipStyles.chip} radiusToken="full" />;
}

/**
 * A section heading, with the "Ver todo" link the feed's sections now carry.
 *
 * A row rather than one bar: the heading and the link share a line, so the block that
 * replaces them has to be that line. The link is a word whose width is not known until the
 * response, which is what `sectionAction` stands in for — the same compromise
 * `chipStyles.chip` makes, for the same reason.
 *
 * Both heights come from `line()` at the reader's own `fontScale`, and that is the whole of
 * this block's fix: the two were the `type.heading` and `type.label` line heights in the
 * module-scope style sheet — a fixed 24 and 18 points however large the text under them
 * actually renders. Two sections of the feed then held their place at 1× and gave it back
 * the moment the data landed at 200%, which is the jump a skeleton exists to prevent.
 */
function SectionTitleBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={styles.sectionTitleRow}>
			<Skeleton style={[styles.sectionTitle, line("heading", fontScale)]} />
			<Skeleton style={[styles.sectionAction, line("label", fontScale)]} />
		</View>
	);
}

/**
 * The home feed: the category rail, a rail of products, a column of shops.
 *
 * ## No greeting and no search field, because neither of them is greyed
 *
 * Both sit **outside** the scroll and outside the data branch on the real screen
 * (`app/index.tsx` — the greeting and the `HeroSearch` are siblings of the
 * `ScrollView`), so they are real and usable for the whole wait. A
 * skeleton that drew them would be drawing over content that is already on screen.
 *
 * ## No map band either, and that is the same rule
 *
 * The band *is* the scroll's first child (`app/index.tsx`'s `MapView`), but it is
 * rendered outside the branch the skeleton stands in for — the `feed.isError` conditional
 * below it, and the band's own comment says so in as many words: "outside the branch below, so
 * the band is real while the lists are grey". So the band is on screen, at its real height,
 * for the whole wait, and the first thing this block has to draw is the rail under it.
 *
 * That is the version of this that was reported wrong: the report had the map band as
 * something this block was missing. It is not, and drawing one would put a grey band under a
 * live map.
 */
export function FeedSkeleton() {
	return (
		<Group>
			<View style={styles.rail}>
				{[0, 1, 2, 3, 4].map((index) => (
					<ChipBlock key={index} />
				))}
			</View>

			<View style={styles.section}>
				<BannerBlock />
			</View>

			<View style={styles.section}>
				<SectionTitleBlock />
				<View style={styles.rail}>
					{[0, 1, 2].map((index) => (
						<TileBlock key={index} />
					))}
				</View>
			</View>

			<View style={styles.section}>
				<SectionTitleBlock />
				<View style={styles.cards}>
					{[0, 1, 2].map((index) => (
						<CardBlock key={index} />
					))}
				</View>
			</View>

			<View style={styles.section}>
				<SectionTitleBlock />
				<View style={styles.rows}>
					{[0, 1, 2, 3, 4].map((index) => (
						<RowBlock key={index} />
					))}
				</View>
			</View>

			<View style={styles.section}>
				<SectionTitleBlock />
				<View style={styles.rail}>
					{[0, 1, 2].map((index) => (
						<TileBlock key={index} />
					))}
				</View>
			</View>
		</Group>
	);
}

/**
 * The two blocks the recomposed feed added, and the counts above are the screen's own
 * previews rather than round numbers: three cards where `NEARBY_PREVIEW` draws three,
 * five rows where `FEATURED_PREVIEW` draws five. The earlier version drew three rows and
 * two cards while the screen drew five and three — a skeleton that hands the page back
 * taller than it took it is the jump this whole file exists to prevent.
 *
 * `BannerBlock` mirrors `./promo-hero`'s body (a caption line, a `title` line, a chip),
 * inside the card's own padding. `TileBlock` mirrors `./product-tile` (a 4:3 photo box and
 * two text lines). Both keep the *shape* rather than the content: no skeleton draws a word.
 */
function BannerBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={feedStyles.banner}>
			<Skeleton
				style={[feedStyles.bannerCaption, line("caption", fontScale)]}
			/>
			<Skeleton style={[feedStyles.bannerTitle, line("title", fontScale)]} />
			<Skeleton style={feedStyles.bannerChip} />
		</View>
	);
}

function TileBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={feedStyles.tile}>
			<Skeleton style={feedStyles.tilePhoto} />
			{/* `body`: the tile's name draws at the `body` step since the price stopped
			    out-shouting it — `./product-tile`'s title note. */}
			<Skeleton style={[feedStyles.tileLine, line("body", fontScale)]} />
			<Skeleton style={[feedStyles.tileLine, line("caption", fontScale)]} />
		</View>
	);
}

const feedStyles = StyleSheet.create({
	// `./card`'s own padding, corner and `./promo-hero`'s body gap, so the block is the
	// banner's box rather than a guess at it — the banner is a `Card`, so the corner is the
	// surface step `md`, not the sheet step `lg`.
	banner: {
		padding: space.lg,
		gap: TEXT_STACK_GAP,
		borderRadius: radius.md,
	},
	bannerCaption: { width: "40%" },
	bannerTitle: { width: "70%" },
	// The code chip: `./promo-hero`'s own inset at `radius.full`, with no margin of its own —
	// the code row is the body stack's third line and the stack's gap carries the step.
	bannerChip: {
		width: "45%",
		height: 24,
		borderRadius: radius.full,
	},
	// The tile's width is a fixed compromise, exactly as `chipStyles.chip`'s is: the rail's
	// real width is `window * TILE_RATIO` (`./product-rail`), and a block that imported that
	// private const would couple the wait to the content's arithmetic. `./product-tile`'s
	// docblock records the same 172 for the same ratio on a 390pt phone.
	tile: { width: 172, gap: TEXT_STACK_GAP },
	// The photo's box, at the crop `./product-tile` draws (`width: 100%`, 4:3).
	tilePhoto: { width: "100%", aspectRatio: 4 / 3 },
	tileLine: { width: "80%" },
});

/**
 * Search results: the count line, the kind switch, then the one list it selects.
 *
 * One list, not three. Search used to draw every group `catalog.search` answers with,
 * stacked, and this mirrored it with a section each plus the categories rail. The screen now
 * draws a `Segmented` switch and the groups it is showing — and how many of those groups will
 * come back non-empty is not knowable before the response, which is the one genuine guess
 * left here. A skeleton that drew three would resolve into one and the page would collapse
 * under the reader, so it draws the count, the switch and one headed group.
 *
 * The switch is `Segmented`'s real box rather than a `MIN_TOUCH_TARGET` bar: the group is a
 * row of segments with `minHeight: MIN_TOUCH_TARGET` inside a bordered, `radius.sm` box
 * (`components/segmented.tsx`'s `group`), so its height is the floor plus the hairline top
 * and bottom. The previous block was the floor alone, which is two points short of the control
 * that replaces it — and it carried the wrong margin besides.
 *
 * The group is `app/search.tsx`'s own head: a heading and a count sharing a line at
 * `minHeight` of one `heading` line (`groupHead`), then the list under it (`children`). The count
 * the group carries is not drawn as a number — a `label` line stands in for it at the width
 * a two-digit count takes, the same compromise `sectionAction` makes.
 *
 * The "Ver todo" link is drawn beside that count, in the `space.md`-gapped row the screen
 * puts the two in (`groupMeta`, whose own rule is `gap: space.md`). It belongs here for the
 * same reason the group is a column of cards: the group this block stands for is the shops
 * under "Todo", which is the one group the screen gives an action to (`shopsAction`),
 * and the word is the feed's own — so the block is `sectionAction`'s width, not a second
 * guess at it.
 *
 * ## What the switch's presence is, and is not
 *
 * The screen only renders the switch when the query matched more than one kind of result
 * (`app/search.tsx`'s `switchable`), which is not knowable here either. It is
 * drawn, for the same reason the group count is: the alternative is a page that grows
 * upwards under a reader who is already looking at it.
 */
export function SearchResultsSkeleton() {
	const { fontScale } = useWindowDimensions();

	return (
		<Group>
			<Skeleton style={[styles.count, line("label", fontScale)]} />
			<Skeleton style={styles.segmented} />
			<View style={styles.section}>
				<View
					style={[
						styles.groupHead,
						{ minHeight: line("heading", fontScale).height },
					]}
				>
					<Skeleton style={[styles.groupTitle, line("heading", fontScale)]} />
					<View style={styles.groupMeta}>
						<Skeleton style={[styles.groupCount, line("label", fontScale)]} />
						<Skeleton
							style={[styles.sectionAction, line("label", fontScale)]}
						/>
					</View>
				</View>
				<View style={styles.cards}>
					{[0, 1].map((index) => (
						<CardBlock key={index} />
					))}
				</View>
			</View>
		</Group>
	);
}

/**
 * The shops a category holds, and nothing above them: a column of cards.
 *
 * Separate from `CategorySkeleton` rather than a second `Group` inside it, because the
 * two are never on screen together — see the note above on announcing a group once — and
 * because the page they belong to waits in two steps: the name and the rail arrive from
 * `catalog.categories` while the shops are still coming from `businesses.list`, and at
 * that moment the real heading is already on screen and only this column is grey.
 *
 * It is also the whole wait on `app/nearby.tsx`, whose list is the same column of the
 * same cards under a real back button and a real filter row — which is why this block draws
 * neither.
 */
export function BusinessCardsSkeleton() {
	return (
		<Group>
			<View style={styles.cards}>
				{[0, 1, 2].map((index) => (
					<CardBlock key={index} />
				))}
			</View>
		</Group>
	);
}

/**
 * A category's page: its name, the rail of categories, and the shops in it.
 *
 * The heading is `Skeleton`-d at a line of `title` text because the real one is a
 * `<Text variant="title">` — the name is data and it arrives with everything else, so it
 * is part of the shape being waited for rather than something to draw empty and then
 * fill.
 *
 * No back button, and that is the screen's own doing rather than an omission here: on
 * `app/category/[slug]` the back control is rendered *before* the branch this block stands
 * in for (`app/category/[slug].tsx`'s `Button`), so it is real for the whole wait.
 */
export function CategorySkeleton() {
	const { fontScale } = useWindowDimensions();

	// `./button`'s own box at its default `size="md"`: the label's `heading` line at the
	// reader's text scale, `space.md` of `paddingVertical` twice, and the hairline twice — 50
	// points at 1×. `MIN_TOUCH_TARGET` is the floor *under* that box and not its value, and it
	// is 6 points short of it, so a block drawn at the floor would be 6 short of the "Filtros"
	// button that replaced it. The sum is unchanged from what this block computed inline
	// before; it goes through `buttonHeight` now so the product page's seller row — the same
	// control at the same size — takes the same number instead of its own copy.
	const filterHeight = buttonHeight(space.md, fontScale);

	return (
		<Group>
			<View style={categoryStyles.head}>
				<Skeleton style={[styles.twoThirds, line("title", fontScale)]} />
			</View>
			<View style={categoryStyles.rail}>
				{[0, 1, 2, 3, 4].map((index) => (
					<ChipBlock key={index} />
				))}
			</View>
			{/* The sector's children, which the page draws as a card of `./list-row`s between
			    the rail and the button: three rows of one `body` line each, at the gap a row
			    pays between its own parts. The card's gutter and its corner are the `Card`'s. */}
			<View style={categoryStyles.children}>
				<Card>
					<View style={categoryStyles.childRows}>
						{[0, 1, 2].map((index) => (
							<Skeleton
								key={index}
								style={[styles.twoThirds, line("body", fontScale)]}
							/>
						))}
					</View>
				</Card>
			</View>
			<View style={categoryStyles.filters}>
				<Skeleton
					style={[categoryStyles.filterButton, { height: filterHeight }]}
				/>
			</View>
			<View style={categoryStyles.cards}>
				{[0, 1, 2].map((index) => (
					<CardBlock key={index} />
				))}
			</View>
		</Group>
	);
}

/**
 * A storefront's hero, and the shop's facts with it.
 *
 * One hero-shaped block, not a cover with an identity row beneath it. The identity — the
 * name, the rating, the delivery line — sits *on* the cover behind a scrim, so its height is
 * already inside `HERO_MIN_HEIGHT`; drawing it as a separate row under the cover made this
 * block taller than the page it stands for by exactly that row. `HERO_MIN_HEIGHT` is
 * imported from `./hero` rather than restated, which is what keeps the two from drifting:
 * `components/hero.tsx`'s own `hero` rule puts that same `minHeight` on the box the real one is.
 *
 * The chips are inside that box too (`components/hero.tsx`'s `facts` row), so the facts row
 * needs no block of its own here — and the heart in the corner is absolutely positioned
 * (`components/hero.tsx`'s `action`), so it takes no height from the box either.
 *
 * `minHeight` is a floor and the real hero can exceed it: above 100% text the identity block —
 * a `display` name, a `label` meta line and a `label` state row, `TEXT_STACK_GAP` apart
 * (`identityBody`) —
 * grows past the `media.header` logo beside it and the box with it. That is an inference from
 * those styles rather than a measurement, and it is the one case where this block is short.
 * The alternative was modelling the identity block here, which would put an estimate of a
 * shop's name length into a shape that has no business holding one.
 */
function StoreHeaderBlock() {
	return (
		<View style={storeStyles.header}>
			<Skeleton style={storeStyles.hero} radiusToken="lg" />
		</View>
	);
}

/**
 * The shop's week, as `./hours-table` draws it.
 *
 * The heading row is the component's own: "Horario" on the left and the open/closed state on
 * the right (`components/hours-table.tsx:160-182`, at `marginBottom: space.sm` and
 * `space-between` in its style rule). Under it, one row per weekday at `TEXT_STACK_GAP`,
 * each a day name and a time at `space-between`.
 *
 * Seven rows is not a guess: `hours` is one entry per weekday
 * (`businessHoursEntrySchema`, one row per `day`) and the
 * table sorts all of them Monday-first (`[...hours].sort`). The table itself draws nothing for
 * a shop with no schedule loaded — `if (hours.length === 0) return null;` at
 * `components/hours-table.tsx:124`, and again when no row can be named
 * (`if (rows.some((row) => row.dayName === null)) return null;`,
 * `components/hours-table.tsx:156`) — which is a case this block cannot know and draws anyway.
 * That is the same direction as every other conditional block here, and the price is visible:
 * a storefront with no hours is a storefront whose head is eight rows shorter than this.
 */
function HoursBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View>
			<View style={storeStyles.hoursHead}>
				<Skeleton style={[styles.third, line("heading", fontScale)]} />
				<StateBlock width="30%" />
			</View>
			<View style={storeStyles.hoursRows}>
				{[0, 1, 2, 3, 4, 5, 6].map((index) => (
					<View key={index} style={storeStyles.hoursRow}>
						<Skeleton style={[styles.third, line("body", fontScale)]} />
						<Skeleton style={[styles.quarter, line("body", fontScale)]} />
					</View>
				))}
			</View>
		</View>
	);
}

/**
 * One menu group: its heading, its count, and the rows under it.
 *
 * `app/store/[slug].tsx` draws one of these per category — a block at `marginTop: space.xxl`
 * with a `space.md` gap inside it (its `section` rule), a heading and a count sharing a
 * baseline at the page's own inset (`sectionHead`), then the rows in a container that is
 * itself inset by `space.lg` (its `rows` rule) — which is why each row's own `space.lg` of
 * padding lands at 32 from the screen edge in both the real page and this block.
 */
function MenuGroupBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={storeStyles.section}>
			<View style={storeStyles.sectionHead}>
				<Skeleton style={[styles.third, line("heading", fontScale)]} />
				<Skeleton style={[styles.tenth, line("label", fontScale)]} />
			</View>
			<View style={styles.rows}>
				{[0, 1, 2].map((index) => (
					<RowBlock key={index} />
				))}
			</View>
		</View>
	);
}

/**
 * The reviews, as far as a storefront can draw them.
 *
 * `app/store/[slug].tsx`'s own `reviews` block composes three things under one heading: a
 * `SectionHeader`, a `ReviewSummary` and a `ReviewList`. Each is here at its own shape —
 * `./section-header`'s row at `marginBottom: space.md` (`components/section-header.tsx`'s
 * `row`); `./review-summary`'s block, a `display` score beside a `label` line and a `caption`
 * count at `space.md` (`components/review-summary.tsx`'s `head`) when the shop has reviews, or
 * the one `body` sentence it draws when it does not
 * (`components/review-summary.tsx`'s empty-state branch); and two review rows, each a name and
 * a date on a line at `space.sm`, a star row, and the words
 * (`components/review-list.tsx`'s `row` and `head`).
 *
 * Two rows of the shop's reviews, and that count is the only thing here that is a stand-in
 * rather than a measurement: `ratingCount` is data and a shop can have none, one, or four
 * hundred. Two is the compromise the rest of this file makes for a list whose length is
 * unknowable — one row is not a list and three is a page of a screen nobody has scrolled yet.
 * A shop with no reviews draws one `body` sentence instead, so this block is short by the
 * three rows above in that case.
 */
function ReviewsBlock() {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={storeStyles.reviews}>
			{/* No heading row: `app/store/[slug]` deleted its "Reseñas" heading — the summary
			    under it already names the block — so drawing one here would hand the page back
			    taller than the reader left it. Reported by the copy pass and fixed here, which
			    is the division of labour `docs/design-mobile.md`'s skeleton rule implies: a
			    screen may not edit this file, and this file must not outlive a screen's cut. */}
			<View style={storeStyles.summary}>
				<Skeleton style={[styles.quarter, line("display", fontScale)]} />
				<View style={storeStyles.summaryInk}>
					<Skeleton style={[styles.half, line("label", fontScale)]} />
					<Skeleton style={[styles.third, line("caption", fontScale)]} />
				</View>
			</View>

			{[0, 1].map((index) => (
				<View key={index} style={storeStyles.review}>
					<View style={storeStyles.reviewHead}>
						<Skeleton style={[styles.third, line("body", fontScale)]} />
						<Skeleton style={[styles.quarter, line("caption", fontScale)]} />
					</View>
					<Skeleton style={[styles.quarter, line("caption", fontScale)]} />
					<Skeleton style={[styles.full, line("body", fontScale)]} />
					<Skeleton style={[styles.twoThirds, line("body", fontScale)]} />
				</View>
			))}
		</View>
	);
}

/**
 * The business page, before either read has answered.
 *
 * The head, in the order `app/store/[slug].tsx` composes it, at the same `space.lg` gap
 * (the screen's own `head` rule): the hero, the closed-shop sentence, the description, the
 * hours table, and the search field that sits immediately above the menu it searches.
 *
 * Two of those are conditional on the real screen and are drawn anyway:
 *
 * - the closed sentence, `{line ? … : null}`, which a shop that is open never draws — so a
 *   shop with nothing to say here is one `body` line shorter;
 * - the description, `{card.description ? … : null}`, which every shop in the seed carries at
 *   the shop level (`packages/db/src/seed.ts`), so this is the common shape rather than the
 *   floor.
 *
 * ## Two controls that are not drawn, because they are not on screen either
 *
 * The back button is rendered **inside** the data branch, so during the wait the real page has
 * none of it, and the `StoreNav` rail is a sibling *after* the branch and draws nothing until
 * the shop has two groups (`components/store-nav.tsx`: `if (groups.length < 2) return null;`).
 * This block does
 * not invent placeholders for them, which is this file's rule for a control rather than a
 * shape — the same reason `CartSkeleton` draws no bar. It is worth reporting as a mismatch
 * of the screen's own making: the back control and the rail appear with the data and push
 * everything below them down, and no skeleton can hold a space the page is not using.
 */
export function StorefrontSkeleton() {
	const { fontScale } = useWindowDimensions();

	return (
		<Group>
			<View style={storeStyles.head}>
				<StoreHeaderBlock />

				<View style={storeStyles.pad}>
					<Skeleton style={[styles.twoThirds, line("body", fontScale)]} />
				</View>

				<View style={storeStyles.pad}>
					<Skeleton style={[styles.full, line("body", fontScale)]} />
					<Skeleton style={[styles.twoThirds, line("body", fontScale)]} />
				</View>

				<View style={storeStyles.pad}>
					<HoursBlock />
				</View>

				<Skeleton style={storeStyles.field} radiusToken="md" />

				<MenuGroupBlock />
				<MenuGroupBlock />

				<ReviewsBlock />
			</View>
		</Group>
	);
}

/** A business page whose shop has answered and whose menu has not. */
export function ProductRowsSkeleton() {
	return (
		<Group>
			<View style={styles.rows}>
				{[0, 1, 2, 3].map((index) => (
					<RowBlock key={index} />
				))}
			</View>
		</Group>
	);
}

/**
 * The featured products, two up — `app/featured.tsx`'s grid, in grey.
 *
 * It is here rather than in the screen because it is a *product* shape and this file is where
 * the app's product shapes live: `app/featured.tsx` wrote its own for one pass and
 * says in its own docblock that the honest home is beside `ProductRowsSkeleton`. A grid and a
 * column are the app's two answers to "a list of products" — a menu is a column (one shop's
 * items in that shop's order) and a shelf is a grid (products from different shops) — so the
 * two blocks belong on the same shelf in this file.
 *
 * Each tile is the tile: a `Card`, because the real one is (`app/featured.tsx`'s `<Card`, with
 * no style, so the padding, the radius and the hairline are the same numbers by construction),
 * holding the photograph at the detail page's own 4/3 crop and then the badge, the title, the
 * seller and the price at `TEXT_STACK_GAP` (`app/featured.tsx`'s `body`). The tile used to be
 * drawn without its `Card`, which made every grey tile 34 points shorter than the product
 * that replaced it — the two edges and the `space.lg` of padding above and below.
 *
 * Three rows of two tiles, and the count is a stand-in rather than the page: `PAGE_SIZE = 20`
 * at two tiles to a row is ten rows, which `app/featured.tsx`'s own `PAGE_SIZE` docblock calls
 * more than a thumb will scroll before deciding. Six tiles is an even number, so the odd last
 * row — the half-width tile `lib/chunk-pairs` leaves beside an empty sibling, rather than the
 * full-width one a `numColumns` list would stretch — is never drawn here either. The real grid
 * has three rows, and the wait draws three.
 *
 * The badge is the one conditional thing here — `{discount ? … : null}` in `./product-tile`,
 * which is the surface every grid in this app draws its cells from, and it is a chip rather
 * than a line, because that is what it is: `space.xs` of inset around a `caption` line at
 * `radius.full`.
 *
 * One rule this block keeps and the copy it replaces did not: nothing here is clamped. Nothing
 * in this app caps text scaling — there is no `maxFontSizeMultiplier` and no
 * `allowFontScaling={false}` anywhere in `apps/mobile` outside a comment in `./status-badge` —
 * so a clamped line height would be a silent under-draw above 200%, and this block follows the
 * file's own rule instead: the height is the line height at the reader's scale, whatever that
 * is.
 */
export function ProductGridSkeleton() {
	const { fontScale } = useWindowDimensions();

	return (
		<Group>
			<View style={gridStyles.rows}>
				{[0, 1, 2].map((row) => (
					<View key={row} style={gridStyles.row}>
						{[0, 1].map((column) => (
							<Card key={column}>
								<View style={gridStyles.tile}>
									<Skeleton style={gridStyles.photo} />
									{/* `body`, like `TileBlock` — the real tile's name is a `body` line
									    now that the price draws at the same step (`./product-tile`). */}
									<Skeleton style={[styles.full, line("body", fontScale)]} />
									<Skeleton
										style={[styles.twoThirds, line("caption", fontScale)]}
									/>
									{/* `body`, matching the real tile's `<Price variant="body">`. The
									    sketch draws the surface the wait stands in for, and a price
									    sketched three points taller than the one that arrives is a
									    jump the skeleton exists to prevent. */}
									<Skeleton style={[styles.third, line("body", fontScale)]} />
									{/* The badge last, which is where `./product-tile` draws it — see
									    that file's note. The order is the whole point of the sketch: a
									    chip above the title pushes the three lines below it down, so a
									    skeleton that drew it there would promise a layout the content
									    does not deliver, and the swap would move the title. */}
									<Skeleton
										style={[
											gridStyles.badge,
											{ height: badgeHeight(fontScale) },
										]}
										radiusToken="full"
									/>
								</View>
							</Card>
						))}
					</View>
				))}
			</View>
		</Group>
	);
}

/**
 * `app/categories`' grid: the category tiles, two up.
 *
 * The same box `ProductGridSkeleton` draws, because the two grids are one layout rule —
 * `lib/chunk-pairs` builds both, and the rows, gutters and half-width cells here are
 * `gridStyles`, which that block also reads. What differs is the tile's *contents*, and that is
 * the whole of this block: a category tile is a glyph, a name and a count, where a product tile
 * is a photograph, a badge and a price.
 *
 * Nine rows of two, which is eighteen tiles: the grid draws the taxonomy's first level and
 * nothing else, and the taxonomy's first level is eighteen sectors — the count the API's own
 * rows come to (`packages/db/migrations/0006_category_taxonomy.sql`). It is a count rather
 * than a cap, which is the distinction the old note here got wrong: this block used to draw
 * ten tiles for a "seed's taxonomy of six rows", and ten was neither. A wait that is short of
 * the answer steps the page up as the tiles land, and one that is longer leaves a hole.
 *
 * The name and the count stand in at the heights the real ones draw: a `label` line and a
 * `caption` one, at the reader's text scale, three-quarters and half width, because a category
 * name is one or two words and its sentence is "{count} productos".
 */
export function CategoryGridSkeleton() {
	const { fontScale } = useWindowDimensions();

	return (
		<Group>
			<View style={gridStyles.rows}>
				{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
					<View key={row} style={gridStyles.row}>
						{[0, 1].map((column) => (
							<Card key={column}>
								<View style={gridStyles.categoryTile}>
									<Skeleton style={gridStyles.categoryIcon} />
									<View style={gridStyles.categoryText}>
										<Skeleton
											style={[styles.threeQuarters, line("label", fontScale)]}
										/>
										<Skeleton
											style={[styles.half, line("caption", fontScale)]}
										/>
									</View>
								</View>
							</Card>
						))}
					</View>
				))}
			</View>
		</Group>
	);
}

/**
 * A product page: the photo, the name, the facts, the price, the shop, the words, the
 * choices, and the form the bar cannot hold.
 *
 * The order is `app/product/[id]`'s own, at its own `gap: space.lg`
 * (the screen's `sections` rule) — the page's blocks are siblings in that column, so every
 * block here carries no margin of its own and the gap does the spacing. That gap is the
 * whole of the fix this block needed: it was `space.md`, so a page of eight blocks came out
 * eight `space.xs` steps shorter than the page that landed.
 *
 * Read off the screen, block by block: the `Gallery` at the 4/3 crop (the screen's `hero`
 * rule), the title (`<AnimateIn index={0}>`), the badges as a `./facts` row
 * (`<AnimateIn index={1}>`), the rating and the category on one wrapping line at `space.md`
 * (`<AnimateIn index={2}>` and its `metaRow`), the `Price` at its default `heading` variant
 * (`<AnimateIn index={3}>`), the shop control and the heart at `space.sm`
 * (`<AnimateIn index={4}>`) — a ghost `./button`, which is 50 points at 1×, not a line — the
 * description as a `space.sm` block of a heading and a `body` line (`{data.description ? (`),
 * the tags as the second `./facts` row (`{data.tags.length > 0 ? (`), one option group, and
 * the tail.
 *
 * ## The tail, which is what the bar cannot hold
 *
 * The screen's `tail` is a `space.lg` column of the note field and the quantity stepper.
 * `./field` is three rows at `space.sm` — a `label` line, the input at the touch floor, and
 * the message row, which is reserved whether or not it has anything in it
 * (`components/field.tsx`'s `wrap`, `input` and `message`). That last row is held here as an empty box
 * rather than a grey one: the real row is empty until a validation message lands in it, and a
 * grey line would be a block drawn for content the screen does not have.
 *
 * The stepper is `./quantity-stepper`'s row — three `MIN_TOUCH_TARGET` squares and the two
 * `space.md` gaps between them — which is the pill `cartStyles.stepper` already stands in for.
 *
 * ## What is drawn here that the screen sometimes does not
 *
 * The description (`{data.description ? (`), the tags (`{data.tags.length > 0 ? (`) and the
 * option groups (`{data.optionGroups.map(`) are all conditional, and all three are drawn.
 * Each is the common shape rather than the floor —
 * every product in `packages/db/src/seed.ts` carries a description, and the option groups are
 * where the shop's choices live — and the direction of the error is the one this file
 * chooses: a page that lands taller than its skeleton does not pull content up under a thumb
 * that has already scrolled. A product with none of the three lands three blocks short — three
 * siblings of the column, the description's heading and its lines being inside one of them.
 *
 * The bar is not drawn, at all: it is a sibling of `Screen` rather than part of this column
 * (the screen's `{ready && data ? (` branch, which draws the whole page and the bar together)
 * and it appears whole with the product, which is `CartSkeleton`'s rule for the same control.
 */
export function ProductDetailSkeleton() {
	const { fontScale } = useWindowDimensions();

	// One `./option-card`'s own box: the hairline twice, `space.md` of padding twice, the
	// name's `body` line and the price's `label` line, `TEXT_STACK_GAP` apart — one text
	// stack, the gap the card's own rule pays
	// (`components/option-card.tsx:390`, `card: {`). At 1× that is 2 + 24 + 21 + 2 + 18 = 67,
	// and the `MIN_TOUCH_TARGET` floor in the same rule never binds underneath it — which is
	// why the card is 67 and not 44.
	//
	// The name is one line here and cannot be two: the rail is a horizontal `ScrollView`, so
	// the card is measured against an unbounded width and grows to the longest name in the
	// group rather than wrapping one (`components/option-card.tsx`'s `OPTION_CARD_MIN_WIDTH`
	// note — the `numberOfLines={2}` that used to sit on it was inert and is gone). A group at
	// a large text scale therefore draws *wider* cards, not a taller block, which is why this
	// stands in for it with two cards at that same 140. That is a stand-in and not a
	// measurement — a name's length is not knowable before the response.
	const optionHeight =
		HAIRLINE * 2 +
		space.md * 2 +
		line("body", fontScale).height +
		TEXT_STACK_GAP +
		line("label", fontScale).height;

	return (
		<Group>
			<View style={detailStyles.sections}>
				<View style={detailStyles.pad}>
					<Skeleton style={detailStyles.hero} radiusToken="lg" />
				</View>

				<View style={detailStyles.pad}>
					<Skeleton style={[styles.twoThirds, line("title", fontScale)]} />
				</View>

				<View style={detailStyles.pad}>
					<ChipRowBlock widths={["40%", "30%"]} />
				</View>

				<View style={detailStyles.pad}>
					<View style={detailStyles.metaRow}>
						<Skeleton style={[styles.quarter, line("label", fontScale)]} />
						<Skeleton style={[styles.third, line("label", fontScale)]} />
					</View>
				</View>

				<View style={detailStyles.pad}>
					<Skeleton style={[styles.third, line("heading", fontScale)]} />
				</View>

				<View style={detailStyles.pad}>
					<View style={detailStyles.sellerRow}>
						<Skeleton
							style={[
								detailStyles.sellerButton,
								{ height: buttonHeight(space.md, fontScale) },
							]}
						/>
						<Skeleton style={detailStyles.sellerHeart} radiusToken="full" />
					</View>
				</View>

				<View style={detailStyles.pad}>
					<View style={detailStyles.block}>
						{/* No heading line: `app/product/[id].tsx` deleted its "Descripción"
						    heading (a heading with one paragraph under it), so the wait is now
						    exactly the paragraph. The copy pass reported this mismatch rather
						    than editing this file, and a skeleton one line taller than its page
						    is the jump the whole file exists to prevent. */}
						<Skeleton style={[styles.full, line("body", fontScale)]} />
						<Skeleton style={[styles.twoThirds, line("body", fontScale)]} />
					</View>
				</View>

				<View style={detailStyles.pad}>
					<ChipRowBlock widths={["30%", "30%", "30%"]} />
				</View>

				{/* One group, because a group is the unit: the heading is inside
				    `./option-card` and the rail bleeds past the page's gutter
				    (`components/option-card.tsx`'s `rail`), so a block that padded the rail would
				    be insetting a row the real page draws edge to edge. */}
				<View style={detailStyles.optionGroup}>
					<Skeleton style={[styles.third, line("heading", fontScale)]} />
					<View style={detailStyles.optionRail}>
						{[0, 1].map((index) => (
							<Skeleton
								key={index}
								style={[detailStyles.optionCard, { height: optionHeight }]}
								radiusToken="md"
							/>
						))}
					</View>
				</View>

				<View style={detailStyles.pad}>
					<View style={detailStyles.tail}>
						<View style={detailStyles.field}>
							<Skeleton style={[styles.quarter, line("label", fontScale)]} />
							<Skeleton style={detailStyles.input} />
							{/* The message row, reserved and empty — see the docblock. */}
							<View style={{ height: line("caption", fontScale).height }} />
						</View>
						<Skeleton style={cartStyles.stepper} radiusToken="full" />
					</View>
				</View>
			</View>
		</Group>
	);
}

/**
 * The basket: the shop's name, an item card or two, the promo row, the receipt.
 *
 * Moved here from `app/cart.tsx`, where it was written inline and had drifted from the screen
 * it stands in for, and it drifted again when the cart's line was rebuilt. The line card is
 * now the line card: a `Card` at `gap: space.md` (the screen's `lineCard` rule) holding a row
 * of the `media.row` thumbnail and the text beside it (its `line` and `lineBody`), then a foot
 * row with the line's own figure and the control that moves it (its `lineFoot`). It used to be
 * three loose blocks — a text line, a heading line and a bare stepper — with no thumbnail and
 * no foot, which is the whole shape of the card missing rather than a few points of it.
 *
 * `Card`'s own padding and hairline are what make the grey card the real card's size: the
 * block composes the real children rather than restating the sum, which is `CardBlock`'s
 * argument and it holds here for the same reason. The shop's name is *not* inside it; that is
 * the page's first block, above the cards.
 *
 * Two cards, because the length of a cart is the one thing that is genuinely unknown: two is
 * one more than a cart has to have and one fewer than a list, which is the same compromise
 * `CardBlock` makes for the shops on the feed.
 *
 * The promo row and the receipt are drawn at their own sizes rather than as two loose lines,
 * for the same reason the card was fixed. The receipt is `./summary-card`: a `Card` of rows
 * at `space.sm`, the subtotal at `body` and the total at `heading`. Its row count is data —
 * a discount, a tax and a tip each add one — so this draws its floor of two, which is what a
 * cart with nothing taken off it draws.
 *
 * ## What is not drawn
 *
 * The bar, and the "Ver negocios cerca" button at the end of the tail: a grey pill standing in
 * for a control nobody can press is a control drawn before it exists. The bar is the screen's
 * floor rather than part of the scroll this stands in for, and it arrives whole with the cart.
 */
export function CartSkeleton() {
	const { fontScale } = useWindowDimensions();

	// `./promo-input` is a `./list-row`, and a `list-row` is `space.md` of padding twice plus
	// the title and the state line it carries, at a `TEXT_STACK_GAP` — the title is a `body`
	// line (`components/list-row.tsx`, `variant="body"`) and the subtitle under it a `label`
	// one (`components/list-row.tsx`, `<Text variant="label" tone="muted">`), inside a row at
	// `minHeight: MIN_TOUCH_TARGET` (`components/list-row.tsx`'s `row`). Its floor is not the answer:
	// the row is 65 at 1×, so it never reaches the 44, and a block drawn at the floor would be
	// 21 points short of the row that replaces it. The two lines scale with the reader's text
	// and the padding does not, which is how the real row behaves.
	//
	// The subtitle is the promo's *result* and a cart with no code has none
	// (`components/promo-input.tsx`'s `detail`), so this draws the two-line row: half of carts
	// carry a code and the row that does is the one a reader would see move.
	const promoHeight =
		space.md * 2 +
		line("body", fontScale).height +
		TEXT_STACK_GAP +
		line("label", fontScale).height;

	return (
		<Group>
			<View style={cartStyles.body}>
				<Skeleton style={[styles.twoThirds, line("heading", fontScale)]} />

				{[0, 1].map((index) => (
					<Card key={index} style={cartStyles.lineCard}>
						<View style={cartStyles.line}>
							<Skeleton style={cartStyles.thumb} />
							<View style={cartStyles.lineBody}>
								<Skeleton style={[styles.twoThirds, line("body", fontScale)]} />
								<Skeleton style={[styles.half, line("caption", fontScale)]} />
							</View>
						</View>

						{/* The foot: the line's total at the start of the row and the stepper at the
						    end of it (`app/cart.tsx`'s `lineFoot`). The stepper is the widest thing in
						    the row and the reason the row wraps at 200% text, so a card drawn
						    without it is a card that does not move when the cart lands. */}
						<View style={cartStyles.lineFoot}>
							<Skeleton style={[styles.third, line("body", fontScale)]} />
							<Skeleton style={cartStyles.stepper} radiusToken="full" />
						</View>
					</Card>
				))}

				<Skeleton style={{ height: promoHeight }} />

				<Card>
					<View style={cartStyles.receipt}>
						{[0, 1].map((index) => (
							<View key={index} style={cartStyles.receiptRow}>
								<Skeleton style={[styles.half, line("body", fontScale)]} />
								{/* The label and the amount share one line in `MoneyLine`, and the
								    amount sits at the far end of it: `flexDirection: "row"` with
								    `space-between` is that row, not a stack of two lines. */}
								<Skeleton
									style={[
										styles.quarter,
										line(index === 1 ? "heading" : "body", fontScale),
									]}
								/>
							</View>
						))}
					</View>
				</Card>
			</View>
		</Group>
	);
}

const styles = StyleSheet.create({
	full: { width: "100%" },
	threeQuarters: { width: "75%" },
	twoThirds: { width: "65%" },
	half: { width: "50%" },
	third: { width: "35%" },
	quarter: { width: "25%" },
	tenth: { width: "10%" },
	rail: {
		flexDirection: "row",
		gap: space.sm,
		marginTop: space.xl,
		paddingHorizontal: space.lg,
	},
	section: { marginTop: space.xxl },
	sectionTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		// The real `./section-header` is the pressable base's `MIN_TOUCH_TARGET` box tall, not
		// the heading line the two lines under this stand in for — a floor the `line()` heights
		// alone would leave ~20pt short per section.
		minHeight: MIN_TOUCH_TARGET,
		marginHorizontal: space.lg,
		marginBottom: space.md,
	},
	sectionTitle: { width: "35%" },
	// A stand-in for the word "Ver todo", not a layout value: the link's width is its word,
	// which is the thing being waited for. Same compromise as `chipStyles.chip`, and the same
	// width in both blocks that draw it, because it is the same word in the same control.
	sectionAction: { width: "20%" },
	// The search kind switch: `Segmented`'s own box, which is the segment's `MIN_TOUCH_TARGET`
	// floor inside a `hairline`-bordered group (`components/segmented.tsx`'s `group` and
	// `segment`) — so the floor plus the two edges. Its corner is `Segmented`'s `radius.sm`,
	// which is the block's own default, and its margin is the screen's for the control it
	// stands in (`app/search.tsx`'s `mode`).
	segmented: {
		height: MIN_TOUCH_TARGET + HAIRLINE * 2,
		marginHorizontal: space.lg,
		marginTop: space.md,
	},
	// The group's own head: a heading and a count on one line at the page's inset, with the
	// heading's own line as the floor beneath both (`app/search.tsx`'s `groupHead`). The
	// height comes from `line()` in the component — a line height cannot live down here.
	groupHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		paddingHorizontal: space.lg,
		marginBottom: space.md,
	},
	groupTitle: { width: "35%" },
	// The count and the action cluster at the far end of the head, in the row the screen's own
	// `groupMeta` is — `space-between` on the head spreads two children to the two edges, and
	// would spread three evenly, which is not the head.
	groupMeta: { flexDirection: "row", alignItems: "center", gap: space.md },
	// The group's count, which is a number whose digits are not known yet: one `label` line at
	// the width a two-digit count takes. Same compromise as `sectionAction`.
	groupCount: { width: "15%" },
	rows: {
		marginHorizontal: space.lg,
		borderRadius: radius.md,
		overflow: "hidden",
	},
	cards: { paddingHorizontal: space.lg, gap: space.md },
	count: {
		width: "30%",
		marginHorizontal: space.lg,
		marginTop: space.md,
	},
});

const rowStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		// The same sum `./product-row`'s row uses: read the token, not the number, or the
		// grey row is a step shorter than the row that replaces it.
		minHeight: MIN_TOUCH_TARGET + space.xl,
		paddingVertical: space.md,
		paddingHorizontal: space.lg,
	},
	// `media.row` rather than a number: this box is `./product-row`'s thumbnail and has to
	// be the same square, which is the only reason the swap does not jump.
	thumb: { width: media.row, height: media.row },
	// `./product-row`'s own gap (`components/product-row.tsx`'s `body`), not `space.xs`: the three
	// lines are one text stack, and the two steps between them plus the lines are 62 against
	// the row's 64-point floor. At `space.xs` the sum is 66, which is taller than the row it
	// stands in for — the grey list was two points per row too long.
	body: { flex: 1, gap: TEXT_STACK_GAP },
});

const cardStyles = StyleSheet.create({
	row: { flexDirection: "row", gap: space.md },
	logo: { width: media.card, height: media.card },
	body: { flex: 1, gap: TEXT_STACK_GAP },
	// Not drawn, and not zero: see `CardBlock`. It is the heart's square on the real card
	// (`components/business-card.tsx`'s `favoriteSlot`), and it is what keeps this block's text column the
	// same width as the real one so the lines wrap where the real ones do.
	favoriteSlot: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET },
});

const stateStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		flexWrap: "wrap",
	},
	dot: { width: STATUS_DOT_SIZE, height: STATUS_DOT_SIZE },
});

const factStyles = StyleSheet.create({
	// `./facts`' own row (`components/facts.tsx`'s `facts`), which is what makes a chip row wrap
	// rather than run off the column.
	row: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: space.sm,
	},
});

const chipStyles = StyleSheet.create({
	// 96 is a stand-in and not a layout value: a real chip's width is its word, and the word
	// is the thing being waited for, so there is nothing in the token file for this to
	// resolve to — it is the one width all five are drawn at, as the comment above says.
	chip: { width: 96, height: MIN_TOUCH_TARGET },
});

const gridStyles = StyleSheet.create({
	// The grid's own gutter and rhythm — `app/featured.tsx`'s `pad` (the rows are inset by the
	// page's `space.lg`) and its `row` (the tiles in a row are `space.md` apart).
	rows: { paddingHorizontal: space.lg, gap: space.md },
	row: { flexDirection: "row", gap: space.md },
	// The tile's body, inside its `Card`: the same stack and the same gap the real one uses
	// (`app/featured.tsx`'s `body`).
	tile: { flex: 1, gap: TEXT_STACK_GAP },
	// The detail page's own crop, restated from `app/featured.tsx`'s `photo` — `./image` gives the
	// box its corner, and its default is the same `sm` this block takes.
	photo: { width: "100%", aspectRatio: 4 / 3 },
	// The discount chip's width, which is a word ("-25%") and therefore a stand-in.
	badge: { width: "44%" },
	// `app/categories`' tile body, inside the same `Card` a product tile sits in: the glyph's
	// box, then the name and the count as one stack — `space.sm` between the mark and the words
	// and `TEXT_STACK_GAP` between the two lines, which is the shape the real tile draws.
	categoryTile: { flex: 1, gap: space.sm },
	// The name over the count, at the stack's own 2 — `TEXT_STACK_GAP`, the number every pair
	// of lines in this app is 2 points apart by.
	categoryText: { gap: TEXT_STACK_GAP },
	// A glyph's own square, at `icon.action` — the size the tile draws the mark at. A block and
	// not a line, because a stand-in for a 20-point glyph that is a 21-point line of text would
	// be the wrong shape in the one place the eye checks first.
	categoryIcon: { width: icon.action, height: icon.action },
});

const storeStyles = StyleSheet.create({
	// The storefront's head: the column `app/store/[slug].tsx`'s `head` lays its blocks out in.
	head: { gap: space.lg },
	// A block that is neither a row nor a rail pays the page's own gutter, the rule the whole
	// screen follows (`app/store/[slug].tsx`'s `pad`).
	pad: { paddingHorizontal: space.lg },
	// The hero's own box: `./hero` puts this `minHeight` on it (its `hero` rule) and
	// the header block pays the gutter the hero's parent does.
	header: { paddingHorizontal: space.lg },
	hero: { width: "100%", minHeight: HERO_MIN_HEIGHT },
	// The search field, in `app/search.tsx`'s own shape and at its own inset — the field
	// carries `marginHorizontal` rather than sitting in a padded block, because it is a child
	// of the head column (`app/store/[slug].tsx`'s `field` rule).
	field: {
		height: MIN_TOUCH_TARGET,
		marginHorizontal: space.lg,
	},
	// The heading and the state on one line at `space.sm` under it
	// (`components/hours-table.tsx`'s `head`), which wraps at 200% text.
	hoursHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		flexWrap: "wrap",
		marginBottom: space.sm,
	},
	hoursRows: { gap: TEXT_STACK_GAP },
	hoursRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	// A menu group is a block on the page, so its step is the page's own `space.xxl` and its
	// inside gap is `space.md` (`app/store/[slug].tsx`'s `section`).
	section: { marginTop: space.xxl, gap: space.md },
	// The heading and the count share a baseline at the page's inset; the rows below them are
	// inset by the container they sit in, not by this (`app/store/[slug].tsx`'s `sectionHead`).
	// The `minHeight` and the absent `flexWrap` are the screen's box too: the head is one
	// heading line tall at the floor, and the title yields to the count rather than the row
	// wrapping under it.
	sectionHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
		minHeight: type.heading.lineHeight,
		paddingHorizontal: space.lg,
	},
	// The review section's own block (`app/store/[slug].tsx`'s `reviews`).
	reviews: {
		marginTop: space.xxl,
		gap: space.md,
		paddingHorizontal: space.lg,
	},
	// `./review-summary`'s head: the score and the two lines beside it, `space.md` apart
	// (`components/review-summary.tsx`'s `head`).
	summary: { flexDirection: "row", alignItems: "center", gap: space.md },
	summaryInk: { flex: 1, gap: space.xs },
	// One review: its own parts are `space.sm` apart inside a row that is `space.md` taller
	// than its content (`components/review-list.tsx`'s `row`).
	review: { gap: space.sm, paddingBottom: space.md },
	reviewHead: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.sm,
		flexWrap: "wrap",
	},
});

const detailStyles = StyleSheet.create({
	// The page's own column: `gap: space.lg` in `app/product/[id].tsx`'s `sections`, with every block
	// paying the gutter itself because the rails bleed past it.
	sections: { gap: space.lg },
	pad: { paddingHorizontal: space.lg },
	hero: { width: "100%", aspectRatio: 4 / 3 },
	// The rating and the category on one line (`app/product/[id].tsx`'s `metaRow`).
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		flexWrap: "wrap",
	},
	// The shop control and the heart (`app/product/[id].tsx`'s `sellerRow`).
	sellerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
	sellerButton: { flex: 1 },
	sellerHeart: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET },
	// The description: a heading with its words under it at `space.sm`
	// (`app/product/[id].tsx`'s `block`).
	block: { gap: space.sm },
	// An option group: its name and its rail are `space.sm` apart, and the rail pays its own
	// `space.lg` so it reaches both screen edges (`components/option-card.tsx`'s `rail`).
	optionGroup: { gap: space.sm },
	optionRail: {
		flexDirection: "row",
		gap: space.sm,
		paddingHorizontal: space.lg,
	},
	// An option card's width. 140 is `option-card`'s own minimum, restated because that
	// constant is not exported — and a skeleton's width *is* the layout it stands in for.
	// The height is the card's own box, computed in the component.
	optionCard: { width: 140 },
	// The foot: the note and the stepper at the page's block gap
	// (`app/product/[id].tsx`'s `tail`).
	tail: { gap: space.lg },
	// `./field`: its three rows at `space.sm` (`components/field.tsx`'s `wrap`).
	field: { gap: space.sm },
	input: { minHeight: MIN_TOUCH_TARGET },
});

/**
 * `app/category/[slug]`'s column, transcribed.
 *
 * The screen lays its title, its rail and its cards out in a `gap: space.lg` column, so
 * each block here carries that `space.lg` as a margin — the heading and the cards as
 * `marginTop`, the rail's row between them. Blocks spaced by anything else would step the
 * page down as the data landed, which is the one thing a skeleton is for.
 */
const categoryStyles = StyleSheet.create({
	head: { paddingHorizontal: space.lg },
	rail: {
		flexDirection: "row",
		gap: space.sm,
		marginTop: space.lg,
		paddingHorizontal: space.lg,
	},
	// The children card between the rail and the button, at the screen's own `space.lg`.
	children: { marginTop: space.lg, paddingHorizontal: space.lg },
	childRows: { gap: TEXT_STACK_GAP },
	filters: { marginTop: space.lg, paddingHorizontal: space.lg },
	// Width only: it stands in for the "Filtros" label, whose length is not known until the
	// count of active filters is. The height is `Button`'s real box at the reader's text
	// scale — see `buttonHeight`, called from `CategorySkeleton` where `fontScale` is in scope.
	filterButton: { width: "45%" },
	cards: { marginTop: space.lg, paddingHorizontal: space.lg, gap: space.md },
});

/**
 * `app/cart`'s column, transcribed.
 *
 * The screen's scroll is a `space.lg` gutter with a `space.lg` gap between its blocks, so
 * this is that column — a skeleton that spaced itself with anything else would step the page
 * as the cart landed. The rest is the two boxes whose sizes the components above could not
 * hand over by being composed.
 */
const cartStyles = StyleSheet.create({
	body: { paddingHorizontal: space.lg, gap: space.lg },
	// The line card's two rows at `space.md` (`app/cart.tsx`'s `lineCard`).
	lineCard: { gap: space.md },
	line: { flexDirection: "row", alignItems: "center", gap: space.md },
	// The same 60pt picture `./product-row` draws, at the same corner
	// (`app/cart.tsx`'s `thumb`): it is the same photograph of the same product, and a different
	// box on the cart would read as a different kind of thing.
	thumb: { width: media.row, height: media.row },
	// `TEXT_STACK_GAP` and not `space.xs`: the name, the options and the notes are one text
	// stack (`app/cart.tsx`'s `lineBody`).
	lineBody: { flex: 1, gap: TEXT_STACK_GAP },
	// The line's figure and the control that moves it, at `space-between`
	// (`app/cart.tsx`'s `lineFoot`). The wrap is that row's own, for 200% text.
	lineFoot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		flexWrap: "wrap",
	},
	// A stand-in for `./quantity-stepper`'s row, and one of the two numbers in this file that
	// is restated rather than read: the stepper exports no width. Three touch-floor squares
	// and the two `space.md` gaps between them is that row, and its three controls are
	// `radius.full` — which is why the block is a pill and not a rectangle. If the stepper's
	// row changes, this is the line to change with it.
	stepper: {
		width: MIN_TOUCH_TARGET * 3 + space.md * 2,
		height: MIN_TOUCH_TARGET,
	},
	// `SummaryCard`'s own `rows`, at its own gap.
	receipt: { gap: space.sm },
	// `MoneyLine`'s row: label and amount on one baseline, one at each end.
	receiptRow: { flexDirection: "row", justifyContent: "space-between" },
});
