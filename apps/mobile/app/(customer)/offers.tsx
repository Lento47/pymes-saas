import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PaginatedList } from "@/components/paginated-list";
import { ProductTile } from "@/components/product-tile";
import { Screen } from "@/components/screen";
import { useSkeletonHold } from "@/components/skeleton";
import { ProductGridSkeleton } from "@/components/skeletons";
import { Text } from "@/components/text";
import { chunkPairs } from "@/lib/chunk-pairs";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * The marketplace's marked-down products, two up.
 *
 * `catalog.feed` already draws an "Ofertas" rail, and it caps it at twelve
 * (`FEED_OFFER_LIMIT`, `packages/trpc-api/src/services/catalog.ts`) — so the twelfth offer
 * was the last a customer could reach with no filter loop, and the section had nowhere to
 * send a "Ver todo" that meant *offers* specifically. This is the screen that rail promised:
 * `products.list` with `onSaleOnly: true`, the same two conditions the rail filters with
 * (`compareAtPriceMinor` present and above `priceMinor`), paged by `nextCursor`.
 *
 * The two share an ordering on purpose, and that shared choice is *most sold first*, not
 * deepest cut first. A depth is a ratio, and a cursor page cannot order by one — the
 * service re-derives a page's boundary as `column < v OR (column = v AND id > id)` from a
 * value it reads off a row, and two equally-deep cuts can differ in the last bit of a
 * float. The rail never pages (it takes twelve), which is the only reason the ratio
 * ordering was ever safe. Both lists now order by the column that already means
 * `relevance` (`soldCount`), and `test/feed-offers.test.ts` pins them matching so the
 * next sort moves both or neither. See that file for the shape of the drift this guards.
 *
 * ## Two up, because the web grid is
 *
 * The featured page makes the same Rule 3 argument and lands on the same grid shape —
 * see `app/(customer)/featured.tsx`'s docblock rather than duplicating it. The pairs of
 * tiles go to `./paginated-list` for the same reason: a `FlatList`'s own `numColumns`
 * stretches the one odd trailing tile across the row, which the lone empty sibling
 * `featured.tsx` leaves behind to absorb. Both screens chunk through `lib/chunk-pairs`.
 *
 * ## The transport cut the filter off too early — and how this screen refuses to serve it
 *
 * `productListInput` strips an unknown key rather than rejecting it, so a build that
 * lands in the store before the API grew `onSaleOnly` sends the request and **gets every
 * product back** instead of a 400 — the page would happily render the whole catalogue
 * under the word "Ofertas". A plausible-looking wrong list is worse than an error, so the
 * first thing the rows are measured against is the one field only a real offer carries:
 * `discountPercent` is non-null and above zero. A list that fails that is rendered as an
 * error, not as offers.
 *
 * ## What the tile does not print
 *
 * `productCardSchema.badges[].label` is server copy — a formatted string with no key
 * behind it, and `docs/design-mobile.md` forbids drawing words no locale can change. The
 * tile reads `product.discount`'s `{percent}` for its own discount badge and drops the
 * server's label; the rest of the section is the same refusal `featured.tsx` makes.
 */
export default function Offers() {
	const trpc = useTRPC();
	const { t } = useT();

	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			// `sortDirection` unset: `products.list` defaults to `desc`, and the schema names
			// that field `sortDirection` rather than `direction` because
			// `@trpc/tanstack-react-query` writes its own `direction` into the infinite-query
			// input. See `feed-sort.test.ts` for the full history of that reserved key.
			{ onSaleOnly: true, limit: PAGE_SIZE },
			{ getNextPageParam: (last) => last.nextCursor ?? undefined },
		),
	);

	const waiting = useSkeletonHold(products.isPending);

	/**
	 * The rows, filtered once: any page that is not an offer list (an unfiltered response
	 * from an older API, or a page whose only payload is the not-really-a-discount row)
	 * is treated as a failed read rather than rendered.
	 */
	const items = useMemo(
		() =>
			(products.data?.pages.flatMap((page) => page.items) ?? []).filter(
				(product) =>
					product.discountPercent !== null && product.discountPercent > 0,
			),
		[products.data],
	);
	const rows = useMemo(() => chunkPairs(items), [items]);

	const refused =
		!waiting &&
		!products.isError &&
		products.data !== undefined &&
		items.length === 0;

	// Nothing is drawn under the skeleton or under a failure — the same contract
	// `featured.tsx` owns. A screen that renders a row mid-skeleton would be the skeleton
	// and the content disagreeing about what is on screen.
	const shown = waiting || products.isError || refused ? [] : rows;

	return (
		// `contentStyle` gives the body the height `./paginated-list`'s `flex: 1` grows
		// into. Same contract as `featured.tsx`.
		<Screen padded={false} bottomInset contentStyle={styles.fill}>
			<PaginatedList
				data={shown}
				keyExtractor={(pair) => pair[0].id}
				renderItem={(pair, row) => (
					<View style={styles.row}>
						{pair.map((product, column) => (
							<ProductTile
								key={product.id}
								index={row * 2 + column}
								style={styles.tile}
								product={product}
							/>
						))}
						{pair.length === 1 ? <View style={styles.tile} /> : null}
					</View>
				)}
				header={
					<View style={styles.header}>
						<View style={styles.pad}>
							<BackButton to="/" />
						</View>

						<View style={styles.pad}>
							<Text variant="title" bold>
								{t("home.offers")}
							</Text>
						</View>

						{products.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={products.error}
									onRetry={() => void products.refetch()}
								/>
							</View>
						) : refused ? (
							<View style={styles.pad}>
								<ErrorState
									error={new Error("offers list without discounts")}
									onRetry={() => void products.refetch()}
									body={t("home.offers.stale")}
								/>
							</View>
						) : waiting || !products.data ? (
							<ProductGridSkeleton />
						) : items.length === 0 ? (
							<View style={styles.pad}>
								<EmptyState
									icon="pricetags-outline"
									title={t("home.offers.empty.title")}
									body={t("home.offers.empty.body")}
								/>
							</View>
						) : null}
					</View>
				}
				hasNextPage={products.hasNextPage}
				loadingMore={products.isFetchingNextPage}
				onLoadMore={() => void products.fetchNextPage()}
				onRefresh={() => products.refetch()}
			/>
		</Screen>
	);
}

const PAGE_SIZE = 20;

const styles = StyleSheet.create({
	// The body's height, which `./paginated-list`'s `flex: 1` needs. See that file.
	fill: { flex: 1 },
	pad: { paddingHorizontal: space.lg },
	// The back button, the heading and whichever of the error, skeleton or empty block is
	// standing in for the rows are one column, with the gap the scroll used to pay between
	// them. The gutter, the gap down to the first row and the foot are
	// `./paginated-list`'s.
	header: { gap: space.lg },
	row: { flexDirection: "row", gap: space.md },
	// Half a row, and the same flex story `featured.tsx` gives its own tiles.
	tile: { flex: 1 },
});
