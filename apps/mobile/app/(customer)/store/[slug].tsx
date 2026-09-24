import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import {
	type BusinessCard,
	type BusinessHoursEntry,
	type Category,
	formatMoney,
} from "@pymeshub/shared";
import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
	Platform,
	type ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import Animated, {
	useAnimatedScrollHandler,
	useSharedValue,
} from "react-native-reanimated";
import { ActionBar, useActionBarClearance } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
import { FavoriteButton } from "@/components/favorite-button";
import { Hero } from "@/components/hero";
import { HoursTable } from "@/components/hours-table";
import { ListEnd } from "@/components/list-end";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { Price } from "@/components/price";
import { ProductRow } from "@/components/product-row";
import { useRefreshControl } from "@/components/pull-refresh";
import { ReviewList, reviewDistribution } from "@/components/review-list";
import { ReviewSummary } from "@/components/review-summary";
import { Screen } from "@/components/screen";
import { useSkeletonHold } from "@/components/skeleton";
import {
	ProductRowsSkeleton,
	StorefrontSkeleton,
} from "@/components/skeletons";
import { StoreNav } from "@/components/store-nav";
import { Text } from "@/components/text";
import { toApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import {
	formatAtMostOneDecimal,
	formatMinuteOfDay,
	formatOneDecimal,
} from "@/lib/format";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useTRPC } from "@/lib/trpc/context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
} from "@/theme";

/**
 * A shop, and its menu.
 *
 * `businesses.bySlug` answers with the whole storefront — card, hours, open flag,
 * categories and what the shop is featuring — in one response, which is what makes this
 * page able to draw its header before its menu without a second request. The menu is a
 * separate, paginated read: a shop with two hundred products should not cost the same as a
 * shop with eight.
 *
 * ## The menu is grouped, and grouping is N reads rather than one
 *
 * `docs/design-mobile.md` Rule 4: products group by category, groups are headed, and the
 * storefront carries a sticky rail of them that follows the scroll and jumps on tap. The
 * group *names* and their counts are already in hand — `businessStorefrontSchema.categories`
 * carries each category with its `productCount`, ordered by the shop's own `sortOrder` — but
 * the rows cannot be partitioned from one page, because **`productCardSchema` carries no
 * `categoryId`** (read it: the card has a seller, a price and a rating and no category). A
 * single `products.list` page therefore cannot be split into groups on the client, and the
 * only honest grouping is one query per group, each scoped by `categoryId` and each owning its
 * own cursor. `MenuSection` below is that query; the parent owns nothing about it but where it
 * sits.
 *
 * The consequence is deliberate and worth stating: the headings are real from the first frame
 * (they came with the store payload), and only the rows under each are waited for — so the page
 * never draws a skeleton where a heading it already has could be.
 *
 * ## The rail, and the two numbers it needs from this file
 *
 * `./store-nav` renders the rail and decides the highlight; this screen owns the scroll view,
 * the shared value and the jump. Three details make the two agree:
 *
 * - `scrollY` is written from `useAnimatedScrollHandler`, on the UI thread. The rail's docblock
 *   says why: reading the offset in React state re-renders every chip on every frame of every
 *   scroll, and the answer changes perhaps four times a page.
 * - `offsets` are measured with `onLayout` on each section's own wrapper — a direct child of the
 *   scroll view's content, so `layout.y` is in content coordinates, which is the space
 *   `StoreNav` compares against. No measuring library and no dependency.
 * - `onJump` scrolls to `y - railHeight`, which is the **same expression the rail uses to decide
 *   which group is under the reader** (`store-nav.tsx`: `y >= ys[index] - railHeight`). A
 *   heading is not "at the top of the viewport", it is "just below the rail", so a jump that
 *   landed on `y` alone would put the heading it was asked for under the sticky band. The
 *   `animated` flag is the rail's — it has already applied reduced motion, and re-deciding it
 *   here is exactly what that component's contract forbids.
 *
 * The rail is sticky through `stickyHeaderIndices={[1]}`: child 0 is the head, child 1 is the
 * rail's wrapper, and the wrapper is **always rendered** even when the rail draws nothing (a
 * shop with one group, or a search in progress) — a conditional child would shift the index and
 * make some other block sticky instead.
 *
 * ## The field searches the server, because the menu on screen is one page
 *
 * The in-shop search is `products.list` scoped by `businessId` **with** the term, not a filter
 * over the rows already loaded: `packages/shared`'s `productListInput` carries `search` and
 * `apps/api`'s products service applies it as a `like` over the name *or* the description, and
 * the rows this screen holds are one page of a paginated read — a client-side filter would find
 * "café" only if a café happened to be on page one.
 *
 * The term is trimmed before it is debounced, so `"café "` and `"café"` are one cache entry and
 * a stray space cannot become a search of its own; `lib/use-debounced-value` owns the timer (a
 * request per keystroke is a request per keystroke on a phone network), and the two-character
 * floor is the same one `app/search.tsx` sets — one character is not a search, it is the
 * beginning of one. A search in progress replaces the grouped sections with one flat result list
 * carrying the same count line and the same rows; the groups come back when the field is
 * cleared, from cache.
 *
 * ## The head, the schedule, and the sentence a closed shop owes
 *
 * The hours are `businessStorefrontSchema.hours` and the open flag is the server's own
 * `isOpen` — computing it on the phone needs the shop's timezone, which nothing on the public
 * card carries. `./hours-table` draws the week; above it, when the shop is closed, this screen
 * adds the **reason**: `store.closed.until`, with the opening time. It used to add
 * `store.hours.closedToday` ("Hoy cerrado") for a closed *day* too; that line repeated the
 * hero's own "Cerrado" and the "Hoy" row the table prints just below, so it is cut and the key
 * is back to its web-only callers (`apps/web/components/catalog/store-header.tsx`,
 * `store-info.tsx`).
 *
 * The opening time is `formatMinuteOfDay(entry.opensMinute, intlLocale)` — `lib/format`'s
 * 24-hour formatter, which answers `null` rather than throwing, so a runtime with no clock
 * drops the sentence instead of printing "null" — and it is read from the row for the
 * **device's** weekday. That is the same compromise `apps/web/components/catalog/hours.ts`
 * documents in its `todayEntry` and `./hours-table` repeats for its "Hoy" marker: the
 * alternative is inventing a timezone the contract does not carry. No next-opening minute is
 * computed by the API, so this sentence is composed here rather than quoted from a field.
 *
 * ## Why this screen scrolls itself instead of asking `Screen` to
 *
 * `Screen` renders its own `ScrollView` when `scroll` is set, and that `ScrollView` takes no
 * `onScroll`, no `stickyHeaderIndices`, no `refreshControl` and no `onLayout` for a rail — so a
 * screen that needs all four renders its own. The frame, the safe-area edges and the padding are
 * still `Screen`'s; the body is a `padded={false} contentStyle={{flex: 1}}` slot.
 *
 * The keyboard handling is the one thing that has to be transcribed rather than inherited, and
 * what is transcribed is `./screen`'s *shape*, not its expression. `./screen` writes
 * `Platform.OS === "ios" ? keyboardInsets : undefined` (`components/screen.tsx:177-179`) because it
 * has a prop to read — `keyboardInsets`, defaulting to `false`, so a screen opts in. This scroll
 * has no such prop, so the same shape is written with the answer already decided:
 * `Platform.OS === "ios" ? true : undefined` (`:735-737`). **The two are not character for
 * character and this paragraph said they were**: a screen on `Screen` that passes nothing gets
 * `false` on iOS, and this one adjusts its insets unconditionally. That is deliberate — the body
 * is a `padded={false}` slot holding a form-height scroll — but it is a difference, and the old
 * sentence concealed it behind a phrase that reads as a copy.
 *
 * What *is* identical is the reason for the shape: the prop is iOS-only (RN 0.86 declares it on
 * `ScrollViewPropsIOS`) and `undefined` rather than `false` off iOS, so Android never receives
 * the key at all; Android needs none of it, because its window is resized by the keyboard rather
 * than covered by it. The drag-to-dismiss mode and
 * `keyboardShouldPersistTaps` are the same branch that file uses, for the same reason.
 *
 * ## Refresh is a gesture, not a button (Rule 6)
 *
 * A storefront's data changes while it is on screen — a shop closes, a product sells out — so a
 * pull refetches: the store payload and the review page directly, and every menu section through
 * `invalidateQueries` on the `products` path, which is the app's own idiom
 * (`app/checkout.tsx`, `app/order/[id].tsx`). The control — both tints, the flag's ownership and
 * the absent-not-disabled rule — is `./pull-refresh`'s, and this screen is the reason the flag
 * has to belong to the gesture rather than be derived: the four section queries are owned by the
 * sections, so a derived flag over reads this screen does not hold would either never clear or
 * show a spinner on mount.
 *
 * ## The reviews, and the one distribution that is real
 *
 * `reviews.list` is the public read (`apps/api/src/routers/reviews.ts`, where its own docblock
 * says it "is `docs/design-mobile.md`'s contract name"), so a rating has rows behind it rather
 * than being a number nobody can check. The rows are
 * paged by a button, and `./review-list`'s `reviewDistribution` converts a page into
 * `./review-summary`'s bars **only** when the rows on hand are all of them
 * (`reviews.length === ratingCount`) — a spread drawn over one page is the most believable lie
 * a review block can contain, and the summary refuses it from the other side too.
 *
 * ## The sticky bar, and the inset it does not share
 *
 * The page used to end with a `nav.cart` button in the scroll, which is a button that is
 * absent at the moment the customer is deciding. It is now an `./action-bar` pinned over
 * the scroll with the cart's real line count and its real total on it.
 *
 * The bar pays its own bottom inset, so this screen deliberately does **not** pass
 * `bottomInset` to `Screen` — paying it twice is the 34-point gap above the bar that
 * `./action-bar`'s docblock describes. What the screen owes instead is the room: the bar
 * floats over the scroll, so the content carries `ACTION_BAR_CLEARANCE` and the last menu row
 * can still be brought out from under it.
 *
 * ## Which cart the bar is about
 *
 * Only this shop's. A cart is one business's by construction, and a bar reading "3
 * artículos · ₡12.000" on a shop's page while those three items belong to a shop down the
 * street is a bar that lies about what the customer is looking at. Another shop's cart is
 * not hidden from them — it is one tap away on the cart screen and the question is asked
 * properly when they try to add something here — it simply is not claimed as this shop's.
 */

/** The page size for a group of the menu, and for the review list beneath it. */
const MENU_PAGE_SIZE = 20;
const REVIEW_PAGE_SIZE = 5;

/** `app/search.tsx`'s debounce, so the two search fields settle alike. */
const SEARCH_DEBOUNCE_MS = 300;
/** Two characters is a search; one is the beginning of one. Also search.tsx's floor. */
const MIN_SEARCH_LENGTH = 2;

/** Stable empties, so a derived value does not hand a new array to a child every render. */
const NO_GROUPS: readonly { key: string; label: string }[] = [];
const NO_HOURS: readonly BusinessHoursEntry[] = [];
const NO_IDS: readonly string[] = [];

/** The offset key for a menu that is not grouped — a shop whose products have no category. */
const ALL_GROUPS_KEY = "__all";

/**
 * When the shop opens, for a shop that is closed now — or `null`.
 *
 * The formatted time rather than a key and params, because one sentence is left and the `t()`
 * call stays at the call site. It used to answer a closed *day* with `store.hours.closedToday`
 * ("Hoy cerrado") as well; that line repeated the hero's own "Cerrado" and the "Hoy" row
 * `./hours-table` prints just below, so the state keeps one voice per surface now: the hero
 * states it, the table gives the reason, and this line only says when the shop opens. See the
 * docblock above for the weekday.
 */
function closedUntil(
	hours: readonly BusinessHoursEntry[],
	isOpen: boolean,
	intlLocale: string,
): string | null {
	// Open now is the hero's own word; this line exists only to say when a shut shop opens.
	if (isOpen) return null;

	const today = new Date().getDay();
	const entry = hours.find((row) => row.day === today);
	if (!entry) return null;

	// A closed day has nothing to add: `./hours-table`'s "Hoy" row already reads "Cerrado", and
	// a range that `businessHoursEntrySchema` would have rejected is the same silence.
	if (entry.isClosed || entry.closesMinute <= entry.opensMinute) return null;

	const now = new Date();
	const minutesNow = now.getHours() * 60 + now.getMinutes();
	// Already past today's opening: the shop has opened and closed since, and the honest next
	// answer would be tomorrow's row — which is the timezone claim this screen does not make.
	if (entry.opensMinute <= minutesNow) return null;

	return formatMinuteOfDay(entry.opensMinute, intlLocale);
}

/**
 * The shop's facts, composed once for the hero.
 *
 * The same five facts, in the same words and the same order, as `./business-card`'s chip row —
 * that file's vocabulary is the app's answer to "what does a customer compare between two
 * shops", and a storefront that invented a second set would make the numbers on the card and
 * the numbers on the page disagree about which ones matter.
 *
 * Every value is finished here: `./facts` does no formatting and holds no keys. Money goes
 * through `formatMoney` and nothing else.
 */
function StoreFacts({ card }: { card: BusinessCard }) {
	const { t, tp, intlLocale } = useT();

	// One decimal, because that is the precision `ratingAvg` is stored at — the format
	// `./business-card` and `./review-summary` apply to the same number. All three now call
	// `lib/format`'s `formatOneDecimal`, which is also the formatter's only construction: this
	// screen re-renders on every measured section offset, so a per-render `Intl` build here was
	// the most expensive of the three.
	const score = formatOneDecimal(card.ratingAvg, intlLocale);

	/**
	 * The distance, when the payload has one.
	 *
	 * `businessCardSchema.distanceKm` is nullable and `bySlug`'s input carries no coordinates
	 * (`businessListInput` has `lat`/`lng` and `bySlug` has `slug` alone), so on this screen it
	 * is null and no chip is drawn for it. It is composed anyway, because the chip is the same
	 * one the card composes and a storefront route that gains coordinates should gain the chip
	 * rather than needing this file edited — see the report on the API gap.
	 */
	const distance =
		card.distanceKm === null || card.distanceKm === undefined
			? null
			: formatAtMostOneDecimal(card.distanceKm, intlLocale);

	// The fee, or the absence of delivery — the same keys and the same three-way branch as
	// `./business-card`, `null` included. The branch used to be two-way, so `deliveryEnabled:
	// false` fell through to the pickup chip whether or not the shop does pickup; a shop with
	// both kinds off drew a "Retiro" chip for a service `apps/api/src/services/cart.ts`
	// refuses. See the card's docblock for the whole of it — the two files must agree, and a
	// shop that offers neither draws no fulfilment chip on either.
	const delivery = card.deliveryEnabled
		? card.deliveryFeeMinor === 0
			? t("store.delivery.free")
			: t("store.delivery.fee", {
					amount: formatMoney(card.deliveryFeeMinor, card.currency, {
						locale: intlLocale,
					}),
				})
		: card.pickupEnabled
			? t("store.pickup.short")
			: null;

	return (
		<Facts>
			{/* Nothing at all when nobody has rated the shop: the API's own `null`, which is not
			    a zero, and a new shop should look new rather than badly reviewed. */}
			{card.ratingCount >= 1 ? (
				<Fact
					value={`${score} (${card.ratingCount})`}
					iconName="star"
					iconTone="rating"
					// `tp`, not `t`: `store.rating.label.count` is a key/plural pair.
					accessibilityLabel={tp("store.rating.label.count", card.ratingCount, {
						value: score,
					})}
				/>
			) : null}
			<Fact
				value={t("unit.minutes", { count: card.prepTimeMinutes })}
				iconName="time-outline"
			/>
			{delivery !== null ? (
				<Fact
					value={delivery}
					iconName={
						card.deliveryEnabled ? "bicycle-outline" : "bag-handle-outline"
					}
				/>
			) : null}
			{card.minOrderMinor > 0 ? (
				<Fact
					value={t("store.minOrder.short", {
						amount: formatMoney(card.minOrderMinor, card.currency, {
							locale: intlLocale,
						}),
					})}
					iconName="cash-outline"
				/>
			) : null}
			{distance === null ? null : (
				<Fact
					value={t("unit.km", { value: distance })}
					iconName="location-outline"
				/>
			)}
		</Facts>
	);
}

/**
 * One group of the menu: a heading, the page of rows under it, and its own cursor.
 *
 * `category` is `null` for the two ungrouped cases — a shop whose products carry no category at
 * all, and a search in progress. Those differ in one more way than they share: a category that
 * settles **empty** removes itself and tells the parent, because `storefrontCategories` counts
 * ACTIVE products while `products.list` also excludes archived ones, and an empty heading in a
 * grouped menu is a shrug. An ungrouped block that settles empty draws the empty state instead,
 * because there is no other block that would show those rows.
 *
 * ## Why this is memoised, and `StoreNav` is the only thing that is not
 *
 * The section measures itself and reports where its heading landed (`onOffset`), which writes the
 * parent's `offsets` state — and that state is what the rail reads. So every section's mount writes
 * it, and every section that changes height later (its own page of twenty rows landing, its
 * categories settling) writes it again. Each write is a render of the whole storefront, and the
 * menu is an `items.map` rather than a virtualised list, so each of those renders re-executed every
 * mounted `ProductRow`, its `<Price>`, its `Rating`, and `./hours-table`'s twenty-one formatter
 * lookups — for a change only `StoreNav` can see. It is O(N) to O(N²) renders per storefront load,
 * and it is the one place in this app where the arithmetic can drop frames.
 *
 * The props make the memo work rather than merely exist: `businessId` and `search` are strings,
 * `category` is an element of `store.data.categories` and react-query's structural sharing keeps
 * that identity across a refetch, and both callbacks are `useCallback`s — `onOffset` on `[]`,
 * `onEmpty` on `[slug]`. So a render caused by `offsets` alone now short-circuits every section and
 * leaves the rail to re-render, which is the one consumer that needs the new numbers.
 *
 * Two things this deliberately does not do. It does not replace `offsets` with a shared value to
 * remove the renders altogether: `./store-nav`'s own docblock promises that a group measuring late
 * is "reachable on the next render", and moving rail reachability outside React breaks a written
 * contract to save the last few renders. And it does not put `useTheme()`'s return anywhere near a
 * comparison — `theme/index.ts` hands out a fresh `{ colors, scheme }` wrapper per call, so a memo
 * that compared it would miss every time. This component reads `useT()` and `useTheme()` inside its
 * own body, which is the shape that keeps a locale switch re-rendering it (`useT` returns a
 * memoised context value) while the offsets do not.
 */
const MenuSection = memo(function MenuSection({
	businessId,
	category = null,
	search = null,
	onOffset,
	onEmpty,
}: {
	businessId: string | undefined;
	category?: Category | null;
	/** The settled search term, or `null` for the menu proper. */
	search?: string | null;
	/** Where this section's heading sits, in the scroll content's coordinates. */
	onOffset?: (key: string, y: number) => void;
	/** This category has no rows to show; the rail must stop offering it. */
	onEmpty?: (id: string) => void;
}) {
	const trpc = useTRPC();
	const { t, tp, locale } = useT();

	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			{
				businessId,
				categoryId: category?.id,
				search: search ?? undefined,
				limit: MENU_PAGE_SIZE,
				// "relevance" is the server's own name for what a search is sorted by
				// (`apps/api`'s products service maps it); the menu proper is "popular".
				sort: search === null ? "popular" : "relevance",
				sortDirection: "desc",
			},
			{
				enabled: !!businessId,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
				// A settled term that replaces another keeps the previous term's rows on screen
				// while its own request is out. The field above the menu is mounted and usable
				// for the whole debounce, so without this a customer who types a second word
				// reads a skeleton where their last search was — the same page they were
				// reading, replaced by grey, once per keystroke that settles.
				// `app/search.tsx` sets the same option on its own field, for the same
				// reason. The skeleton's *hold* below is unaffected and still earns its place:
				// it is what stops a first page answering in 80ms from painting grey for 80ms.
				placeholderData: keepPreviousData,
			},
		),
	);

	const waiting = useSkeletonHold(products.isPending);
	const items = products.data?.pages.flatMap((page) => page.items) ?? [];
	// `isPlaceholderData` is excluded for the reason `isPending` is. With `keepPreviousData` a
	// settled term draws the *previous* term's response while its own request is out, and a
	// previous response that matched nothing would print "no encontramos nada" over a search
	// whose answer has not arrived yet. The empty state is for a response that says zero, not
	// for a response that is not here — `app/search.tsx` draws the same line.
	const isEmpty =
		!waiting &&
		!products.isError &&
		!products.isPlaceholderData &&
		items.length === 0;

	// Told to the parent from an effect, because the rail has to lose this group and a state
	// update during render belongs to a component that has not mounted yet.
	useEffect(() => {
		if (category && isEmpty) onEmpty?.(category.id);
	}, [category, isEmpty, onEmpty]);

	// A grouped section that settled empty leaves the page — see this component's docblock. An
	// ungrouped one never does: it is the whole menu, so empty is a state it has to draw.
	if (category && isEmpty) return null;

	return (
		<View
			style={styles.section}
			onLayout={
				onOffset
					? (event) =>
							onOffset(
								category?.id ?? ALL_GROUPS_KEY,
								event.nativeEvent.layout.y,
							)
					: undefined
			}
		>
			<View style={styles.sectionHead}>
				<Text variant="heading" bold style={styles.sectionTitle}>
					{category ? localizedName(category, locale) : t("store.products")}
				</Text>
				{/* The count is the server's — `businessStorefrontSchema.categories` carries
				    `productCount` per category — and not `items.length`, which is a page: the
				    number beside a group is the group's size, and it must not shrink as the
				    reader pages through it. A search has no such field, so its count is what
				    the response actually holds, which is what the rows below it are. */}
				{category ? (
					<Text variant="label" tone="muted" tabular>
						{tp("store.category.count", category.productCount ?? 0)}
					</Text>
				) : search === null ? null : (
					<Text variant="label" tone="muted" tabular>
						{tp("search.results", items.length)}
					</Text>
				)}
			</View>

			{products.isError ? (
				<View style={styles.pad}>
					<ErrorState
						error={products.error}
						onRetry={() => void products.refetch()}
					/>
				</View>
			) : waiting || !products.data ? (
				<ProductRowsSkeleton />
			) : isEmpty ? (
				<View style={styles.pad}>
					{/* Two sentences, because they answer two questions. `search.empty.title` is
					    the search's own "no encontramos nada con eso"; `state.empty` is the
					    dictionary's neutral "nothing here yet", and it is the one for a shop that
					    has not put anything on its menu. The business dictionary's version of that
					    sentence is addressed to the owner ("Todavía no tienes productos"), which is
					    the wrong person. See the report. */}
					<EmptyState
						icon={search === null ? "fast-food-outline" : "search-outline"}
						title={search === null ? t("state.empty") : t("search.empty.title")}
					/>
				</View>
			) : (
				<>
					<View style={styles.rows}>
						{items.map((product, index) => (
							<AnimateIn key={product.id} index={index}>
								<ProductRow
									product={product}
									onPress={() =>
										router.push({
											pathname: "/product/[id]",
											params: { id: product.id },
										})
									}
								/>
							</AnimateIn>
						))}
					</View>

					{/* `./list-end` draws the next page and the end of them, and holds both labels.
					    This section used to draw the button itself, and nothing at all once the
					    cursor ran out — so "that was everything" and "the next page never came"
					    were the same blank space under a heading that was still counting.
					    `items.length` is what is on screen, which is what keeps an empty group
					    from ending in an end statement it has not earned. */}
					<ListEnd
						rows={items.length}
						hasNextPage={products.hasNextPage}
						loading={products.isFetchingNextPage}
						onPress={() => void products.fetchNextPage()}
					/>
				</>
			)}
		</View>
	);
});

export default function Store() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const { t, tp, locale, intlLocale } = useT();
	const { status } = useSession();
	const bar = useActionBarClearance();

	const store = useQuery(trpc.businesses.bySlug.queryOptions({ slug }));

	/**
	 * The cart, for the bar — and only when there is a session to have one.
	 *
	 * `cart.get` is a protected procedure: asked without a token it answers 401, and a 401
	 * rendered as a failure on a shop's page would be a shop that will not load for a
	 * customer who has simply not signed in yet. Signed out, the query never runs and the
	 * bar is never drawn, which is also the honest answer — there is no cart to go to.
	 */
	const cart = useQuery(
		trpc.cart.get.queryOptions(undefined, { enabled: status === "signed-in" }),
	);

	const card = store.data?.card;

	// The shop's category, in the reader's language — the same `localizedName` the menu's
	// group headings read. `categoryNameEn` is nullable (the six demo categories the seed
	// writes carry Spanish only), so the fallback is the Spanish name.
	const categoryName = card?.categoryName
		? localizedName(
				{ name: card.categoryName, nameEn: card.categoryNameEn },
				locale,
			)
		: null;

	/**
	 * The reviews behind the rating.
	 *
	 * `businessId` is required by `reviewListInput` and the card is what carries it, so the
	 * input carries the empty string until the shop has answered and the query is disabled
	 * until then — a value that never reaches the wire, which is the price of the input
	 * schema being the contract. See the report.
	 */
	const reviews = useInfiniteQuery(
		trpc.reviews.list.infiniteQueryOptions(
			{ businessId: card?.id ?? "", limit: REVIEW_PAGE_SIZE },
			{
				enabled: !!card,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);

	const [query, setQuery] = useState("");
	const trimmed = query.trim();
	const settled = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
	const searching = settled.length >= MIN_SEARCH_LENGTH;

	/** The scroll offset, for `./store-nav` — written on the UI thread, never in React state. */
	const scrollY = useSharedValue(0);
	const scrollRef = useRef<ScrollView>(null);
	/**
	 * The rail's own height, which is the distance a heading must clear to count as "under the
	 * reader". Measured here rather than in state: it is read only inside `onJump`, so a
	 * measurement that re-rendered this screen on every layout would buy nothing.
	 */
	const railHeight = useRef(0);

	const [offsets, setOffsets] = useState<Record<string, number>>({});
	/**
	 * The categories that answered with no rows, **tagged with the shop they were read for**.
	 *
	 * Tagged rather than reset in an effect, because a shop is a route param: navigating from
	 * one storefront to the next reuses this component, and ids reported empty for the last
	 * shop would silently hide a group on this one. A tag makes the stale set unreadable
	 * instead of wrong.
	 */
	const [emptied, setEmptied] = useState<{
		slug: string;
		ids: readonly string[];
	}>({ slug, ids: NO_IDS });
	const emptyIds = emptied.slug === slug ? emptied.ids : NO_IDS;

	const onOffset = useCallback((key: string, y: number) => {
		setOffsets((prev) => (prev[key] === y ? prev : { ...prev, [key]: y }));
	}, []);

	const onEmpty = useCallback(
		(id: string) => {
			setEmptied((prev) => {
				if (prev.slug !== slug) return { slug, ids: [id] };
				if (prev.ids.includes(id)) return prev;
				return { slug, ids: [...prev.ids, id] };
			});
		},
		[slug],
	);

	const onScroll = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollY.value = event.contentOffset.y;
		},
	});

	// The rail's height is the reading line, so the target is the heading *minus* that height —
	// the same expression `store-nav.tsx` compares against. `animated` is the rail's decision.
	const onJump = useCallback((y: number, animated: boolean) => {
		scrollRef.current?.scrollTo({
			y: Math.max(0, y - railHeight.current),
			animated,
		});
	}, []);

	/**
	 * The pull: `./pull-refresh` holds the control (both tints, the gesture's own flag), and the
	 * docblock above (`## Refresh is a gesture, not a button`) says why a flag derived from the
	 * reads could not work here. What this screen contributes is what the gesture has to reach.
	 */
	const onRefresh = useCallback(
		() =>
			Promise.all([
				store.refetch(),
				reviews.refetch(),
				// The menu sections own their own queries, so the gesture reaches them by path
				// rather than through a result object this screen does not hold.
				cache.invalidateQueries({ queryKey: trpc.products.pathKey() }),
			]),
		[cache, reviews, store, trpc],
	);
	const refreshControl = useRefreshControl(onRefresh);

	const waitingForStore = useSkeletonHold(store.isPending);
	const reviewItems = reviews.data?.pages.flatMap((page) => page.items) ?? [];
	const distribution = reviewDistribution(reviewItems, card?.ratingCount ?? 0);

	const hours = store.data?.hours ?? NO_HOURS;
	const isOpen = store.data?.isOpen ?? false;
	const opensAt = closedUntil(hours, isOpen, intlLocale);

	/**
	 * The rail's groups, in the page's own order.
	 *
	 * A category with no products is not a group — `storefrontCategories` counts ACTIVE ones and
	 * a heading over nothing is a shrug — and a group whose page settled empty has already said
	 * so through `onEmpty`. While a search is in progress the menu is not grouped, so the rail
	 * draws nothing: `StoreNav` returns null for fewer than two groups, and the wrapper around
	 * it keeps child index 1 where `stickyHeaderIndices` expects it.
	 */
	const categories = (store.data?.categories ?? []).filter(
		(category) =>
			(category.productCount ?? 0) > 0 && !emptyIds.includes(category.id),
	);
	const groups = searching
		? NO_GROUPS
		: categories.map((category) => ({
				key: category.id,
				label: localizedName(category, locale),
			}));

	// This shop's cart, or nothing. See the docblock above.
	const mine =
		cart.data && cart.data.businessId === card?.id ? cart.data : null;
	const cartCount =
		mine?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
	const showCart = cartCount > 0 && mine !== null;

	// One "go back" for the header button and for the not-found screen below — `lib/leave`
	// owns the pair, and the fallback it is handed here is the feed.

	return (
		<View style={styles.root}>
			<Screen padded={false} contentStyle={styles.fill}>
				<Animated.ScrollView
					ref={scrollRef}
					onScroll={onScroll}
					// The rail is child 1 and must stay child 1 — see the docblock. 16ms is one
					// frame, which is as often as a highlight can change.
					scrollEventThrottle={16}
					stickyHeaderIndices={[1]}
					keyboardShouldPersistTaps="handled"
					// `./screen`'s two platform branches, transcribed — this scroll is not that
					// component's, and both values are the ones it would have given.
					keyboardDismissMode={
						Platform.OS === "ios" ? "interactive" : "on-drag"
					}
					// iOS only, and `undefined` rather than `false` elsewhere: React drops an
					// undefined prop, so Android never receives the key. Its window is resized by
					// the keyboard rather than covered by it, so it needs nothing.
					automaticallyAdjustKeyboardInsets={
						Platform.OS === "ios" ? true : undefined
					}
					// The bar is inside the inset the tab bar already paid; a scroll indicator
					// that runs under it reads as a rendering bug.
					scrollIndicatorInsets={{ bottom: 0 }}
					contentContainerStyle={{
						// The room the bar floats over, plus the tail every screen pays — this
						// scroll is not `Screen`'s, so its own `paddingBottom` is not here.
						//
						// The bar's number is measured, not predicted, and it already carries the
						// bottom inset the bar pays for itself: see `useActionBarClearance`. The
						// reason to measure is on this screen as much as any — at 200% text the
						// menu row under the bar is the row the customer is reading.
						paddingBottom: (showCart ? bar.clearance : 0) + space.huge,
					}}
					refreshControl={refreshControl}
				>
					{store.isError ? (
						// A slug we do not have is not a failure on our side, so it does not get the
						// error state — no "it's on our side, not yours", no request id to quote, and a
						// way out instead of a Retry that would ask the same dead slug again. That is
						// the distinction `category/[slug].tsx` already draws by hand.
						toApiFailure(store.error).code === "NOT_FOUND" ? (
							<View style={styles.pad}>
								<EmptyState
									icon="storefront-outline"
									title={t("store.notFound")}
									body={t("store.notFound.body")}
									actionLabel={t("action.back")}
									onAction={() => leaveScreen("/")}
								/>
							</View>
						) : (
							<View style={styles.pad}>
								<ErrorState
									error={store.error}
									onRetry={() => void store.refetch()}
								/>
							</View>
						)
					) : waitingForStore || !store.data || !card ? (
						<StorefrontSkeleton />
					) : (
						<View style={styles.head}>
							<View style={styles.pad}>
								<BackButton to="/" />
							</View>

							<View style={styles.pad}>
								{/* The card travels with the write so an optimistic add has something to
								    insert — see `@/lib/favorites` — and it rides in the hero's corner slot
								    so the heart sits on the `card` circle the hero draws for it rather than
								    on the photograph. */}
								<Hero
									coverUrl={card.coverUrl}
									name={card.name}
									meta={
										categoryName ? `${categoryName} · ${card.city}` : card.city
									}
									logoUrl={card.logoUrl}
									verified={card.isVerified}
									isOpen={isOpen}
									facts={<StoreFacts card={card} />}
									action={
										<FavoriteButton target={{ kind: "business", card }} />
									}
								/>
							</View>

							{/* When the shut shop opens — the hero says "Cerrado" and this says
							    when that ends. A closed day draws nothing: the "Hoy" row in
							    `./hours-table` below is its reason. */}
							{opensAt === null ? null : (
								<View style={styles.pad}>
									<Text variant="body" tone="muted">
										{t("store.closed.until", { time: opensAt })}
									</Text>
								</View>
							)}

							{card.description ? (
								<View style={styles.pad}>
									<Text variant="body" tone="muted">
										{card.description}
									</Text>
								</View>
							) : null}

							<View style={styles.pad}>
								<HoursTable hours={hours} isOpen={isOpen} />
							</View>

							{/* The field sits last in the head, immediately above the menu it
							    searches, so the rail sticks directly under it. */}
							{/* `colors.input`, for the reason `./field` uses it at rest
							    (`field.tsx:120`): `card` on `background` is 1.017:1, so this
							    outline is the only boundary the control has and it owes 3:1
							    (WCAG 1.4.11). `input` measures 3.24:1 on `card` in the light
							    theme and 3.10:1 in the dark one; `border` is the decorative
							    hairline at about 1.3:1 and belongs on `./card`, not here. */}
							<View
								style={[
									styles.field,
									{ backgroundColor: colors.card, borderColor: colors.input },
								]}
							>
								<Ionicons
									name="search-outline"
									size={icon.control}
									color={colors.mutedForeground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
								<TextInput
									value={query}
									onChangeText={setQuery}
									placeholder={t("store.search.placeholder")}
									placeholderTextColor={colors.mutedForeground}
									style={[styles.input, { color: colors.foreground }]}
									accessibilityLabel={t("search.title")}
									returnKeyType="search"
									autoCorrect={false}
									autoCapitalize="none"
									clearButtonMode="while-editing"
								/>
								{query.length > 0 ? (
									<Pressable
										onPress={() => setQuery("")}
										// The target under the glyph is `./pressable`'s own floor, so
										// `hitSlopFor` is asked for the answer for a control that is
										// already that wide — zero — and not for the difference
										// between the glyph and the floor.
										hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
										ripple={false}
										accessibilityRole="button"
										accessibilityLabel={t("search.clear")}
										style={styles.iconButton}
									>
										<Ionicons
											name="close-circle"
											size={icon.control}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</Pressable>
								) : null}
							</View>
						</View>
					)}

					{/* Always a child, always index 1 — a conditional one would move the sticky
					    index onto whatever followed it. */}
					<View
						onLayout={(event) => {
							railHeight.current = event.nativeEvent.layout.height;
						}}
					>
						<StoreNav
							groups={groups}
							offsets={offsets}
							scrollY={scrollY}
							onJump={onJump}
						/>
					</View>

					{!card ? null : searching ? (
						<MenuSection businessId={card.id} search={settled} />
					) : categories.length > 0 ? (
						categories.map((category) => (
							<MenuSection
								key={category.id}
								businessId={card.id}
								category={category}
								onOffset={onOffset}
								onEmpty={onEmpty}
							/>
						))
					) : (
						// A shop whose products carry no category at all: the menu still exists, it
						// is simply not grouped. Without this the grouping rule would hide every
						// product of every shop that never filled a category in — see the report.
						<MenuSection businessId={card.id} onOffset={onOffset} />
					)}

					{!card ? null : (
						<View style={styles.reviews}>
							{/* The score, the real count behind it and the spread when every row is
							    in hand — the facts that sit above the rows and are the page's,
							    not the list's. They pay the gutter here rather than on the block,
							    because `./review-list` draws its own rows and its own foot and
							    that foot pays a gutter of its own; see `styles.reviews`. No
							    heading above them: `./review-summary` already names the block —
							    "212 reseñas", or its empty sentence — so a "Reseñas" heading was
							    the same word twice. */}
							<View style={styles.reviewsHead}>
								<ReviewSummary
									average={card.ratingAvg}
									count={card.ratingCount}
									distribution={distribution}
								/>
								{/* The list's own failure, below a summary that is real data from
								    the store payload — a review read that failed must not remove
								    the score. */}
								{reviews.isError ? (
									<ErrorState
										error={reviews.error}
										onRetry={() => void reviews.refetch()}
									/>
								) : null}
							</View>
							{/* The reviews, as far as the API can answer them: the rows, and the
							    foot that says whether there are more. */}
							<ReviewList
								reviews={reviewItems}
								hasMore={reviews.hasNextPage}
								loadingMore={reviews.isFetchingNextPage}
								onLoadMore={() => void reviews.fetchNextPage()}
							/>
						</View>
					)}
				</Animated.ScrollView>
			</Screen>

			{/*
			 * Outside `Screen`, because the bar is a layer over the scroll rather than a row
			 * that takes height from it — the room it needs is the `contentContainerStyle`
			 * above. Absolute, so it is pinned to the bottom of this screen's own box.
			 */}
			{showCart && mine ? (
				<View style={styles.bar}>
					<ActionBar
						onHeightChange={bar.onHeightChange}
						summary={
							<View style={styles.summary}>
								{/* The count and the total, both `tabular`: they are figures a reader
								    compares against the cart, not prose. */}
								<Text variant="label" tone="muted" tabular>
									{tp("order.itemCount", cartCount)}
								</Text>
								<Price
									amountMinor={mine.totals.totalMinor}
									currency={mine.currency}
									variant="body"
								/>
							</View>
						}
						primary={{
							label: t("nav.cart"),
							onPress: () => router.push("/cart"),
						}}
					/>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	// The bar is absolute inside this, so the screen needs a box of its own to be pinned to.
	root: { flex: 1 },
	// `Screen` keeps its frame and its safe-area edges; the body is this screen's scroll, so it
	// is given the whole box and `padded` is off.
	fill: { flex: 1 },
	// This screen is edge-to-edge because its rows are; everything that is not a row pays
	// the horizontal padding for itself, and it is one style so it cannot drift.
	pad: { paddingHorizontal: space.lg },
	head: { gap: space.lg },
	// The search field, in `app/search.tsx`'s own shape: the same 300ms debounce, the
	// same two-character floor and — since the menu's query gained it — the same
	// `keepPreviousData`, so a customer who has used one has used both. What the two fields do
	// *not* share is the read behind them, which an earlier version of this comment claimed
	// they did: this one is `products.list` scoped by `businessId` with `search`, and that one
	// is `catalog.search`'s `q` over the whole marketplace.
	field: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		marginHorizontal: space.lg,
		paddingHorizontal: space.md,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.md,
		borderWidth: 1,
	},
	// `./pressable`'s base floors the box at `MIN_TOUCH_TARGET` and aligns nothing, so its
	// child draws at the top of it — which off the line the input beside it is set on.
	iconButton: { alignItems: "center", justifyContent: "center" },
	input: {
		flex: 1,
		fontSize: type.body.fontSize,
		minHeight: MIN_TOUCH_TARGET,
		// The same reset `app/search.tsx`'s field carries, for the same reason: this
		// is a bare RN `TextInput`, not `./field`, so `./text`'s base style never reaches it
		// and Android would reserve the font's ascent and descent around the typed value.
		includeFontPadding: false,
	},
	// The step between two menu groups is the page's own block gap — `ScreenSection`'s
	// `marginTop: space.xxl` — because a group is a block and not a line.
	section: { marginTop: space.xxl, gap: space.md },
	// The group's heading and its count share a line, and the count is not `SectionHeader`'s
	// `action` — that slot is a control with an `onPress`, and a number is not a control.
	// Baseline, a `type.heading.lineHeight` floor and a title that yields are
	// `app/search.tsx`'s `groupHead` anatomy: the two "heading + count" rows are one shape,
	// and the floor keeps the head at the heading's own height wherever only the count draws.
	sectionHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
		paddingHorizontal: space.lg,
		minHeight: type.heading.lineHeight,
	},
	// The name yields to its count rather than pushing it off the line, and wraps inside the
	// width that is left — a second line of the name at 200% text, never a truncation — the
	// same yield `app/search.tsx`'s `groupTitle` pays.
	sectionTitle: { flexShrink: 1 },
	rows: {
		marginHorizontal: space.lg,
		borderRadius: radius.md,
		overflow: "hidden",
	},
	// The block is a column of two things — the facts above the reviews and the reviews — and
	// it pays no gutter of its own: the rows and the foot inside `./review-list` pay theirs, and
	// `./list-end`'s inset is its own, so a gutter here as well would draw the list's button a
	// step narrower than the reviews above it.
	reviews: {
		marginTop: space.xxl,
		gap: space.md,
	},
	// The two facts above the list: `./review-summary`'s average and count, and the list's own
	// failure. One row, because they are one block — the same `space.md` the block used to put
	// between its children.
	reviewsHead: { gap: space.md, paddingHorizontal: space.lg },
	bar: { position: "absolute", left: 0, right: 0, bottom: 0 },
	// The count over the total: one text stack — one fact about the cart — so the gap
	// between its two lines is `TEXT_STACK_GAP`, not a `space` step, which is the rhythm
	// *between* blocks rather than inside one.
	summary: { gap: TEXT_STACK_GAP },
});
