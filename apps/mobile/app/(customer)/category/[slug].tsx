import { localizedName } from "@pymeshub/i18n";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { BusinessCard } from "@/components/business-card";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { CategoryRail } from "@/components/category-rail";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
	activeFilterCount,
	DEFAULT_BUSINESS_FILTERS,
	effectiveBusinessFilters,
	FilterSheet,
} from "@/components/filter-sheet";
import { ListRow } from "@/components/list-row";
import { PaginatedList } from "@/components/paginated-list";
import { Screen } from "@/components/screen";
import { useSkeletonHold } from "@/components/skeleton";
import {
	BusinessCardsSkeleton,
	CategorySkeleton,
} from "@/components/skeletons";
import { Text } from "@/components/text";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * One category's shops — the screen a category chip opens.
 *
 * `apps/web/app/(shop)/category/[slug]/page.tsx` is the model, and the data path is the
 * same one: the slug has to be resolved to an id first, because `businesses.list` filters
 * on `categoryId` and nothing else on this screen carries one. That one extra read also
 * gives this screen the rest of the rail to scroll through, and the children of the sector
 * it resolved, so the resolution is not a request spent on a redirect.
 *
 * `catalog.categories` is the authority on which slugs exist, so a slug that matches
 * nothing is answered honestly — "we don't have that category", with the way back — rather
 * than as an empty list of shops under a heading nobody can act on. The two look alike on
 * a phone and they mean opposite things: one is a category with no shops in it right now,
 * the other is a link that is simply wrong.
 *
 * ## The filters live here, and nowhere else in discovery
 *
 * This is the only screen in the browse surface that reads a filterable list.
 * `businesses.list` takes `openNow`, `deliveryOnly`, `radiusKm` and `sort`, and
 * `apps/api/src/services/businesses.ts` was read to confirm each one reaches the query;
 * `catalog.search` takes `{q, lat?, lng?}` and no filters at all, so a filter control on the
 * search screen could only ever be a lie. `./filter-sheet` holds the controls and this
 * screen holds the state, which is what makes the list behind the sheet already filtered
 * when it closes — there is no apply step to forget.
 *
 * The web page asks for `sort: "rating"` because it has no coordinate: without one,
 * `businesses.list` degrades distance to rating anyway, and asking for it explicitly keeps
 * one ordering instead of two. This screen *does* have a coordinate — `useDeviceLocation`
 * is the same hook the search screen uses — so "distance" is a real answer here and the
 * list is nearest-first. Without permission the degradation is the API's, and
 * `effectiveBusinessFilters` is what keeps the control and the badge telling the truth about
 * it: see the note in `./filter-sheet`.
 *
 * `filters` is screen state rather than a param or a store, so leaving the category and
 * coming back starts clean. That is deliberate for now and worth naming: a customer who
 * filtered to "abierto ahora" and taps a different chip in the rail gets an unfiltered list,
 * because nothing in the app remembers a filter across a navigation. The alternative —
 * carrying it — needs a home that outlives the screen, and inventing one here would make
 * this file the owner of a decision three screens share.
 *
 * ## Two waits, drawn differently
 *
 * The name and the rail come from one read and the shops from another, and they are waited
 * for separately. Before `catalog.categories` answers, `CategorySkeleton` stands in for the
 * whole page. Once it has, the heading and the rail are *real* — and the rail is usable, so
 * a reader who landed on the wrong category can leave without waiting for a list they did
 * not want — while only the column of cards is grey. Replacing real content with a skeleton
 * is a step backwards the reader can see.
 *
 * ## No count line
 *
 * `businesses.list` returns a page and a cursor, and no total. A number under the heading
 * would therefore be the length of what has loaded, not how many shops there are — the
 * defect the search screen's count sentence was rewritten to stop telling. The list says
 * what it holds by holding it.
 *
 * ## The way out of the end of the list
 *
 * `businesses.list` is cursor-paginated and every cursor-paginated list on the customer's
 * side ends the same way: `./list-end` — the next page, and then the sentence that says the
 * list is over. This screen used to draw the button itself and nothing after it, which is
 * the pair of situations the sentence exists to tell apart: "that was everything" and "the
 * next page never came" were the same blank space. The foot is now `./paginated-list`'s,
 * which holds that component, so this screen and `app/nearby` and `app/featured` cannot draw
 * it three ways. `useInfiniteQuery` with `getNextPageParam` reading `nextCursor` is
 * `app/store/[slug]`'s idiom, and the web page's `?cursor=` link is the same page in the only
 * shape a browser has; a phone has no URL to put it in.
 *
 * ## The scroller and the pull
 *
 * A list whose data can change while it is on screen answers a pull
 * (`docs/design-mobile.md`'s Rule 6), and `Screen`'s own `onRefresh` is a pass-through to the
 * `ScrollView` it owns and **only** that one (`components/screen.tsx:80-84`), so a screen that
 * brings its own scroller calls `useRefreshControl` itself. This one brings `./paginated-list`:
 * a `FlatList` rather than the `ScrollView` it replaces, because twenty shops a page is
 * unbounded, and that component holds the pull's `refreshing` flag as its own state rather than
 * reading `isRefetching`, for the reason the feed gives — a query also refetches when nobody
 * pulled, a remount or a stale window, and a spinner appearing under a thumb without a gesture
 * claims credit for a request the reader did not make.
 *
 * Both reads are refetched, not just the shops: the heading and the rail are half of what
 * the page is showing, and a pull that moved the list while leaving a failed
 * `catalog.categories` broken would answer for one of the two.
 */
export default function Category() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const trpc = useTRPC();
	const { t, tp, locale } = useT();
	const { coords } = useDeviceLocation();

	const categories = useQuery(trpc.catalog.categories.queryOptions());
	const category = categories.data?.find((entry) => entry.slug === slug);

	/*
	 * The taxonomy's second level, on the page that owns the first.
	 *
	 * This is the whole reason the block below is drawn rather than left out as scope: a
	 * sector's own shop list filters on `categoryId` exactly (`businesses.list`,
	 * `apps/api/src/services/businesses.ts:279`), so a shop filed under a child does not
	 * appear on its sector's page. Without these rows the 224 child categories have no door
	 * anywhere in the app — they are not in the rail, not in the grid, and each has shops
	 * behind it. So the children are drawn here, on the parent they belong to, and each row
	 * opens its own page.
	 */
	const children = (categories.data ?? []).filter(
		(entry) => entry.parentId === category?.id,
	);

	/*
	 * A child's page is inside its sector, so the rail marks the sector rather than
	 * nothing at all: a rail with no selected chip on a page that plainly is a category
	 * says the reader is nowhere.
	 */
	const parent = categories.data?.find(
		(entry) => entry.id === category?.parentId,
	);

	// The rail draws the first level here too — see `./category-rail`'s "a rail draws one
	// level, and the caller says which". The children are the block below, which is a
	// stacked list with room for a count and a chevron; a strip is not.
	const sectors = (categories.data ?? []).filter(
		(entry) => entry.parentId === null,
	);

	const [filters, setFilters] = useState(DEFAULT_BUSINESS_FILTERS);
	const [filtersOpen, setFiltersOpen] = useState(false);

	const hasLocation = coords !== null;
	// What the request is allowed to say, and the same object the sheet's controls and the
	// button's badge read — so the count on the button is a count of what the query below is
	// actually doing. See `./filter-sheet`.
	const effective = effectiveBusinessFilters(filters, hasLocation);
	const active = activeFilterCount(filters, hasLocation);

	const shops = useInfiniteQuery(
		trpc.businesses.list.infiniteQueryOptions(
			{
				categoryId: category?.id,
				lat: coords?.lat,
				lng: coords?.lng,
				openNow: effective.openNow,
				deliveryOnly: effective.deliveryOnly,
				radiusKm: effective.radiusKm,
				sort: effective.sort,
				limit: PAGE_SIZE,
			},
			{
				// Nothing to ask for until the slug has resolved to an id: an unfiltered
				// `businesses.list` would be every shop on the marketplace under this
				// category's name, which is a worse answer than a skeleton.
				enabled: !!category,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);

	const waitingForCategories = useSkeletonHold(categories.isPending);
	const waitingForShops = useSkeletonHold(shops.isPending);

	// Memoised because a `FlatList` compares the `data` array's identity: `pages.flatMap`
	// builds a new one on every render, and a list handed a new array re-renders every row it
	// is holding — which is the work virtualising the list was meant to save. The dependency
	// is the query's own cached `data`, which is stable between reads.
	const items = useMemo(
		() => shops.data?.pages.flatMap((page) => page.items) ?? [],
		[shops.data],
	);

	// Nothing under the skeleton or under a failure: `waitingForShops` holds the skeleton up
	// past the arrival of the answer on purpose, so a row appearing in that window would be
	// the skeleton and the content disagreeing about what is on screen.
	const shown =
		waitingForShops || shops.isError || items.length === 0 ? [] : items;

	// Back, or the feed for a link opened cold — `lib/leave` owns the pair, and why the
	// fallback is an argument rather than a default.

	return (
		<>
			{/* `contentStyle` gives the body the height `./paginated-list`'s `flex: 1` grows into. */}
			<Screen padded={false} bottomInset contentStyle={styles.fill}>
				<PaginatedList
					data={shown}
					// The card's own id, which is what `key` was on the map this replaces — the
					// API's id and never the index.
					keyExtractor={(business) => business.id}
					renderItem={(business, index) => (
						<AnimateIn index={index}>
							<BusinessCard
								business={business}
								onPress={() =>
									router.push({
										pathname: "/store/[slug]",
										params: { slug: business.slug },
									})
								}
							/>
						</AnimateIn>
					)}
					hasNextPage={shops.hasNextPage}
					loadingMore={shops.isFetchingNextPage}
					onLoadMore={() => void shops.fetchNextPage()}
					// Both reads, not just the shops: the heading and the rail are half of what
					// this page is showing, and a pull that moved the list while leaving a failed
					// `catalog.categories` broken would answer for one of the two. The flag behind
					// the spinner is `./paginated-list`'s own state — see the docblock.
					onRefresh={() => Promise.all([categories.refetch(), shops.refetch()])}
					header={
						<View>
							<View style={styles.pad}>
								<BackButton to="/" />
							</View>

							{categories.isError ? (
								<View style={styles.pad}>
									<ErrorState
										error={categories.error}
										onRetry={() => void categories.refetch()}
									/>
								</View>
							) : waitingForCategories || !categories.data ? (
								<CategorySkeleton />
							) : !category ? (
								// `catalog.categories` is the authority on which slugs exist, so a slug it
								// does not carry is a statement about the category, not about our request —
								// and it says so, with a way back to the ones that do exist.
								<View style={styles.pad}>
									<EmptyState
										icon="pricetags-outline"
										title={t("category.unknown.title")}
										body={t("category.unknown.body")}
										actionLabel={t("action.back")}
										onAction={() => leaveScreen("/")}
									/>
								</View>
							) : (
								<View style={styles.sections}>
									<View style={styles.pad}>
										<Text variant="title" bold>
											{localizedName(category, locale)}
										</Text>
									</View>

									{/* The one rail that draws "Todo", like the web page's `allHref="/"`: a
									    customer who landed in the wrong category is one chip from the
									    unfiltered feed. Not a filter being cleared — every shop in the
									    marketplace is not this category, and a chip offering to show them
									    *here* would be a lie. */}
									<CategoryRail
										categories={sectors}
										selectedSlug={parent?.slug ?? slug}
										allHref="/"
									/>

									{children.length > 0 ? (
										<View style={styles.pad}>
											{/* A stacked card rather than another rail: a sector's children are
											    the categories filed under it, and this list is the one place they
											    are all on screen together with their counts. Each row opens its
											    own page, which is where its shops are — the sector's list below
											    does not include them (see the note above). */}
											<Card>
												{children.map((child, index) => (
													<ListRow
														key={child.id}
														title={localizedName(child, locale)}
														divider={index < children.length - 1}
														// The same number the grid's tiles print, through the same
														// landed plural pair, so a category's size reads the same
														// wherever it is drawn. `productCount` is optional, so a
														// row without one states nothing rather than a zero.
														state={
															child.productCount === undefined
																? undefined
																: tp("store.category.count", child.productCount)
														}
														chevron
														onPress={() =>
															router.push({
																pathname: "/category/[slug]" as const,
																params: { slug: child.slug },
															})
														}
													/>
												))}
											</Card>
										</View>
									) : null}

									{/* The way into the filters. The count is in the label rather than a badge
									    dot, because "Filtros · 2" is a sentence and a dot is a question — and
									    the count is of the filters the query is *honouring*, so a radius left
									    over from a lost fix is not counted. It does not fire a haptic: opening a
									    panel is not a choice, and the haptics in `./filter-sheet` mark the ones
									    that are. */}
									<View style={styles.pad}>
										<Button
											variant="secondary"
											label={
												active > 0
													? t("discovery.filters.button.active", {
															count: active,
														})
													: t("discovery.filters.button")
											}
											onPress={() => setFiltersOpen(true)}
										/>
									</View>

									{shops.isError ? (
										<View style={styles.pad}>
											<ErrorState
												error={shops.error}
												onRetry={() => void shops.refetch()}
											/>
										</View>
									) : waitingForShops || !shops.data ? (
										<BusinessCardsSkeleton />
									) : items.length === 0 ? (
										<View style={styles.pad}>
											{active > 0 ? (
												/* An empty list under active filters is a different fact from an
												   empty category, and `category.empty.*` states the wrong one —
												   "there is nothing here" over a list the reader narrowed
												   themselves would read as the filters having emptied it, which
												   is a claim about the marketplace that this screen cannot make.
												   The way out is the clear, not the rail. */
												<EmptyState
													icon="options-outline"
													title={t("discovery.filters.empty.title")}
													body={t("discovery.filters.empty.body")}
													actionLabel={t("discovery.filters.clear")}
													onAction={() => {
														selection();
														setFilters(DEFAULT_BUSINESS_FILTERS);
													}}
												/>
											) : (
												/* Says the plain thing: this category has no shops in it right
												   now. It does not promise that it is coming, and the rail above
												   is the way to a category that does have some. */
												<EmptyState
													icon="storefront-outline"
													title={t("category.empty.title")}
													body={t("category.empty.body")}
												/>
											)}
										</View>
									) : null}
								</View>
							)}
						</View>
					}
				/>
			</Screen>

			{/* A sibling of `Screen`'s scroll, not a child of it. `./sheet` positions itself with
			    `StyleSheet.absoluteFill`, which resolves against its nearest parent view — inside
			    a `ScrollView`'s content the panel would be laid out in the content and scroll
			    away from the screen it is covering. `./promo-input`'s `PromoSheet` is mounted the
			    same way on the cart, for the same reason. */}
			<FilterSheet
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				filters={filters}
				onChange={setFilters}
				hasLocation={hasLocation}
			/>
		</>
	);
}

/**
 * The page size, and the API's own default.
 *
 * Not the web page's 24 — that number is a grid's, three rows of eight on a laptop. A
 * phone shows three of these cards above the fold, so twenty is a first page with room to
 * scroll and a second page that only exists for somebody who wants it.
 */
const PAGE_SIZE = 20;

const styles = StyleSheet.create({
	// The body's height, which `./paginated-list`'s `flex: 1` needs. See that file.
	fill: { flex: 1 },
	// This screen is edge-to-edge because the rail is; everything that is not a row pays the
	// horizontal padding for itself, so it is one style and it cannot drift.
	pad: { paddingHorizontal: space.lg },
	// The heading, the rail, the button into the sheet and whichever of the error, skeleton or
	// empty block is standing in for the cards: the `space.lg` column the scroll used to pay
	// between its children. The back button above it is outside this, with no gap under it,
	// which is also what the scroll did. The cards' own gutter, the gap down to the first card
	// and the foot are `./paginated-list`'s.
	sections: { gap: space.lg },
});
