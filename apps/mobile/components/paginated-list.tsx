import { FlatList, StyleSheet, View } from "react-native";

import { space } from "@/theme";

import { ListEnd } from "./list-end";
import { useRefreshControl } from "./pull-refresh";

/**
 * A paginated list of cards — the scroller, the pull and the foot, written once.
 *
 * Three browse screens answer the same shape: a `Screen` with `padded={false}`, a column of
 * blocks above the list, `businesses.list` or `products.list` paged twenty at a time, and
 * `./list-end` under it. Before this file each of them owned a `ScrollView`, its own
 * `RefreshControl` with both tints, its own `pulling` flag and its own `refresh()` — the same
 * twenty lines three times, which is the arrangement where one copy learns a fix and the
 * other two do not. They now differ in their header and in what a row is, and in nothing else.
 *
 * ## Why it is a `FlatList` and not a `ScrollView`
 *
 * A `ScrollView` mounts every child it is given, whether or not it is on screen. That is
 * right for the screens that are a handful of blocks — the feed caps each of its sections at
 * twelve (`FEED_NEARBY_LIMIT`, `FEED_FEATURED_LIMIT` in `apps/api/src/services/catalog.ts`)
 * — and wrong for these three, which is exactly why they exist: they are where the thirteenth
 * shop went. A customer who taps "Cargar más" four times has eighty cards mounted at once,
 * each with its own photograph, its own press spring and its own `AnimateIn` shared value,
 * all of them off screen and all of them live. A `FlatList` mounts the window and a couple of
 * screens either side of it, and the rows above are recycled as they leave — **but not at the
 * window `FlatList` picks for itself**, which is why this component passes `windowSize={7}`
 * below. That sentence was false when it was written.
 *
 * `./animate-in` was written for this and says so: `index` is in its effect's dependencies
 * "because a recycled list row is a new item and has to enter as one" — so a row that comes
 * back into the window fades in again rather than appearing already settled.
 *
 * ## The two unbounded lists that are deliberately *not* this component
 *
 * `components/review-list` and `app/business`'s orders board are the app's other `.map()`
 * sites over a server list with no cap, and neither of them becomes a `FlatList`:
 *
 * - `review-list` renders inside `app/store/[slug]`'s `ScrollView` (`store/[slug].tsx`), which is
 *   that screen's scroller *and* carries `stickyHeaderIndices={[1]}` (`store/[slug].tsx:725`)
 *   and the `onLayout` measurements its section offsets are read from. A `FlatList` in
 *   there is a `VirtualizedList` inside a `ScrollView` — the nesting RN warns about, because
 *   the inner list cannot know its own window when the outer view owns the scroll — so
 *   virtualising it means handing that screen's scroller over, and the sticky rail and the
 *   offsets it is measured against go with it. The `.map()` stays.
 * - `app/business`'s orders are a shop's own board, drawn inside `Screen`'s own scroller
 *   (`business.tsx:121`, the `scroll` prop) beneath its local `ShopTabs` and a shop card, and
 *   re-ordered by a `refetchInterval` of five seconds (`business.tsx:347`, `BOARD_POLL_MS`).
 *   Listing it means the `FlatList`
 *   becomes that screen's scroller: `Screen` is asked for `scroll` and would have to stop
 *   being, and the board moves out of the tab strip's body — a contract change plus a merge
 *   across two components, for a shop's own orders rather than a page of a marketplace.
 *
 * ## The pagination is still a button, and that is not an omission
 *
 * `onEndReached` would fill the list as the thumb falls, and it is deliberately not used.
 * `./review-list` gives the reason and it holds for all three of these: a list that fetches
 * by itself spends a stranger's data allowance on a flick nobody asked it to act on, and it
 * leaves the reader nowhere to stop. `./list-end` is the foot — the next page, or the
 * sentence that says there are no more — and holding it here is what makes the button and
 * the end statement impossible to draw apart.
 *
 * ## The gutter is on the row, not on `contentContainerStyle`
 *
 * `contentContainerStyle` is the whole content of the list, header included, so a
 * `paddingHorizontal` there would inset everything above the list as well — and one of the
 * three headers is a rail that is edge-to-edge on purpose (`app/category/[slug]`'s
 * `CategoryRail`, which scrolls off both sides of the screen). So the gutter is paid twice
 * instead: the header pays its own, and every row is wrapped in `styles.item`. The wrapper is
 * one `View` per row and it is what a parent's `gap` used to be — a `FlatList` cannot take a
 * gap between its children, so the space between two rows is `ItemSeparatorComponent` and
 * the space either side of them is the row's own padding.
 *
 * ## What it deliberately has no prop for
 *
 * **`getItemLayout`.** A row's height is its content's, so there is no constant offset to hand
 * the list: `./business-card` wraps its name and its category rather than truncating them (its
 * own docblock says why), and `app/featured`'s shelf tile derives its photo height from the
 * device width via `aspectRatio`. The cost of not having it is the window arithmetic, which
 * `windowSize` below is what bounds — and neither list here needs `scrollToIndex`, which is the
 * other half of what the prop buys.
 *
 * **`numColumns`.** `app/featured` draws its shelf two up, and a lone trailing tile in a
 * `numColumns={2}` list is stretched across the full width — the defect `./featured`'s own
 * `chunk()` and its empty `flex: 1` sibling exist to prevent. So that screen chunks its items
 * into rows itself and hands this component rows instead of tiles, and the component stays a
 * list of one thing per row.
 *
 * **`refreshing`.** The pull's flag belongs to the pull, so it is not the query's `isRefetching`
 * — a query also refetches on a remount or a stale window, and a spinner appearing under a thumb
 * that never moved claims credit for a request the reader did not make. It comes from
 * `./pull-refresh` with the control itself, which is also where the both-tints rule and the
 * absent-not-disabled rule live: this component used to hold its own eight-line copy of the
 * control beside `./screen`'s, and `./screen`'s `onRefresh` reaches the scroller `Screen` owns
 * and **only** that one, so a screen with its own `FlatList` could not borrow it. The rule now
 * has one home and both scrollers call it.
 */

/**
 * What a caller hands over. The pagination values are the same ones `./list-end` takes, passed
 * straight through — this component does not read the cursor, it places the foot.
 *
 * **There is no `rows` prop, and there was.** `./list-end` takes a row count and returns `null`
 * at zero, so the foot is not drawn under an empty list; this component used to ask the caller
 * for that count and take `data` as well, which let the two disagree. All three screens passed
 * the *loaded* count (`items.length`) where `data` is the *drawn* array (`shown`), and the two
 * are deliberately different: each of the three sets `shown = []` while the skeleton is held —
 * `useSkeletonHold` keeps it up past the arrival of the answer on purpose — and again under a
 * failure, so that a row cannot appear in a window where the skeleton and the content disagree
 * about what is on screen. In exactly that window the list drew no rows and the foot drew
 * anyway: a "load more" button under a skeleton, pressing which fetches a page for a list that
 * is not on screen, or `state.listEnd` telling a reader there is nothing more of nothing. The
 * count is now `data.length`, one line below, so it cannot say anything but what is drawn.
 */
type PaginatedListProps<Item> = {
	/** What is loaded so far, in the order the API returned it. */
	data: Item[];
	/** The row's identity. The API's own `id` everywhere in this app, never the index. */
	keyExtractor: (item: Item) => string;
	/**
	 * One row. The index is the row's position in the loaded list, which is what
	 * `./animate-in` staggers on — it is the list's order and not a React key.
	 */
	renderItem: (item: Item, index: number) => React.ReactElement | null;
	/**
	 * Everything above the list: the back button, the heading, the controls, and whichever of
	 * the error, skeleton or empty blocks the screen is showing instead of rows. One node,
	 * because a `FlatList` takes one — a screen that needs a gap between those blocks keeps
	 * the `gap` in its own header view, where it was anyway.
	 */
	header?: React.ReactNode;
	hasNextPage: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	/** Absent means no pull, and no control: a gesture the list answers by doing nothing. */
	onRefresh?: () => unknown;
};

export function PaginatedList<Item>({
	data,
	keyExtractor,
	renderItem,
	header,
	hasNextPage,
	loadingMore,
	onLoadMore,
	onRefresh,
}: PaginatedListProps<Item>) {
	// The pull, both tints and its own flag, from the one place that holds the three rules —
	// the same call `./screen` makes for the scroller it owns. See `./pull-refresh`.
	const refreshControl = useRefreshControl(onRefresh);

	return (
		<FlatList
			data={data}
			keyExtractor={keyExtractor}
			renderItem={({ item, index }) => (
				<View style={styles.item}>{renderItem(item, index)}</View>
			)}
			// The header's own bottom gap is what the old scroll's `gap` paid between the last
			// block above the list and the first row; there is no gap to inherit here.
			ListHeaderComponent={
				header ? <View style={styles.header}>{header}</View> : null
			}
			// `./list-end` returns `null` at zero rows, so an empty list gets no foot and the
			// screen's own `./empty-state` is the whole answer. The count is the drawn array's
			// own length — not a prop — so it cannot disagree with what is on screen.
			ListFooterComponent={
				<ListEnd
					rows={data.length}
					hasNextPage={hasNextPage}
					loading={loadingMore}
					onPress={onLoadMore}
					// Placement only, which is what that prop is for: the foot's own gutter is its
					// own. The gap above it is the one the scroll used to pay between the rows and
					// the foot — 16, and not `./list-end`'s `space.md`, which is inside it.
					style={styles.footer}
				/>
			}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.content}
			style={styles.list}
			refreshControl={refreshControl}
			/**
			 * Seven viewports, where `FlatList` would use twenty-one.
			 *
			 * This is the one default in this file worth overriding, and it is not a tuning
			 * knob — the default is a different design. `@react-native/virtualized-lists`
			 * resolves the window as `windowSize ?? 21` and turns it into overscan as
			 * `(windowSize - 1) * visibleLength`, split half above and half below the viewport.
			 * Twenty viewports of overscan is the whole of this app's loaded list: at twenty
			 * cards a page, four "Cargar más" taps is eighty content-height cards (a
			 * `./business-card` is roughly 140pt, and nothing in it is truncated — see its own
			 * docblock), so a window of twenty-one viewports is well over 10,000pt of content
			 * against a ~700pt screen. Nothing is ever far enough away to be recycled, and every
			 * one of those rows keeps its `AnimateIn` shared value, its press spring and its
			 * image fade live. Seven makes the window what the docblock above says it is: about
			 * one screen, plus three either side, which is a bound the list actually reaches.
			 *
			 * The two neighbouring defaults are deliberately left alone.
			 * `initialNumToRender` is already 10, which is more than a screen of these rows, so
			 * lowering it would change what the first paint contains. `maxToRenderPerBatch` only
			 * shapes how a bounded window fills, and there is no measurement asking for it.
			 * `removeClippedSubviews` is left off as RN leaves it off on Android
			 * (`ReactScrollView.java` sets `mRemoveClippedSubviews = false`).
			 *
			 * What a reader sees change is one thing, and `./animate-in` already documents it as
			 * intended: a row that leaves the window and comes back is a new item and enters
			 * again, so scrolling back up re-runs the entrance fade. Every other fact about the
			 * row — its copy, its spacing, its haptics, its labels — is identical.
			 */
			windowSize={7}
		/>
	);
}

/** The space between two rows. A component and not an inline arrow, so it never remounts. */
function Separator() {
	return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
	// `flex: 1` because this list *is* the screen's body. That makes it the caller's job to
	// give the body a height to grow into: `Screen`'s body is a plain `View`, so it measures to
	// its content and a `flex: 1` child inside it resolves to nothing — the screen draws blank,
	// with no error and no red box. Every caller therefore passes
	// `contentStyle={{ flex: 1 }}` (their local `fill`/`page`/`frame`) alongside
	// `padded={false}`. Four screens use this component and all four had forgotten it.
	list: { flex: 1 },
	// `./screen`'s own scroller pays `space.huge` at the bottom (`screen.tsx:198`,
	// `scrollContent`) and a screen
	// that brings its own scroller has to pay it itself. No horizontal padding: the header
	// manages its own and the rows pay theirs — see the docblock.
	content: { paddingBottom: space.huge },
	// The gap between the blocks above and the first row.
	header: { marginBottom: space.lg },
	// The card column's gutter, which every one of the three screens had written out as
	// `cards`/`rows` before this file: `space.lg` either side, `space.md` between.
	item: { paddingHorizontal: space.lg },
	separator: { height: space.md },
	footer: { marginTop: space.lg },
});
