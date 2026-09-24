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
 * The marketplace's featured products, two up.
 *
 * `catalog.feed` already draws a "Recomendados" section, and it caps it at twelve
 * (`FEED_FEATURED_LIMIT`, `apps/api/src/services/catalog.ts`) — so the twelfth product was
 * the last one a customer could reach, and the section's "Ver todo" had nowhere to send
 * them that was about *featured products* specifically. This is the screen that section
 * promised: `products.list` with `featuredOnly: true`, which the service honours as
 * `eq(productTable.isFeatured, true)` (`apps/api/src/services/products.ts:172`), paged by
 * `nextCursor`.
 *
 * ## Two up, because the web grid is
 *
 * `docs/design-mobile.md`'s Rule 3 names this shape itself — "product imagery may be composed
 * with at a gallery's confidence — a pager with dots on the product screen, image rows in a
 * menu, **a 2-up grid for a featured section**" — and `apps/web/components/catalog/product-grid.tsx:42`
 * is `grid-cols-2` at the narrowest breakpoint and three columns above it, so "two up" is not a
 * phone-shaped compromise this screen invented: it is the same grid at the width this device
 * has, and the screen the rule was written for. `./product-row` is the
 * other shape the app has and it is deliberately the wrong one here: a row is a *menu*, one
 * shop's items in the order that shop sells them, and this is a shelf of products from
 * different shops. A list of rows would read as one shop's catalogue with the seller line
 * doing all the work of saying otherwise.
 *
 * The grid is chunked into pairs and each pair is a `flexDirection: "row"` of two `flex: 1`
 * tiles rather than one wrapped container of percentage widths, for two reasons that both
 * bite at 200% text: a wrapped row would leave the odd last tile stretched across the full
 * width, and the row's default `alignItems: "stretch"` gives both tiles the taller one's
 * height when a title is longer than its neighbour. The chunking itself is `lib/chunk-pairs` —
 * `app/categories` is the app's other 2-up grid and reads the same function, so the two cannot
 * disagree about what a half-row is. That second one needs `flex: 1` on the
 * `Card` itself and not only on the animated wrapper around it — `./product-tile` owns that
 * note, and this screen only supplies the `flex: 1` that lands on both —
 * because the wrapper is a column and stretches nothing vertically inside itself. A lone
 * trailing tile gets an empty `flex: 1` sibling, so it keeps the half-width it would have
 * had in a full row.
 *
 * The scroller is `./paginated-list`, and it is handed those **pairs** rather than the tiles
 * for the first of the two reasons above: a `FlatList`'s own `numColumns` stretches the lone
 * tile of an odd page across the row, which is exactly what the empty sibling prevents. The
 * pairs are built in a memo, because a `FlatList` compares the `data` array's identity and a
 * new array per render would re-render every row it holds.
 *
 * ## What the tile refuses to print
 *
 * `productCardSchema.badges` is a list of `{type, label}` and the `label` is **server copy**
 * — a string from the database with no key behind it, which is the one thing `docs/design-mobile.md`
 * forbids a screen to draw: nothing in this app hardcodes its own language, and a badge that
 * arrives pre-translated from a row is a string no locale can change. So the discount is
 * drawn from `discountPercent`, which the schema documents as derived rather than stored,
 * through `product.discount` — the dictionary key that already takes `{percent}` — and every
 * other badge type (`new`, `popular`, `shipping`, `custom`) is dropped rather than rendered
 * in a language the reader did not choose. Reported, not silently ignored.
 *
 * Sold out is the same sentence `./product-row` draws, from the same field: `availability`
 * is `availabilityOf`'s answer, computed once on the API and rendered by both clients, and
 * `product.soldOut` is the word for it. The tile is **not** dimmed and the price is not
 * hidden — a product you cannot buy today is still a product you came to look at, and the
 * same line `./business-card` draws for a closed shop.
 *
 * ## The image is the crop the detail page opens with
 *
 * `app/product/[id]`'s hero is `{ width: "100%", aspectRatio: 4 / 3 }` and
 * `./skeletons`' `ProductDetailSkeleton` restates the same ratio, so the tile's photograph
 * is the same crop shape the detail page opens with — the customer recognises the picture
 * they tapped. `aspectRatio` rather than a height in points because a tile's width is a
 * function of the device, and a fixed height would letterbox one and crop the other.
 *
 * A product with no `imageUrl` gets its own initial in the box `./image` already reserves, at
 * 22 — a picture-stand-in rather than a role, which is why it is not from the `icon` scale:
 * `theme/tokens.ts:208-211` names these sizes and says they are "sized where they are used"
 * (22 for a media box's stand-in, 22 for the heart, 26 on a storefront) because the mark takes
 * the photograph's *place* inside the box rather than being sized to fill it. `./product-tile`
 * draws the product's own initial for the same reason `./product-row` does, and
 * `./business-card` draws its missing-logo fallback the same way.
 */
export default function Featured() {
	const trpc = useTRPC();
	const { t } = useT();

	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			// `sortDirection` is deliberately left alone: `products.list` defaults to `desc`,
			// and the schema names the field `sortDirection` rather than `direction` because
			// `@trpc/tanstack-react-query` writes its own `direction` into infinite-query input.
			{ featuredOnly: true, limit: PAGE_SIZE },
			{ getNextPageParam: (last) => last.nextCursor ?? undefined },
		),
	);

	const waiting = useSkeletonHold(products.isPending);

	/**
	 * The products, and the rows they are drawn on.
	 *
	 * Two memos where the old `.map()` needed none, and it is the list that needs them:
	 * `pages.flatMap` and `chunkPairs` each build a new array on every render, and a `FlatList`
	 * handed a new `data` array re-renders every row it is holding — so the virtualisation
	 * would be paid for and then spent again on every keystroke-free re-render of this screen.
	 * Each memo depends on the value the one before it derives from, and the first depends on
	 * the query's own cached `data`, which is stable between reads.
	 */
	const items = useMemo(
		() => products.data?.pages.flatMap((page) => page.items) ?? [],
		[products.data],
	);
	const rows = useMemo(() => chunkPairs(items), [items]);

	// Nothing is drawn under the skeleton or under a failure. `waiting` holds the skeleton up
	// past the arrival of the answer on purpose, so a row appearing in that window would be
	// the skeleton and the content disagreeing about what is on screen.
	const shown = waiting || products.isError || items.length === 0 ? [] : rows;

	// Back, or the feed for a link opened cold — `lib/leave` owns the pair.

	return (
		// `contentStyle` gives the body the height `./paginated-list`'s `flex: 1` grows into.
		<Screen padded={false} bottomInset contentStyle={styles.fill}>
			<PaginatedList
				// The rows, not the tiles, and that is what keeps the grid's one layout rule: a
				// `numColumns={2}` list stretches the lone trailing tile of an odd page across
				// the full width, which is the defect `lib/chunk-pairs` exists to prevent — so
				// the pairs are built here and the list is handed one row per item.
				data={shown}
				// The row's first tile names the row, which is the key the pair had when this
				// was a column of `View`s; the tuple type is what makes `pair[0]` exist.
				keyExtractor={(pair) => pair[0].id}
				renderItem={(pair, row) => (
					<View style={styles.row}>
						{pair.map((product, column) => (
							<ProductTile
								key={product.id}
								product={product}
								// The stagger counts tiles, not rows: two that appear
								// together in a row arriving 40ms apart is the shelf being
								// laid out rather than a row snapping in.
								index={row * 2 + column}
								// Half a row, and the same style the empty sibling below pays.
								style={styles.tile}
							/>
						))}
						{/* A lone last tile keeps half the row, so the odd page does not end
						    with one product stretched edge to edge. */}
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
								{t("home.featured")}
							</Text>
						</View>

						{products.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={products.error}
									onRetry={() => void products.refetch()}
								/>
							</View>
						) : waiting || !products.data ? (
							<ProductGridSkeleton />
						) : items.length === 0 ? (
							<View style={styles.pad}>
								<EmptyState
									icon="sparkles-outline"
									title={t("home.featured.empty.title")}
									body={t("home.featured.empty.body")}
								/>
							</View>
						) : null}
					</View>
				}
				hasNextPage={products.hasNextPage}
				loadingMore={products.isFetchingNextPage}
				onLoadMore={() => void products.fetchNextPage()}
				// The pull, with its flag inside `./paginated-list`: a query also refetches when
				// nobody pulled, and a spinner under a thumb that arrived without a gesture
				// claims credit for a request the reader did not make.
				onRefresh={() => products.refetch()}
			/>
		</Screen>
	);
}

/**
 * One product, half a row.
 *
 * `./product-tile` is the surface and this is the width: `flex: 1` and no fixed width, so
 * the two tiles of a row divide whatever the device gives them, and the same `flex: 1` goes
 * on the `Card` inside — which is what makes the shorter of two tiles match the taller. The
 * row's default `stretch` reaches the animated wrapper, and the wrapper is a column whose
 * cross axis is horizontal, so the growth has to be asked for once more by the surface that
 * shows it. The primitive takes the style for exactly this reason; the home feed's offers
 * rail passes a fixed width instead and gets a tile that scrolls.
 */

/*
 * The grid's wait is `ProductGridSkeleton` from `./skeletons` now. This file used to build its
 * own inside a `GridSkeleton()` — the docblock that stood here said the honest home for it was
 * beside `ProductRowsSkeleton`, and it is: the block moved, wrapped each tile in the `Card` the
 * real tile has, and clamps nothing (nothing in `apps/mobile` caps text scaling, so a clamped
 * line height would silently under-draw above 200%). What stayed
 * here are the widths and the photo ratio for the *real* tile, which are the tile's own.
 */

/**
 * Twenty, which is `productListInput.limit`'s own default and `app/category/[slug]`'s page.
 * Two tiles to a row puts ten rows in the first page, which is more than a thumb will scroll
 * before deciding — and the second page is behind a button rather than a scroll trigger.
 */
const PAGE_SIZE = 20;

const styles = StyleSheet.create({
	// The body's height, which `./paginated-list`'s `flex: 1` needs. See that file.
	fill: { flex: 1 },
	pad: { paddingHorizontal: space.lg },
	// The back button, the heading and whichever of the error, skeleton or empty block is
	// standing in for the rows are one column, with the gap the scroll used to pay between
	// them. The gutter, the gap down to the first row and the foot are `./paginated-list`'s.
	header: { gap: space.lg },
	row: { flexDirection: "row", gap: space.md },
	// Half a row. The stack's gap, the photo's ratio and the chip went to `./product-tile`
	// with the surface that pays them.
	tile: { flex: 1 },
});
