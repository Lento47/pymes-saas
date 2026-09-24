import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { BusinessCard } from "@/components/business-card";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
	activeFilterCount,
	BUSINESS_SORTS,
	type BusinessSort,
	DEFAULT_BUSINESS_FILTERS,
	effectiveBusinessFilters,
	FilterSheet,
	SORT_LABELS,
} from "@/components/filter-sheet";
import { PaginatedList } from "@/components/paginated-list";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { useSkeletonHold } from "@/components/skeleton";
import { BusinessCardsSkeleton } from "@/components/skeletons";
import { Text } from "@/components/text";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * Every shop the marketplace has, nearest first.
 *
 * The feed's "Cerca de ti" heading has promised this list since it was written, and until
 * this screen existed its "Ver todo" could only go to the search tab — the phone's one
 * other browse surface, and not a list of shops. `catalog.feed` caps `nearby` at twelve
 * (`FEED_NEARBY_LIMIT`), so a customer who wanted the thirteenth had nowhere to go. This is
 * `businesses.list`, which is the procedure that has always been able to answer it: a page
 * of twenty, a `nextCursor`, and five sorts.
 *
 * ## The sort control is real, and it is on the screen
 *
 * `businessListInput.sort` accepts five values — `best`, `distance`, `rating`, `popular`,
 * `newest` — and `apps/api/src/services/businesses.ts` was read to confirm each one reaches
 * the query (`sortValueOf`, which is also where the one degradation lives). Four or five
 * `Segmented` options are drawn from `BUSINESS_SORTS`, the list `./filter-sheet` exports,
 * so a member arriving in the schema is a compile error there rather than a segment the
 * server cannot honour.
 *
 * `best` is the default, and it is the one option here that is a *score* rather than a rule:
 * distance, rating, popularity and recency are each a single column, while `best` is the
 * marketplace's own weighted ordering (`packages/shared/src/ranking.ts`). It leads the row
 * because it is what a customer who has chosen nothing sees selected — "Recomendados", which
 * claims nothing more than that the ordering was chosen for them.
 *
 * The `distance` option is **not offered without a fix**, which is `./filter-sheet`'s own
 * rule and its own reason: with no origin the service sorts by `ratingAvg` and there is no
 * distance to sort by, so a segment labelled "Más cercanos" would be a control that moves
 * and changes nothing. `effectiveBusinessFilters` degrades the *state* the same way, so the
 * control, the badge and the request cannot hold three opinions about one list.
 *
 * ## Why there is a sort control here *and* one in the sheet
 *
 * `./filter-sheet` carries the same four options, and the two cannot disagree: both are
 * views of this screen's single `filters` object, so a choice in either is the same write
 * to the same state. The duplicated one is the *control*, not the value. It is here because
 * ordering a list of shops is the one thing a customer does on this screen often enough to
 * deserve a tap rather than a sheet, and the sheet is where the three filters that need
 * words around them live. `./filter-sheet` exports both the list and its `SORT_LABELS`
 * table, so the four segments below and the sheet's radio group read one mapping — a
 * second copy here could only ever disagree with the first.
 *
 * ## The two booleans, and where they are
 *
 * `openNow` and `deliveryOnly` are `./filter-sheet`'s controls and this screen's state, for
 * the reason `app/category/[slug]` gives: the sheet is the one place in the app that owns
 * those two controls and the count that says how many are narrowing, and a second copy of
 * them drawn inline would be a second place for "Abierto ahora" to mean something slightly
 * different. The button's label is `discovery.filters.button.active` when anything is
 * narrowing, so the state of the list is never hidden behind the tap that opens it.
 *
 * ## The scroller, and what it carries
 *
 * `./paginated-list` is the list, and this screen no longer owns a `ScrollView`: four taps of
 * "Cargar más" is eighty cards, and a `ScrollView` mounts every one of them while only the
 * ones on screen need to exist. That component also holds the pull — with its `refreshing`
 * flag as its own state rather than `isRefetching`, for the reason the feed gives, and with
 * both `tintColor` and `colors` paid, because iOS reads the first and Android the second —
 * and the foot, so the next page and the sentence that says there are no more are one
 * component here and on `app/category/[slug]` and `app/featured`.
 *
 * ## The shape of the wait
 *
 * The wait is `BusinessCardsSkeleton` — this screen's own column of cards — and not a
 * spinner, for the reason `docs/design-mobile.md` gives everywhere else: the shape of a list
 * is known before the list is.
 *
 * ## No count line, and no facet counts
 *
 * `businesses.list` answers with `{ items, nextCursor }` (`apps/api/src/services/businesses.ts`)
 * and no total and no `facetCounts` — the field exists in `packages/shared/src/pagination.ts`
 * for the page-numbered tables and nowhere in this procedure. A number under the heading
 * would therefore be the length of what has loaded, which is the defect the search screen's
 * count sentence was rewritten to stop telling. The list says what it holds by holding it.
 */
export default function Nearby() {
	const trpc = useTRPC();
	const { t } = useT();
	const { coords } = useDeviceLocation();

	const [filters, setFilters] = useState(DEFAULT_BUSINESS_FILTERS);
	const [filtersOpen, setFiltersOpen] = useState(false);

	const hasLocation = coords !== null;
	const effective = effectiveBusinessFilters(filters, hasLocation);
	const active = activeFilterCount(filters, hasLocation);

	const shops = useInfiniteQuery(
		trpc.businesses.list.infiniteQueryOptions(
			{
				lat: coords?.lat,
				lng: coords?.lng,
				openNow: effective.openNow,
				deliveryOnly: effective.deliveryOnly,
				radiusKm: effective.radiusKm,
				sort: effective.sort,
				limit: PAGE_SIZE,
			},
			{ getNextPageParam: (last) => last.nextCursor ?? undefined },
		),
	);

	const waiting = useSkeletonHold(shops.isPending);

	// Memoised because a `FlatList` compares the `data` array's identity: `pages.flatMap`
	// builds a new one on every render, and a list handed a new array re-renders every row it
	// is holding — which is the work virtualising the list was meant to save. The dependency
	// is the query's own cached `data`, which is stable between reads.
	const items = useMemo(
		() => shops.data?.pages.flatMap((page) => page.items) ?? [],
		[shops.data],
	);

	// Nothing under the skeleton or under a failure: `waiting` holds the skeleton up past the
	// arrival of the answer on purpose, so a row appearing in that window would be the
	// skeleton and the content disagreeing about what is on screen.
	const shown = waiting || shops.isError || items.length === 0 ? [] : items;

	// Back, or the feed for a link opened cold — `lib/leave` owns the pair.

	// Five with a fix and four without: `effective.sort` is never "distance" in the second
	// case, so the selected value is always one of the drawn options. The filter is
	// `./filter-sheet`'s, applied to the same list it applies it to.
	//
	// Five segments is the most this row can hold and it is at the edge: each gets a fifth of
	// the width less `space.md` per side, so the long labels ("Mejor valorados") wrap to a
	// second line and the row grows taller — which `./segmented` handles by growing all
	// segments together rather than truncating a word. What it must not do is leave the
	// selected value undrawn, so `best` cannot live only in the sheet: the two controls read
	// one list, and a segment missing from the row would be a filter the customer is under
	// with no way to see or clear it. If a sixth sort ever arrives, the answer is a picker
	// rather than a sixth segment.
	const sorts = BUSINESS_SORTS.filter(
		(sort) => hasLocation || sort !== "distance",
	);

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
					// The pull, with its flag inside `./paginated-list`: a query also refetches
					// when nobody pulled, and a spinner under a thumb that arrived without a
					// gesture claims credit for a request the reader did not make.
					onRefresh={() => shops.refetch()}
					header={
						<View style={styles.header}>
							<View style={styles.pad}>
								<BackButton to="/" />
							</View>

							{/* A stable name for the set, and deliberately not the sort. "Cerca de ti"
							    over a list ordered by rating would be the feed's own mistake in the other
							    direction: that heading follows the coordinate the request was made with,
							    and this screen's ordering is a control the reader owns. */}
							<View style={styles.pad}>
								<Text variant="title" bold>
									{t("search.businesses")}
								</Text>
							</View>

							<View style={styles.controls}>
								<Segmented
									label={t("discovery.filters.sort")}
									value={effective.sort}
									// No `selection()` here: `./segmented` fires the haptic itself, on the
									// settle and only when the value changes. A second one at this call site
									// would be two taps for one choice.
									onChange={(value) =>
										setFilters((current) => ({
											...current,
											sort: value as BusinessSort,
										}))
									}
									options={sorts.map((sort) => ({
										value: sort,
										label: t(SORT_LABELS[sort]),
									}))}
								/>
							</View>

							{/* The way into the two booleans and the radius. It does not fire a haptic:
							    opening a panel is not a choice — `app/category/[slug]` says the same. */}
							<View style={styles.pad}>
								<Button
									variant="secondary"
									label={
										active > 0
											? t("discovery.filters.button.active", { count: active })
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
							) : waiting || !shops.data ? (
								<BusinessCardsSkeleton />
							) : items.length === 0 ? (
								<View style={styles.pad}>
									{active > 0 ? (
										/* The list is empty *because of a filter*, which is a different fact
										   from a marketplace with nothing in it — the empty states the API
										   can support are three and they say three different things. */
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
										/* The feed's pair, for the same reason the feed draws both: the
										   radius is only a fact about the customer's street when the
										   request carried a coordinate, and without one it filtered by no
										   zone at all.

										   The sentence is the *title*, not the body. `search.businesses`
										   ("Negocios") is the page heading sixteen points above this state
										   and a group heading on the search tab — a set's name, which is
										   Rule 2's *fact* and not its *state*. `./empty-state`'s contract is
										   "nothing here, and what to do about it", and the state slot is the
										   one the other empty path in this same file already fills with a
										   sentence (`discovery.filters.empty.title`). There is nothing to
										   offer in the body: no coordinate is not a control the reader
										   forgot to press. */
										<EmptyState
											icon="storefront-outline"
											title={
												hasLocation
													? t("home.nearby.empty")
													: t("home.nearby.empty.all")
											}
										/>
									)}
								</View>
							) : null}
						</View>
					}
				/>
			</Screen>

			{/* A sibling of `Screen`'s scroll and not a child of it: `./sheet` positions itself
			    with `StyleSheet.absoluteFill`, which resolves against its nearest parent view,
			    so a panel inside a scroll's content would be laid out in the content and scroll
			    away from the screen it covers. `app/category/[slug]` mounts it the same way. */}
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
 * Twenty, which is `businessListInput.limit`'s own default and `app/category/[slug]`'s page.
 * A phone shows three of these cards above the fold, so twenty is a first page with room to
 * scroll and a second page that only exists for somebody who wants it.
 */
const PAGE_SIZE = 20;

const styles = StyleSheet.create({
	// The body's height, which `./paginated-list`'s `flex: 1` needs. See that file.
	fill: { flex: 1 },
	// This screen is edge-to-edge only in the sense that its scroll owns its own padding;
	// everything that is not a card pays `space.lg` for itself, so it is one style and it
	// cannot drift.
	pad: { paddingHorizontal: space.lg },
	// No `marginTop`: the sort row is a child of the `header` column above it, so the step
	// between it and the heading is the column's own `gap` — the one rhythm
	// `app/category/[slug]`'s `sections` pays between the same heading and its controls, and
	// the one every other row of this header gets. No `pad` wrapper around the `Segmented`
	// either, so the padding is here, or the group runs to both edges on a screen that is
	// `padded={false}`.
	controls: { paddingHorizontal: space.lg },
	// The back button, the heading, the sort row and the way into the sheet, plus whichever of
	// the error, skeleton or empty block is standing in for the cards: one column, with the gap
	// the scroll used to pay between its children. The cards' gutter, the gap down to the first
	// card and the foot are `./paginated-list`'s.
	header: { gap: space.lg },
});
