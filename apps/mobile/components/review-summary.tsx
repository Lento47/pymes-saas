import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { formatOneDecimal } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { icon, radius, space, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * What a shop's reviews add up to: one score, and how the scores were spread.
 *
 * This is the block under the "Reseñas" heading on a storefront, and it is the **shop's**
 * rating in every case: the public read it is fed from is keyed by `businessId`
 * (`apps/api/src/routers/reviews.ts` — `list: publicProcedure`, over `reviewListInput`,
 * which has no `productId`). A product page therefore cannot show these numbers as the
 * item's, and does not draw this block at all — it draws `./rating` from the product's own
 * `rating`/`reviewCount` columns and leaves the shop's reviews behind the shop control.
 * That is a boundary of the data, not of this file.
 *
 * ## The distribution is drawn from counts, or it is not drawn
 *
 * `distribution` is optional and the component renders the bars **only** when it is given.
 * That is not a convenience: a five-bar breakdown is the single most fabricated thing a
 * review block can contain, because it looks like data and nobody can check it. A shop with
 * a 4.6 average out of 200 reviews has an obvious-looking spread — mostly 5s, a few 4s, a
 * couple of 1s — and it is fiction unless somebody counted.
 *
 * Being *given* a spread is not the same as being given a counted one, which is why the bars
 * have a second condition: the buckets must add up to `count`. `./review-list` exports
 * `reviewDistribution(reviews, totalCount)` and it already refuses to build a spread unless
 * the rows on hand are all of them; this is the same promise kept from the other side, for
 * the caller that hands an array of its own. A first page of a paginated read summed against
 * the shop's `ratingCount` draws four short bars whose widths are relative to their own peak,
 * so it reads as a complete, quiet spread — a shape nobody can check and that contradicts the
 * number printed beside it.
 *
 * `businesses.bySlug` sends `ratingAvg` and `ratingCount` and no review rows, so the spread can
 * only come from the reviews read — and the one call site (`app/store/[slug].tsx`) does build
 * one: it passes `reviewDistribution(reviewItems, card?.ratingCount ?? 0)` as `distribution`.
 * The bars **are** drawn when that conversion yields a spread, which is exactly when the rows on
 * hand are all of them. What leaves the score and the real count behind it alone is a **partial**
 * page: a shop with more reviews than the storefront reads at a time (`REVIEW_PAGE_SIZE`), while
 * the reader has not yet paged through to the last one. `reviewDistribution` answers `undefined`
 * there and `rows` below is empty, so the bars wait on the read rather than on the caller — and
 * the prop is still the only thing that turns them on.
 *
 * The paragraph above used to say "today the one call site passes no `distribution` and no bars
 * are drawn": a fact about a different file, which that file changed without this one being
 * re-read. The drift is recorded here because it is the whole reason the sentence was wrong —
 * this component describes its caller, so it has to be re-read when the caller moves.
 *
 * ## No star row, on purpose
 *
 * Five stars filled to a rounded average is the other small lie: `Math.round(4.47)` is five
 * filled stars printed beside the number "4.5", which tells the reader the opposite of what
 * the number says, and `Math.floor` under-reports instead. Neither is a fact the API holds.
 * So the headline is what `./rating` draws everywhere else — one star as decoration beside a
 * number at the precision the average is stored at, and the count of rows behind it — and
 * the visual weight comes from the size of the number instead of from ink that is not data.
 *
 * ## Nothing at all, when there is nothing
 *
 * A shop nobody has reviewed says so, in the dictionary's words, rather than showing "0.0"
 * over five empty stars. The same rule `./rating` follows, and the same reason: a new shop
 * should look new rather than badly reviewed.
 */

type ReviewSummaryProps = {
	/** `ratingAvg`. `null` means nobody has rated this shop — which is not a zero. */
	average: number | null;
	/** `ratingCount` — the rows behind the average. */
	count: number;
	/**
	 * One entry per star value, from real counts. Omitted, no bars are drawn.
	 *
	 * `stars` is 5 down to 1; `count` is how many reviews gave that score. Order is the
	 * caller's — the component sorts, so a caller that reads them out of a map in any order
	 * still gets 5 at the top.
	 */
	distribution?: { stars: number; count: number }[];
};

export function ReviewSummary({
	average,
	count,
	distribution,
}: ReviewSummaryProps) {
	const { colors } = useTheme();
	const { t, tp, intlLocale } = useT();

	if (average === null || count < 1) {
		return (
			<Text variant="body" tone="muted">
				{t("store.reviews.empty")}
			</Text>
		);
	}

	const value = formatOneDecimal(average, intlLocale);

	// The longest bar is the biggest count, not the total: five bars at 20% each read as a
	// flat wall, and the shape of the spread is the thing this is drawn for.
	const sorted = distribution
		? [...distribution].sort((a, b) => b.stars - a.stars)
		: [];
	const peak = sorted.reduce((max, row) => Math.max(max, row.count), 0);
	// The buckets have to be the rows the headline is counting — see the docblock. `count` is
	// `ratingCount`, a count(*) over the same review rows the buckets would come from, so the
	// two agree exactly when the caller counted all of them.
	const counted = sorted.reduce((sum, row) => sum + row.count, 0);
	const rows = counted === count ? sorted : [];

	return (
		<View style={styles.block}>
			<View style={styles.head}>
				<Text variant="display" bold tabular>
					{value}
				</Text>
				<View style={styles.headInk}>
					<Text variant="label" tone="muted">
						{t("biz.reviews.average")}
					</Text>
					<View style={styles.countRow}>
						<Ionicons
							name="star"
							size={icon.inline}
							color={colors.rating}
							// Decoration around a number and a word; announced, it reads as an
							// unlabelled image before the score.
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="label" bold>
							{tp("store.rating.count", count)}
						</Text>
					</View>
				</View>
			</View>

			{rows.length > 0 && peak > 0 ? (
				<View style={styles.bars}>
					{rows.map((row) => (
						<View
							key={row.stars}
							style={styles.barRow}
							// The numbers on the row are three fragments; the sentence the dictionary
							// already holds is what a reader should hear instead — "12 de 5 estrellas".
							accessible
							accessibilityLabel={t("biz.reviews.breakdown", {
								count: row.count,
								stars: row.stars,
							})}
						>
							<Text variant="label" tabular tone="muted">
								{row.stars}
							</Text>
							<View style={[styles.track, { backgroundColor: colors.muted }]}>
								{/* The count is printed beside the bar, so the bar is never the only
								    signal — and a width is a shape, which survives a greyscale
								    screenshot where two ambers would not. */}
								<View
									style={[
										styles.fill,
										{
											backgroundColor: colors.rating,
											width: `${Math.round((row.count / peak) * 100)}%`,
										},
									]}
								/>
							</View>
							<Text
								variant="label"
								tabular
								tone="muted"
								style={styles.barCount}
							>
								{row.count}
							</Text>
						</View>
					))}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	block: { gap: space.md },
	head: { flexDirection: "row", alignItems: "center", gap: space.md },
	headInk: { gap: space.xs },
	countRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
	bars: { gap: space.xs },
	barRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
	// The track grows and the count does not: a long count ("1.204") must not squeeze the bar
	// it belongs to, and the bar is the part that is a proportion.
	track: {
		flex: 1,
		height: space.xs,
		borderRadius: radius.full,
		overflow: "hidden",
	},
	fill: { height: "100%", borderRadius: radius.full },
	barCount: { minWidth: space.huge, textAlign: "right" },
});
