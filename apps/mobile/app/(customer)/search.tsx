import Ionicons from "@expo/vector-icons/Ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import {
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { BusinessCard } from "@/components/business-card";
import { CategoryRail } from "@/components/category-rail";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { ProductRow } from "@/components/product-row";
import { useRefreshControl } from "@/components/pull-refresh";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { useSkeletonHold } from "@/components/skeleton";
import { SearchResultsSkeleton } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useTRPC } from "@/lib/trpc/context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

/**
 * Search, over products and shops at once.
 *
 * One box, one call, three lists. `catalog.search` returns `{products, businesses,
 * categories}` and all three are drawn — a customer who types "café" does not know or care
 * that the shop selling it, the bag of it and the category it sits in are different rows in
 * different tables, and asking them to choose a tab before typing is asking them to guess
 * which one we index. (This said "renders the first two" until the third was added: the
 * omission was documented rather than hidden, which is exactly why it lasted.)
 *
 * The debounce is 300ms and it is deliberate: a request per keystroke is a request per
 * keystroke on a phone network, and the API rate-limits by IP. 300 is short enough that a
 * fast typist never notices and long enough that a slow one makes one request instead of
 * six. The input stays uncontrolled by React Query — what is typed is state here, and only
 * the settled value is a query key. The timer is `useDebouncedValue`'s: a `setTimeout` is
 * state that outlives a render, so it lives in `lib` beside the other hook with a lifetime
 * rather than in this screen's render.
 *
 * ## The results are a set you switch between, not a page you scroll
 *
 * The three lists used to be three stacked sections, which is a page: to find out whether
 * "café" matched a shop you scrolled past the products. They are now one list at a time
 * behind `./segmented` (Todo / Negocios / Productos), shown only when both switchable kinds
 * came back with rows — with one kind, "Todo" and that kind are the same list and the
 * control would be furniture. It selects nothing and narrows nothing: `catalog.search` takes
 * `{q, lat?, lng?}` and no filters, so all three lists arrived in the one call that is
 * already in hand, and a segment is a view of that response rather than a second request.
 * The categories rail stays under "Todo" and is not a segment, because it is a way out of
 * the results into the pages that own a filter, not a kind of result.
 *
 * ## Every state is drawn
 *
 * Five of them, and none is the default: nothing typed yet, the search running, the search
 * refused, a search that found nothing, and the results. (Five since the category banner was
 * deleted — it was drawn *over* one of these rather than being one, so removing it changed
 * no count.) The running one is `SearchResultsSkeleton` — the count, the switcher and one
 * headed group of shop cards, in grey — because the shape of a result list is not a question,
 * and because the field above it stays mounted and usable while it is there. The idle one is
 * the field, the categories heading and the rail under it. Of the four that remain, two are
 * sentences with a way out of each — a search the API refused, and a search that matched
 * nothing — and the other two are the list itself, in grey and then in full. (It was five
 * states with four sentences until the idle state stopped being one of them; see the section
 * below, which is also where the history that used to be drawn there is accounted for.)
 *
 * That grey is exactly that shape and no more, and the limit is `./skeletons`' own: how many
 * of the three kinds a query will return is not knowable before the response arrives, so a
 * second and a third group would resolve into nothing and pull the page up under a reader who
 * was already looking at it. The one group it draws is the first the results draw — the shops,
 * as `CardBlock`s in the same `space.lg`-inset, `space.md`-gapped column — so the wait matches
 * the page down to the end of its first group and stops there. The count and the switcher
 * above it are the screen's own boxes at the screen's own margins, so nothing that is on
 * screen before the results move when they land.
 *
 * ## The idle state is the field and the categories, and nothing else
 *
 * Nothing typed yet used to draw three things: an `EmptyState` headed `search.title`, a
 * history of past terms, and the category rail. The heading is gone because the page it named
 * is named by the screen the reader has just opened — the word stood at the top of the screen
 * over a field that already carries it as its own accessibility label — and because
 * `./empty-state` is the shape for "nothing here, and what to do about it", which this branch
 * is not: there is something to do about it, and it is directly below. Its `body` had already
 * gone for the same reason, when it was `home.search.placeholder` word for word.
 *
 * The history went with it, and that was the deletion of a working feature rather than of a
 * defect. `lib/recent-searches` is untouched and its rule about *when* a term is remembered is
 * unchanged; what changed is that no screen calls it any more. The judgement is about this
 * state and not about history: this is the screen a customer opens in order to type, the keyboard
 * is the first thing they want, and a list of what they looked for last competes with the one
 * row that says what this marketplace sells at all. The field is what this state is *for* — it
 * is focused on arrival and it holds the screen's whole interaction — and the rail is the one
 * thing that earns the space under it. The store stays in `lib`
 * because the decision belongs to a screen rather than to a store, and Rule 7's table in
 * `docs/design-mobile.md` names the module; that file's entry says where it is read from today.
 *
 * What the state draws instead is the category rail — the same `Group` and the same
 * `./category-rail` the results branch draws, so the two states offer the same way out. It is
 * the right content for *this* state rather than a generic "browse" consolation: the rail is
 * "the one row that says what this marketplace sells" in its own words, it is the entry point
 * the feed already puts first, and every chip is a real page (`/category/[slug]`) with a real
 * list behind it rather than a second empty state.
 *
 * It costs no new endpoint: `catalog.categories` is a public query that already exists and is
 * already read by a client, and `app/category/[slug]` reads it under the same key, so those
 * two share one cache entry. Nothing about `catalog.search` changes: the categories the
 * *results* branch draws its rail from are a different read with a different meaning — the
 * categories a query matched, against every category that exists — and the two are never on
 * screen together, because the idle branch is the branch where there is no response to take
 * them from. The read's real cost is written where it is made.
 *
 * ## The `category` param, and why there is no banner for it
 *
 * This screen used to render a banner when opened as `/search?category=<slug>`, printing the
 * slug itself — "Buscar: comida-rapida" — with a clear button that only cleared the param.
 * It was not a search (the query string is the only input `catalog.search` takes) and it was
 * not the category's name either, because resolving a slug to a name is a second read this
 * screen never made. A chip on the home feed was its only author, and that chip now opens
 * `app/category/[slug]`, which resolves the slug and lists the shops in it; the parameter
 * was already documented here as carrying something this screen cannot honour.
 *
 * So the banner is deleted rather than repaired. Keeping it and resolving the name would
 * have produced a label over an unfiltered list — the reader would be told a filter was
 * applied while every result on the screen ignored it. The categories a query *does* match
 * are drawn as a rail under the results, where tapping one goes to the page that owns the
 * filter. A `/search?category=` link that still exists somewhere opens a plain search box,
 * which is the truth of what this screen does with it.
 *
 * ## The filter sheet, and the only way in this screen can honestly offer
 *
 * The brief for this pass asked for the sheet's entry point here, and this screen cannot host
 * the sheet itself. `catalog.search` takes `{q, lat?, lng?}` and nothing else — that input
 * object is the whole contract — while `./filter-sheet` edits `{openNow, deliveryOnly,
 * radiusKm, sort}`, four fields no search request has a slot for. A sheet mounted on this
 * screen would collect choices, close, and change nothing about the list under it, which is a
 * worse lie than the deleted category banner: the banner printed a filter that had not been
 * applied, and a sheet here would *ask* for one.
 *
 * So the entry point is the shops group's "Ver todo" (`shopsAction` above the return), which
 * opens `app/nearby` — the screen that mounts the sheet and passes its state into
 * `businesses.list`. The sheet stays where its choices reach a query, and this screen's own
 * way to a narrowed list is that action plus the categories rail under the results, where each
 * chip opens the category page that owns its own filter. Same for a sort control:
 * `catalog.search` has no ordering input for one to move, so a visible sort here would be
 * furniture, and this file declines to draw it and reports the absence instead.
 *
 * ## Shops first, and the two counts
 *
 * `docs/design-mobile.md`'s Rule 4, in its own words: "Search results group too: shops, then
 * products, each with its count." The count of a group is `businesses.length` /
 * `products.length` — what the response actually holds, which is also what the rows beneath it
 * are — and every number on this screen is `tabular`, because proportional digits make a count
 * that goes 9 → 10 → 11 shuffle the words after it as the reader types. The switcher's
 * segments carry the same two numbers as badges, so a chosen segment still states its own size
 * with the group header gone.
 */
/**
 * Which of the response's lists the reader is looking at.
 *
 * "all" is the default and the fallback: an unanswered search has no kinds to switch
 * between, and `mode` above drops back to it the moment one kind runs out. It is not a
 * route and not a param — the switcher changes what is drawn from a response that is already
 * in hand, so nothing refetches and the reader's scroll position is the only thing that
 * moves.
 */
type SearchMode = "all" | "businesses" | "products";

export default function SearchScreen() {
	const trpc = useTRPC();
	const { t, tp } = useT();
	const { colors } = useTheme();
	const { coords } = useDeviceLocation();

	const [query, setQuery] = useState("");
	const [chosen, setChosen] = useState<SearchMode>("all");

	const trimmed = query.trim();
	// Under two characters is not a search, it is the beginning of one — and it would match
	// most of the catalogue. Trimmed *before* the debounce rather than after it, so the
	// settled value is the query key too: "café " and "café" are one cache entry rather than
	// two, and a stray space cannot become a search of its own.
	const settled = useDebouncedValue(trimmed, 300);

	const results = useQuery(
		trpc.catalog.search.queryOptions(
			{ q: settled, lat: coords?.lat, lng: coords?.lng },
			{
				// Nothing typed yet is not a failure and not a query. Without this the screen
				// fires an empty search on mount and `q`'s `min(1)` refuses it, which renders
				// as an error on a screen nobody has used yet.
				enabled: settled.length >= 2,
				// A word that replaces another keeps the previous word's rows on screen while
				// its own request is out. The field above the list is mounted and usable for
				// the whole debounce, so without this a fast typist reads a skeleton where
				// their last search was — the same page they were reading, replaced by grey,
				// once per keystroke that settles.
				placeholderData: keepPreviousData,
			},
		),
	);

	/*
	 * The categories, for the one state that has no search to take them from.
	 *
	 * `results` is `enabled` only from two characters up, so on the idle branch `results.data`
	 * is undefined and the `categories` the response carries do not exist — which is why this
	 * is a second read rather than a second use of the first one.
	 *
	 * What it costs, stated exactly rather than as "free". It is not a new endpoint:
	 * `catalogRouter.categories` is a public query that already exists, and
	 * `app/category/[slug].tsx` reads it under this same key, so those two screens share one
	 * cache entry. It is bounded: the service filters to active rows and caps at 500, above
	 * the 242 the taxonomy is written with (`apps/api/src/services/catalog.ts`). It is *not*
	 * cached in the Worker — `publicProcedure`
	 * is a bare `t.procedure` and the service runs its D1 query on every call, so the 30s
	 * `staleTime` in `lib/trpc/provider.tsx` is the whole of the cache. And the feed does **not**
	 * share this key: `app/index.tsx` reads `catalog.feed`, which carries the same rows
	 * inside its own response, so a reader arriving here from the feed pays one request the
	 * first time this screen mounts and a reader arriving from a category page pays none. What is
	 * never paid is a call per keystroke — this read does not depend on the field.
	 *
	 * It is not gated on `settled.length < 2` either. The screen opens in this state, and a
	 * query that switched itself off would come back stale on every clear of the field — a
	 * fetch per time the reader empties the box, in exchange for nothing.
	 *
	 * `rail` is every active *sector* — the taxonomy's first level, and only that. The read
	 * returns both levels (18 sectors and their 224 children), and this state's rail is a
	 * strip: 242 chips is a row nobody reaches the end of, and the second level sitting
	 * among the first reads as more of the same. The children are one tap in, on the
	 * sector's own page. Filtering here rather than in `./category-rail` is deliberate: the
	 * *results* rail below draws the categories a query matched, and a child that matched a
	 * typed word is a real answer — see that component's docblock. Filtering here also
	 * keeps the heading's count equal to the chips under it.
	 *
	 * The `categories` this screen later takes from the search response are the ones a
	 * *query* matched, which is a different set with a different meaning, so the two are
	 * named apart.
	 *
	 * A failure draws no rail rather than an error state, and that is the honest rendering of
	 * it: the rail is an addition to a screen that was already complete without it, and
	 * `./category-rail` returns `null` for an empty list so there is no heading left over a
	 * shrug. `app/category/[slug].tsx` draws the failure because there the same read *is* the
	 * page — it is the authority on whether the slug exists at all.
	 */
	const allCategories = useQuery(trpc.catalog.categories.queryOptions());
	const rail = (allCategories.data ?? []).filter(
		(category) => category.parentId === null,
	);

	// The hold is what keeps a search that answers in 80ms from painting grey for 80ms —
	// which on this screen is the common case, because the second search for the same word
	// is a cache hit.
	const waiting = useSkeletonHold(results.isPending);

	const products = results.data?.products ?? [];
	const businesses = results.data?.businesses ?? [];
	/*
	 * The third group the API has always returned and this screen silently dropped. The
	 * docblock above records the omission in a parenthesis — it was written down rather than
	 * hidden, which is how it survived as long as it did. It is not only completeness: the
	 * count below and the empty state were both computed from two of the three, so a query
	 * that matched only a category showed "No encontramos nada con eso" over a response
	 * carrying up to ten matching categories.
	 */
	const categories = results.data?.categories ?? [];
	/*
	 * What is on screen, not what exists. The three lists arrive already capped by
	 * `catalog.search` (20 products, 10 shops, 10 categories) and the procedure returns no
	 * total, so summing them is the only number available — and "Mostrando"/"Showing" claims
	 * what is rendered, so it is the right one. It was named `total`, which reads as the
	 * other thing. See `apps/web/components/catalog/search-screen.tsx` for why a real total
	 * is not worth three `count(*)` full scans per settled search.
	 */
	const shown = products.length + businesses.length + categories.length;
	/*
	 * `isPlaceholderData` is excluded for the same reason `isPending` is. With
	 * `keepPreviousData` a settled word draws the *previous* word's response while its own
	 * request is out — and a previous response that matched nothing would print "no
	 * encontramos nada" over a search whose answer has not arrived yet. The empty state is
	 * for a response that says zero, not for a response that is not here.
	 */
	const empty =
		settled.length >= 2 &&
		!results.isPending &&
		!results.isError &&
		!results.isPlaceholderData;

	/*
	 * The switch, and the two rules that keep it from lying.
	 *
	 * It is drawn only when both switchable kinds came back with rows: with one kind, "Todo"
	 * and that kind are the same list, and a switcher whose segments show the same thing is
	 * furniture. `catalog.search` takes no filters (`{q, lat?, lng?}` and nothing else — see
	 * `apps/api/src/routers/catalog.ts`), so a segment is a *view* of the response and never
	 * a narrower query; the three lists all arrived in one call before anything was chosen.
	 *
	 * `mode` is derived rather than stored, and that is the honest part: a new search can
	 * return nothing of the chosen kind, and a stored mode would strand the reader on an
	 * empty list with the switcher gone. Falling back to "all" shows them what did come back.
	 */
	const switchable = businesses.length > 0 && products.length > 0;
	const mode = switchable ? chosen : "all";

	// The count of what the chosen segment is actually showing. Under "all" it is the same
	// sum as before; under one kind it is that kind's own length, which is the number the
	// reader can check against the rows beneath it.
	const visible =
		mode === "businesses"
			? businesses.length
			: mode === "products"
				? products.length
				: shown;

	/*
	 * The way out of the shops group, and this screen's honest answer to "where are the
	 * filters". `docs/design-mobile.md`'s Rule 4 is titled "group, and let the group be
	 * navigable", and the only screen a group of shops can navigate to that narrows anything is
	 * `app/nearby` — the one that mounts `./filter-sheet` and draws the five sorts, none of
	 * which `catalog.search` has an input for. `action.viewAll` is the same label the feed's
	 * section headers carry for the same jump, so "Ver todo" here reads as the move it is.
	 *
	 * Only under "Todo", and only for shops: under a chosen segment there is no group header for
	 * an action to sit on, and there is no "all products" screen for the products group to offer
	 * (`app/featured` is featured products, which is a different set from anything a query
	 * matched).
	 */
	const shopsAction =
		mode === "all"
			? { label: t("action.viewAll"), onPress: () => router.push("/nearby") }
			: undefined;

	/*
	 * The pull on the results, which is the one list on this screen whose data can change
	 * while it is on screen (`docs/design-mobile.md`'s Rule 6). It re-asks the settled word's
	 * own query — the response is a snapshot of the catalogue, and "is there something new
	 * for this word" is the question a pull here answers.
	 *
	 * The control — both tints, a flag that belongs to the gesture rather than to a query that
	 * also refetches when nobody pulled, and `undefined` rather than a control that never
	 * refreshes — is `./pull-refresh`'s, which is where those three rules are written down.
	 *
	 * The other three scroll views on this screen carry none, and each for its own reason. The
	 * skeleton's is a wait, and a pull on a wait is a second wait. `./category-rail`'s is
	 * horizontal and nested inside one of the other two. The idle branch's is the one that needs
	 * a reason rather than a shrug, because it *is* a rendered server list: `catalog.categories`
	 * is a fixed taxonomy, so a pull would refetch fifty rows that do not move and hand back the
	 * same chips — a gesture whose result the customer could not tell from its failure. It is
	 * re-read where it genuinely changes: this read and `app/category/[slug]`'s are one cache
	 * entry with a 30s `staleTime`, so opening a category page reads it again, and typing leaves
	 * the branch entirely.
	 */
	const refreshControl = useRefreshControl(results.refetch);

	return (
		<Screen padded={false}>
			{/* A pushed screen now, not a tab: the stack header stays off, so the
			    way back is drawn here, the way every pushed list draws it. */}
			<View style={styles.back}>
				<BackButton to="/" />
			</View>
			{/* `colors.input` and not `colors.border`: this field is `card` on `background`, so
			    its outline is the only boundary a customer can find, and a control's boundary
			    owes 3:1 (WCAG 1.4.11). `input` is 3.24:1 on `card` in the light theme and 3.10:1
			    in the dark one; `border` is the decorative hairline at about 1.3:1, which is
			    what `./card` and `./list-row` want and what this does not. `./field` draws its
			    own resting border in the same token (`field.tsx:120`); this field is hand-rolled
			    because it is a search box and not a labelled form field, and the token is the
			    part that has to match. */}
			<View
				style={[
					styles.field,
					{ backgroundColor: colors.card, borderColor: colors.input },
				]}
			>
				{/* Decorative, and hidden the way the clear button below hides its own glyph: the
				    field announces itself through the `TextInput`'s label, and a mark beside it is a
				    second thing a reader would land on. `app/store/[slug].tsx` draws the identical
				    hand-rolled field and hides this same magnifier. */}
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
					placeholder={t("home.search.placeholder")}
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
						// `hitSlopFor`'s answer for a control that is already the floor across,
						// which is what `./pressable`'s base style lays this out at: the slop
						// grows the box, it does not supply the floor, and 13 points of it would
						// clear the row's own `gap` and take the last of the typed query with it.
						// Android's ripple is off here because a circle rippling inside a
						// rounded field reads as the field itself being pressed.
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

			{settled.length < 2 ? (
				<ScrollView
					contentContainerStyle={styles.scroll}
					keyboardShouldPersistTaps="handled"
					scrollIndicatorInsets={{ bottom: 0 }}
					// The rail scrolls rather than sitting under a keyboard-anchored list: with
					// the keyboard open, `automaticallyAdjustKeyboardInsets` is what keeps the
					// chips above it on iOS, and Android's resized window does the same without
					// being asked (`components/screen.tsx` has the evidence).
					automaticallyAdjustKeyboardInsets={
						Platform.OS === "ios" ? true : undefined
					}
				>
					{/* The whole of this state, which is the whole of this screen on a fresh
					    install: the same `Group` and the same rail the results branch draws,
					    because it is the same set of categories — this branch reads them from
					    `catalog.categories` rather than from a search response it does not have.

					    Nothing is drawn when the categories are empty or still on the way —
					    `./category-rail` returns `null` for the empty list, and a heading over a
					    rail that is not there is a heading with a shrug under it. Nothing is
					    drawn when the read *fails* either, which is the honest rendering: the
					    rail is an addition to a screen that is complete without it, and
					    `app/category/[slug]` is where the same read *is* the page and therefore
					    where its failure is drawn.

					    No wrapper and no inset of its own: the rail pays `space.lg` on its own
					    scroll's content (`./category-rail`'s `rail` style), and this screen is
					    `padded={false}`, so a wrapper here would double it. `Group`'s head pays
					    the same step, which is what `Group` exists for on this screen.

					    ## The action, and why this branch is the only place it belongs

					    A rail is a shortcut, not an index: it shows the first categories the
					    taxonomy has and hides the rest behind a gesture nobody is told about.
					    `app/categories` is the index — every active category as a 2-up grid —
					    and this head is its way in, in the same `{label, onPress}` shape and
					    under the same `action.viewAll` label the feed's own category heading
					    carries for the same jump. So the label is a landed key and not a
					    sentence written here (Rule 8).

					    The results branch's categories `Group` deliberately has none, and the
					    difference is the whole reason: those are the categories a *query*
					    matched, and a "Ver todo" beside them would promise every one of them
					    and deliver a different set — the taxonomy. A link whose count and
					    whose destination disagree is worse than no link. `shopsAction`
					    above is drawn under the same constraint and for the same reason. */}
					{rail.length > 0 ? (
						<Group
							title={t("search.categories")}
							count={rail.length}
							action={{
								label: t("action.viewAll"),
								onPress: () => router.push("/categories"),
							}}
						>
							<CategoryRail categories={rail} />
						</Group>
					) : null}
				</ScrollView>
			) : results.isError ? (
				// Before the skeleton, not after: a failure must not sit behind the minimum
				// hold that was meant for a fast success.
				<View style={styles.stateWrap}>
					<ErrorState
						error={results.error}
						onRetry={() => void results.refetch()}
					/>
				</View>
			) : waiting || !results.data ? (
				<ScrollView
					contentContainerStyle={styles.scroll}
					keyboardShouldPersistTaps="handled"
					scrollIndicatorInsets={{ bottom: 0 }}
					// iOS only, and no value at all on Android — `components/screen.tsx`'s prop
					// docblock carries the platform reasoning. This screen cannot borrow it:
					// `Screen`'s own `scroll`/`keyboardInsets` pair wraps the whole body, and the
					// field has to stay mounted above the results that scroll under it, so each
					// scroll view here opts in itself.
					automaticallyAdjustKeyboardInsets={
						Platform.OS === "ios" ? true : undefined
					}
				>
					<SearchResultsSkeleton />
				</ScrollView>
			) : empty && shown === 0 ? (
				<View style={styles.stateWrap}>
					<EmptyState
						icon="search-outline"
						title={t("search.empty.title")}
						body={t("search.empty.body")}
						actionLabel={t("search.clear")}
						onAction={() => setQuery("")}
					/>
				</View>
			) : (
				<ScrollView
					contentContainerStyle={styles.scroll}
					keyboardShouldPersistTaps="handled"
					scrollIndicatorInsets={{ bottom: 0 }}
					// iOS only, and no value at all on Android — `components/screen.tsx`'s prop
					// docblock carries the platform reasoning. This screen cannot borrow it:
					// `Screen`'s own `scroll`/`keyboardInsets` pair wraps the whole body, and the
					// field has to stay mounted above the results that scroll under it, so each
					// scroll view here opts in itself.
					automaticallyAdjustKeyboardInsets={
						Platform.OS === "ios" ? true : undefined
					}
					refreshControl={refreshControl}
				>
					{/* The count, or the fact that it is not the right count yet. A settled word
					    draws the previous word's rows while its own request is out
					    (`placeholderData` above), and with them it would draw their number —
					    "Mostrando 12 resultados" over a response that belongs to the word before
					    this one, which is a number for a search that has not answered. So while
					    the data is a placeholder the line says the search is running —
					    `state.loading`, the dictionary's own word — and the number comes back
					    with the response it belongs to. */}
					{results.isPlaceholderData ? (
						<Text variant="label" tone="muted" style={styles.count}>
							{t("state.loading")}
						</Text>
					) : (
						/* `tabular`: the number is what changes as the reader types, and
						   proportional digits make a count that goes 9 → 10 → 11 shuffle the
						   words after it. Same class the web's search screen carries. */
						<Text tabular variant="label" tone="muted" style={styles.count}>
							{/* `tp`, not `t` — `search.results` is a `key`/`key_plural` pair, and
							    a search matching exactly one thing read "Mostrando 1
							    resultados". Under a chosen segment `visible` is that segment's
							    own length, so the number counts the rows under it rather than
							    the whole response. */}
							{tp("search.results", visible)}
						</Text>
					)}

					{/* The switcher, above the lists it switches between. Three labels that already
					    exist — `category.all`, `search.businesses`, `search.products` — because the
					    screen's own section headings are those words, and a switcher that named the
					    same set differently would read as a second, unrelated control. */}
					{switchable ? (
						<View style={styles.mode}>
							<Segmented
								label={t("discovery.search.mode")}
								value={mode}
								onChange={(value) => setChosen(value as SearchMode)}
								options={[
									{ value: "all", label: t("category.all") },
									{
										value: "businesses",
										label: t("search.businesses"),
										// The group's own count, which is the number of rows under it.
										// `badge` is `./segmented`'s, rendered `tabular` — so the count
										// rule holds under a chosen segment too, where the group
										// heading and its count are gone.
										badge: String(businesses.length),
									},
									{
										value: "products",
										label: t("search.products"),
										badge: String(products.length),
									},
								]}
							/>
						</View>
					) : null}

					{mode !== "products" && businesses.length > 0 ? (
						// The heading is the switcher's word, so a chosen segment would repeat it
						// directly under itself. `Group` drops the header in that case rather than
						// printing the same word twice.
						<Group
							title={mode === "all" ? t("search.businesses") : undefined}
							count={businesses.length}
							action={shopsAction}
						>
							<View style={styles.cards}>
								{businesses.map((business, index) => (
									<AnimateIn key={business.id} index={index}>
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
								))}
							</View>
						</Group>
					) : null}

					{mode !== "businesses" && products.length > 0 ? (
						<Group
							title={mode === "all" ? t("search.products") : undefined}
							count={products.length}
						>
							<View style={styles.rows}>
								{products.map((product, index) => (
									<AnimateIn key={product.id} index={index}>
										<ProductRow
											product={product}
											showSeller
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
						</Group>
					) : null}
					{/* The categories stay under "Todo" only. They are not a kind of result the
					    switcher offers, they are the query's own way into the category pages —
					    and under "Productos" a rail of places to go would be an exit from the
					    list the reader just asked to see. */}
					{mode === "all" && categories.length > 0 ? (
						/* Through `Group` like the other two, so the heading is inset and carries
						   its count — the three groups on this page are one shape. */
						<Group title={t("search.categories")} count={categories.length}>
							<CategoryRail categories={categories} />
						</Group>
					) : null}
				</ScrollView>
			)}
		</Screen>
	);
}

/**
 * A list with a heading and its count, or without a heading at all.
 *
 * The head is built here rather than taken from `./screen`'s `ScreenSection`, and that is a
 * defect fix as much as a feature: `ScreenSection`'s own head — `sectionStyles.head` in
 * `./screen` — carries no `paddingHorizontal`, because it is written for a screen that left `padded` at
 * its default and is being inset by `Screen`'s body wrapper. This screen is `padded={false}` —
 * its cards and rows bleed to the gutter and pay `space.lg` themselves — so a `ScreenSection`
 * title here was drawn flush to the screen's edge while the rail beneath it started at
 * `space.lg`. The heading is the one thing on this page that could not be fixed from the
 * call site: a wrapper View around `ScreenSection` would inset the rail's chips with it.
 *
 * The count is the group's own length, which is what the rows under it are, and it is
 * `tabular` for the reason the total above is: it is the number that changes as the reader
 * types. Under a chosen segment the heading is the word already sitting in the switcher
 * directly above, so `title` is undefined there and no head is drawn — the segment carries
 * the count as a badge instead. Printing the word twice, eight points apart, is what the
 * optional title exists to prevent.
 *
 * `action` is `./section-header`'s "see all", and it is spelled the same way on purpose: a
 * `{label, onPress}` object, a `Pressable`, `tone="action"` — the tone that component draws
 * the same link in, ink that is read rather than a fill that is pressed, which is also what
 * survives the merchant palette — and a target grown vertically through `hitSlop` rather
 * than by drawing a 44pt box beside a 17pt heading. That component cannot be used here
 * because it has no count, and its own head has the same inset problem `ScreenSection`'s
 * does.
 */
function Group({
	title,
	count,
	action,
	children,
}: {
	title?: string;
	count?: number;
	action?: { label: string; onPress: () => void };
	children: ReactNode;
}) {
	if (!title) return <View style={styles.solo}>{children}</View>;
	return (
		<View style={styles.solo}>
			<View style={styles.groupHead}>
				<Text variant="heading" bold style={styles.groupTitle}>
					{title}
				</Text>
				<View style={styles.groupMeta}>
					{count === undefined ? null : (
						<Text variant="label" tone="muted" tabular>
							{count}
						</Text>
					)}
					{action ? (
						<Pressable
							onPress={action.onPress}
							accessibilityRole="button"
							accessibilityLabel={action.label}
							// Vertical only: to the left is the count, and a horizontal slop would
							// swallow the number.
							hitSlop={{ top: space.md, bottom: space.md }}
							style={styles.groupAction}
						>
							<Text variant="label" tone="action" bold>
								{action.label}
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	back: { paddingHorizontal: space.lg, paddingBottom: space.sm },
	field: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		marginHorizontal: space.lg,
		marginTop: space.md,
		paddingHorizontal: space.md,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.md,
		borderWidth: 1,
	},
	input: {
		flex: 1,
		fontSize: type.body.fontSize,
		minHeight: MIN_TOUCH_TARGET,
		// This field is a bare RN `TextInput` and not `./field`, so it does not receive
		// `./text`'s base style and has to carry the reset itself — the contract
		// `docs/design-mobile.md` states and `./field`'s own `input` already keeps. Without
		// it Android reserves the font's ascent and descent on top of the line box and the
		// typed query sits low inside a `MIN_TOUCH_TARGET` box that centres on iOS.
		includeFontPadding: false,
	},
	scroll: { paddingBottom: space.huge },
	stateWrap: { paddingHorizontal: space.lg },
	// `./pressable`'s base floors the box at `MIN_TOUCH_TARGET` and aligns nothing, so its
	// child draws at the top of it — invisible on a full-width row, 13 points off the line in
	// a field whose input sits on that line. `./back-button` centres for the same reason.
	iconButton: { alignItems: "center", justifyContent: "center" },
	count: { paddingHorizontal: space.lg, marginTop: space.md },
	mode: { paddingHorizontal: space.lg, marginTop: space.md },
	// `ScreenSection`'s wrap margin, which a header-less group still needs: the count and the
	// switcher above it are not part of the list.
	solo: { marginTop: space.xxl },
	// `ScreenSection`'s head, restated with the inset that component relies on the screen for:
	// `type.heading.lineHeight` as the floor, and the count on the heading's own baseline
	// rather than the row's centre — the same anatomy `app/store/[slug].tsx`'s `sectionHead`
	// draws, so the browse screens' "heading + count" rows are one shape and not two.
	groupHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		paddingHorizontal: space.lg,
		marginBottom: space.md,
		minHeight: type.heading.lineHeight,
	},
	// The title yields to the count and the action rather than pushing them off the line: at
	// 200% text "Productos" and its number cannot both fit, and the word that wraps is the one
	// that can be read again.
	groupTitle: { flexShrink: 1, marginRight: space.sm },
	groupMeta: { flexDirection: "row", alignItems: "center", gap: space.md },
	// The label's own line height, so the header's height stays the title's and a 44pt target
	// does not push the list below it down — `./section-header`'s own rule, same style.
	groupAction: { justifyContent: "center" },
	rows: {
		marginHorizontal: space.lg,
		borderRadius: radius.md,
		overflow: "hidden",
	},
	cards: { paddingHorizontal: space.lg, gap: space.md },
});
