import Ionicons from "@expo/vector-icons/Ionicons";
import type { Review } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { formatDay, formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { icon, media, radius, space, useTheme } from "@/theme";

import { AnimateIn } from "./animate-in";
import { Image } from "./image";
import { ListEnd } from "./list-end";
import { Text } from "./text";

/**
 * A shop's reviews, as rows — the list `./review-summary` is the sum of.
 *
 * `./review-summary` draws the average, the count behind it and, when somebody counted them,
 * the per-star spread. This file draws the rows those numbers are made of.
 *
 * ## It does not run the query — the screen does, and the reason is the sum
 *
 * The public read is `reviews.list` (`apps/api/src/routers/reviews.ts` — `list:
 * publicProcedure`, `.input(reviewListInput)`), and it answers a stranger: the `businessId` in
 * the input decides which shop is read, and the shop's own `status` is what makes that safe,
 * through the same `publicBusiness()` filter `products.list` applies to its catalogue. It is
 * also the procedure this component's one consumer calls (`app/store/[slug].tsx`,
 * `trpc.reviews.list.infiniteQueryOptions`), so a component that ran the query itself would
 * not 403 — legality is not the reason this file holds no query.
 *
 * The reason is that one page of rows has two readers on that screen. The rows are the list,
 * and they are also the input to `reviewDistribution`, whose answer decides whether
 * `./review-summary` may draw its five bars — and whether the rows in hand are *all* of them is
 * a fact about the query's pages rather than about any row in them. A component that owned its
 * own query could not answer that for the summary placed above it, so the screen holds the
 * query and the cursor and hands this file the page and its cursor state. `businesses.bySlug`,
 * which is what a storefront reads, still sends `ratingAvg` and `ratingCount` and no review
 * rows — that half was always true, and it is why `./review-summary` exists.
 *
 * **What these two paragraphs used to say, and how the wrong version survived.** It said the only
 * procedure answering with a page of reviews was `reviews.listForBusiness`
 * (`businessProcedure("orders:read")`), concluded that "there is no public list, so a customer
 * page cannot draw one", and cited `docs/api-surface.md` under "What the storefront wanted and
 * this surface does not have" — which is precisely where that absence used to be recorded.
 * That section now records the opposite: `reviews.list` is "that missing list: public, over the
 * same `reviewListInput` cursor its business-side sibling takes so one component pages both",
 * and the file's "Public" table lists it. `apps/api/src/routers/reviews.ts`'s own docblock says
 * `docs/api-surface.md` "used to record its absence as a missing procedure". Nothing in *this*
 * file changed when it did. The claim survived because it cited a different file for an API
 * shape: the pointer stayed plausible while its target was rewritten underneath it, so a reader
 * who followed it found the correction and a sentence above it still contradicting it. An API
 * shape is a fact about `apps/api`, and a sentence here that states one has to be re-read when
 * that file moves.
 *
 * The paging control is a **button**, not infinite scroll. A list that fetches by itself
 * spends a stranger's data allowance on a flick nobody asked it to act on, and it leaves the
 * reader nowhere to stop. The button is not drawn here: the foot is `./list-end`, which holds
 * the label the rest of the app's lists use and the sentence for a cursor that has run out,
 * so the menu above this list and the list itself cannot disagree about the control or about
 * whether there is more.
 *
 * ## The distribution, and the only condition under which it is real
 *
 * `./review-summary` draws its five bars **only** when it is handed a `distribution`, because
 * a spread that was not counted is the most believable lie a review block can contain. Pages
 * of a paginated read are not that set: `reviews.length` is the page size until the last page
 * has landed. `reviewDistribution` is therefore the conversion, and it returns `undefined`
 * unless it was handed *every* row — `reviews.length === totalCount`, where `totalCount` is
 * the shop's stored `ratingCount`, which `apps/api`'s `services/reviews.ts` rebuilds as
 * `count(*)` over the same `review` rows. Incomplete in, no bars out; the summary already
 * reads `undefined` as "do not draw them".
 *
 * ## Dates: a review is not a freshness line
 *
 * `createdAt` goes through `formatRelative`, which is the app's one relative-time formatter and
 * the one the design doc names. Its window is a day: past that it hands over to `formatClock`,
 * which prints an hour and a minute and no date (`lib/format.ts`, the `Math.abs(deltaMs) >=
 * DAY_MS` branch). That is right for the callers it was written for — a live order's
 * "Actualizado 2:30 p. m." — and wrong for a review that can be a year old, which would be
 * dated "2:30 p. m." and nothing else. So the row uses `formatRelative` inside its own window
 * and `formatDay` outside it, which is the same two functions composed rather than a third
 * formatter.
 *
 * `formatRelative` answers `null` when it has no truthful line to build — no
 * `Intl.RelativeTimeFormat` on the engine, or a timestamp it cannot parse — and `null` rendered
 * into a date slot prints the word "null". Every value here is checked and an absent line is
 * absent.
 *
 * ## What is deliberately not drawn
 *
 * `authorImage` is not rendered. It is nullable — the API falls back to `null` for a customer
 * who never set one, and it reads the same field Better Auth keeps — and no screen in this app
 * draws an avatar, so the honest version of this row is the author's name, the date and the
 * words. A column of grey circles standing in for the faces of people who never uploaded one is
 * decoration pretending to be data.
 *
 * The reply is drawn as a reply: a `muted` surface under the review, headed by the dictionary's
 * `store.reviews.reply` — "Respuesta del negocio" — because this is the customer's view of the
 * shop's answer. The owner's own board reads the other sentence (`biz.reviews.reply.yours`),
 * and a screen that reuses this list for that purpose needs the same component placed with the
 * owner's words, which is a change to this file rather than a prop.
 */

const STARS = 5;

/**
 * The five positions of a star row, 1 to 5.
 *
 * A row of stars is five fixed marks and its identity is the position, so the array is the
 * five positions rather than a `length` counted at the call site — a key off a map's index is
 * a key that moves when the list does, and these do not move because there are always five of
 * them.
 */
const STAR_POSITIONS = Array.from({ length: STARS }, (_, index) => index + 1);

const DAY_MS = 86_400_000;

type ReviewListProps = {
	/** The reviews loaded so far, newest first, in the order the API returned them. */
	reviews: Review[];
	/** `nextCursor !== null` for the last page — the API's own "there is more". */
	hasMore: boolean;
	/** `fetchNextPage`'s pending flag, so the button says it is working. */
	loadingMore?: boolean;
	onLoadMore: () => void;
};

export function ReviewList({
	reviews,
	hasMore,
	loadingMore = false,
	onLoadMore,
}: ReviewListProps) {
	// Nothing at all for an empty list, rather than a second sentence: `./review-summary` is
	// placed above this and already prints `store.reviews.empty` when there is nothing. Two
	// empty messages stacked is one too many.
	if (reviews.length === 0) return null;

	return (
		<View style={styles.list}>
			<View style={styles.rows}>
				{reviews.map((review, index) => (
					<AnimateIn key={review.id} index={index}>
						<ReviewRow review={review} last={index === reviews.length - 1} />
					</AnimateIn>
				))}
			</View>

			{/* `./list-end` draws the next page and the end of them, and holds both labels. This
			    list used to draw the button itself with `action.loadMore` while the storefront's
			    menu above it used the same key and `app/featured.tsx` used `order.loadMore` —
			    three callers, two words for one control — and none of the three drew anything
			    once the cursor ran out, so "that was everything" and "the next page never came"
			    were the same blank space. `reviews.length` is what is on screen; the early return
			    above is what keeps an empty list from ending in an end statement it has not
			    earned. */}
			<ListEnd
				rows={reviews.length}
				hasNextPage={hasMore}
				loading={loadingMore}
				onPress={onLoadMore}
			/>
		</View>
	);
}

/**
 * One review: who, when, how many stars, what they wrote, their pictures, the shop's answer.
 *
 * `last` suppresses the divider under the final row so the list does not end in a line with
 * nothing beneath it — the same `last` flag `./order-timeline` uses to drop its trailing
 * connector.
 */
function ReviewRow({ review, last }: { review: Review; last: boolean }) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	const photos = photosOf(review.imageUrls);
	const posted = reviewStamp(review.createdAt, intlLocale);
	// Only when the API sent a reply time. `repliedAt` is nullable and the reply is read from
	// the notification row it is stored in, so a missing one is a state, not an error.
	const answered = review.repliedAt
		? reviewStamp(review.repliedAt, intlLocale)
		: null;

	return (
		<View
			style={[
				styles.row,
				last
					? null
					: {
							borderBottomColor: colors.border,
							borderBottomWidth: StyleSheet.hairlineWidth,
						},
			]}
		>
			<View style={styles.head}>
				<Text variant="body" bold>
					{review.authorName}
				</Text>
				{posted ? (
					<Text variant="caption" tone="muted">
						{posted}
					</Text>
				) : null}
			</View>

			{/*
			 * The star row is one accessible element with the sentence the dictionary already
			 * holds — `review.stars`, "{count} de {stars} estrellas" — because five glyphs
			 * read one at a time say "star, star, star" and never the number. Filled against
			 * outlined is a shape, so the row still says its rating with the amber gone, which
			 * is the half of the rule a tint could not carry.
			 */}
			<View
				style={styles.stars}
				accessible
				accessibilityLabel={t("review.stars", {
					count: review.rating,
					stars: STARS,
				})}
			>
				{STAR_POSITIONS.map((position) => (
					<Ionicons
						key={position}
						name={position <= review.rating ? "star" : "star-outline"}
						size={icon.inline}
						color={colors.rating}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				))}
			</View>

			{/* The whole comment, never a truncated one: `numberOfLines` is for data that is
			    meant to be cut off, and a review the reader cannot finish reading is not that. */}
			{review.comment ? <Text variant="body">{review.comment}</Text> : null}

			{photos.length > 0 ? (
				<View style={styles.photos}>
					{photos.map((uri) => (
						<Image
							// The picture is the row's identity here — these are the reviewer's own
							// URLs, read once and never reordered — and that is only a key once the
							// duplicates `photosOf` removes are gone.
							key={uri}
							uri={uri}
							style={styles.photo}
							// Decoration, exactly as the product thumbnail in `./product-row` and the
							// hero on a product page are: every picture here sits beside the review
							// that describes it, and an unlabelled image announced before each one
							// would be four interruptions on a row whose content is the sentence.
							// Both props, because they are one platform each and `./image` spreads
							// them onto its box rather than onto the picture: `accessibilityElementsHidden`
							// is iOS's, `importantForAccessibility` is Android's (RN 0.86.3's
							// `AccessibilityProps`, `ViewAccessibility.d.ts:128` and `:182`).
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					))}
				</View>
			) : null}

			{review.reply ? (
				<View style={[styles.reply, { backgroundColor: colors.muted }]}>
					<View style={styles.head}>
						<Text variant="label" bold>
							{t("store.reviews.reply")}
						</Text>
						{answered ? (
							<Text variant="caption" tone="muted">
								{answered}
							</Text>
						) : null}
					</View>
					<Text variant="body">{review.reply}</Text>
				</View>
			) : null}
		</View>
	);
}

/**
 * The per-star counts a `./review-summary` may draw its bars from — or `undefined`.
 *
 * `undefined` is the answer in every case where the rows handed in are not all of them, which
 * is the only case that matters: a distribution over one page of a paginated read is a spread
 * nobody counted, drawn in the one place on a shop page that looks most like evidence. The
 * guard is `reviews.length === totalCount` rather than a flag, so a caller cannot turn the bars
 * on by asserting they should be on, and `totalCount < 1` is `undefined` too — no reviews is
 * the summary's own empty sentence, not five empty bars.
 *
 * `totalCount` is the shop's stored `ratingCount` (`businessCardSchema.ratingCount`), which
 * `apps/api`'s `services/reviews.ts` rebuilds from the same `review` rows this list pages
 * through, so the two numbers are the same set counted twice.
 *
 * All five buckets come back, zeroes included. Dropping the empty ones would make "nobody gave
 * this one star" indistinguishable from "the caller did not count one-stars", and a zero with a
 * number beside it is a fact where a missing bar is a silence.
 */
export function reviewDistribution(
	reviews: readonly { rating: number }[],
	totalCount: number,
): { stars: number; count: number }[] | undefined {
	if (totalCount < 1 || reviews.length !== totalCount) return undefined;

	const counted = new Map<number, number>();
	for (const review of reviews) {
		counted.set(review.rating, (counted.get(review.rating) ?? 0) + 1);
	}

	return Array.from({ length: STARS }, (_, index) => STARS - index).map(
		(stars) => ({ stars, count: counted.get(stars) ?? 0 }),
	);
}

/**
 * A review's pictures, without duplicates — and why that is the fix rather than an index key.
 *
 * `createReviewInput.imageUrls` is `z.array(z.string()).max(4)`: it caps the count and says
 * nothing about the entries being distinct, so the same URL twice in one review passes
 * validation. Two siblings under `key={uri}` are then a duplicate React key, which is the defect
 * the schema permits. The array is the reviewer's own, is read once and is never reordered, so
 * the URL really is each picture's identity — the fix is to make the key true rather than to
 * replace it with a position, which is the thing `STAR_POSITIONS` above argues against. Keeping
 * the first occurrence is `./gallery`'s rule for the same reason, applied to a review's own
 * array instead of to a cover that is also listed among the photographs.
 *
 * **Empty on every row the API can return today, and that is worth stating rather than
 * assuming.** The `review` table has no image column (`packages/db/src/schema.ts`), the write in
 * `apps/api`'s `services/reviews.ts` never stores the URLs the input accepted, and `reviewOf`
 * answers `imageUrls: []` — deliberately, so a client does not believe a re-read would return
 * them. The web review form says the same from the other side: it omits `imageUrls` because R2
 * is unbound and there is nowhere to put an upload. So this block draws nothing in the app as it
 * stands, and the dedupe below is latent rather than visible. It stays because `imageUrls` is a
 * field of `reviewSchema` and the day the column lands this is where it draws.
 */
function photosOf(imageUrls: readonly string[]): string[] {
	return [...new Set(imageUrls)];
}

/**
 * When a review was written, in the reader's own convention — or nothing.
 *
 * Inside a day it is `formatRelative`'s sentence ("hace 3 h"); past that it is
 * `formatDay`'s date, because `formatRelative` hands over to `formatClock` there and a clock
 * time on its own dates a review from last March as "2:30 p. m.". See the docblock at the top
 * of this file, and `lib/format.ts` for why the hand-over exists.
 *
 * Both the unparseable case and the missing formatter arrive as `null` rather than as a
 * placeholder: an absent line is the only honest rendering of a date nothing can read.
 * `formatDay` is wrapped because it constructs an `Intl.DateTimeFormat` and throws on a
 * structurally invalid tag — the same reason `lib/format.ts` wraps its own fallback.
 */
function reviewStamp(value: Date, intlLocale: string): string | null {
	const at = value.getTime();
	if (!Number.isFinite(at)) return null;

	if (Math.abs(Date.now() - at) < DAY_MS) {
		const relative = formatRelative(value, intlLocale);
		if (relative !== null) return relative;
	}

	try {
		return formatDay(value, intlLocale);
	} catch {
		return null;
	}
}

const styles = StyleSheet.create({
	// The gap between two reviews is the section gap the page uses between its blocks: a
	// review is a block, and the divider under it is what says so at a glance.
	list: { gap: space.lg },
	// The rows pay the page's own gutter and the foot pays its own: `./list-end` carries a
	// `space.lg` inset of its own, so a gutter on this list as well would draw the button a
	// step narrower than the reviews it is under. The block that places this list
	// (`app/store/[slug].tsx`) pays no gutter for the same reason, which is why the padding is
	// here rather than there.
	rows: { paddingHorizontal: space.lg, gap: space.lg },
	// `space.sm`, and not `TEXT_STACK_GAP`: the 2pt step is the gap inside one text stack, and
	// the name, the stars, the words, the pictures and the answer are five separate things
	// rather than five lines of one.
	row: { gap: space.sm, paddingBottom: space.md },
	// The name and the date are one line until 200% text makes them two, which is why this
	// wraps rather than truncating either: the name is the author and the date is the fact
	// that keeps a review in its place in the list.
	head: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.sm,
		flexWrap: "wrap",
	},
	stars: { flexDirection: "row", alignItems: "center", gap: space.xs },
	photos: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	// `media.card`'s 56, and the token file names that box as something else: "./business-card's
	// logo — the same box as `cardStyles.logo` in `./skeletons`". A review's picture is a
	// thumbnail — up to four of them (`createReviewInput` caps `imageUrls` at four), read as
	// "which photos did they attach" rather than as photographs — and it is not one of
	// `media`'s three densities (56 a feed logo, 60 a menu row's thumbnail, 64 a storefront
	// logo), so this box is coupled to the feed logo and `./skeletons` has no review block to
	// keep it in step. It is written down instead of hidden because the fix is not in this file:
	// a `media` step named for review photography is a `theme/tokens.ts` change, and that file
	// is not this one's to extend. 56 stays the value either way — a bare number here would be
	// the same box with the token file's rule broken and no record of why.
	photo: { width: media.card, height: media.card },
	// The answer is a surface of its own inside the review, so its heading and its words are
	// separated by the same step the review's own parts are.
	reply: { borderRadius: radius.md, padding: space.md, gap: space.sm },
});
