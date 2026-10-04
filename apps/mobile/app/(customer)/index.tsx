import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type BusinessCard as BusinessCardData,
	type Category,
	type Currency,
	formatMoney,
	type ProductCard,
	type ProductSearchResult,
	type PromotionCard,
} from "@pymeshub/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BackHandler,
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";

import { ActionBar, useActionBarClearance } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BusinessCard } from "@/components/business-card";
import { CategoryShowcase } from "@/components/category-showcase";
import { CouponStrip } from "@/components/coupon-strip";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { HeroSearch } from "@/components/hero-search";
import { HomeGradient } from "@/components/home-gradient";
import { HomeHeader } from "@/components/home-header";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { ProductRail } from "@/components/product-rail";
import { ProductRow } from "@/components/product-row";
import { PromoHero } from "@/components/promo-hero";
import { useRefreshControl } from "@/components/pull-refresh";
import { Rail } from "@/components/rail";
import { RollbackNotice } from "@/components/rollback-notice";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { useSkeletonHold } from "@/components/skeleton";
import {
	FeedSkeleton,
	ProductRowsSkeleton,
	SearchResultsSkeleton,
} from "@/components/skeletons";
import { useTabBarClearance } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useSession } from "@/lib/auth/session";
import { useQuickAdd } from "@/lib/cart-mutations";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import {
	clearRecentSearches,
	readRecentSearches,
	rememberSearch,
} from "@/lib/recent-searches";
import { type RoleDegradation, takeDegradation } from "@/lib/role";
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
 * The home feed: where this order goes, what there is to buy, and what is in the basket.
 *
 * One call — `catalog.feed` — for the catalogue's five lists, because they are one screen
 * and three requests would be three chances to render half a feed. An older feed response
 * without discovery products uses `products.list` only until the API catches up. Two more
 * reads belong to *this customer* rather than to the marketplace and are drawn only for a session:
 * `orders.purchasedProducts` (the "Pide de nuevo" shelf) and `cart.get` (the bar at the
 * foot and the strip above it).
 *
 * The header and search stay fixed. When the catalogue has live commerce, offers and
 * purchasable products lead the feed; shops and category shortcuts follow. An empty
 * marketplace keeps categories first so the screen offers a path without inventing products.
 *
 * ## The coordinate is stated once, above everything
 *
 * `./home-header` states it and the feed does not spend the fold on a second picture of
 * the same fact. The map stays on screens where it helps someone choose or track a place.
 * The nearby heading follows the coordinate it sorts by, without repeating the address.
 *
 * The distances are a bonus, never a gate: without coords the API answers with the same
 * shape and `nearby` is the newest businesses rather than the closest — which is why the
 * section's heading follows the sort the API actually applied (`home.nearby` with a fix,
 * `home.newest` without) rather than naming a proximity the request never asked about.
 *
 * ## The loud thing is the field, and the banner is allowed to be second
 *
 * `docs/design-mobile.md` Rule 1: a screen with two loud things has none. The header defers
 * (a `heading` title over a `label` meta line — the register `./section-header` already
 * draws its own titles at, so nothing above the field out-shouts it), the banner is one
 * dark spotlight with one brand-colour mark rather than four competing numbers, and prices
 * stay `body` on every browse surface — money is the loudest thing in a *commit*, and the only commit on this screen is
 * the bar at its foot.
 *
 * ## What each "Ver todo" means
 *
 * Three of them, and they are three different destinations on purpose: the categories go to
 * the whole taxonomy (`app/categories`), the repeat shelf goes to the orders that produced
 * it (`/orders`), and the shops go to the paged list of every public business
 * (`app/nearby`). None of them carries `discovery.seeAll.hint` — "Abre la búsqueda" is true
 * of none of them, and a hint that lies is worse than no hint.
 *
 * ## The repeat shelf, and the one tap that is allowed to write
 *
 * "Pide de nuevo" is the customer's own finished orders' products, newest purchase first,
 * deduplicated and filtered to what can still be bought (`orders.purchasedProducts`). Its
 * "+" is `useQuickAdd`'s — one unit, and only where one unit is the whole answer; anything
 * with a required option group opens the product instead. That is the only write this
 * screen makes, and it is optimistic, rolled back loudly, and confirmed with `./toast`.
 * Its refusals land in `./rollback-notice`, drawn under the shelf that caused them rather
 * than floated over the page.
 *
 * ## The foot says what the basket needs
 *
 * `./coupon-strip` is the gap to the shop's minimum order; the promotion's separate
 * threshold belongs on its own banner. `./action-bar` is the basket itself: how much and how
 * many on the left, the one commit on the right. Both read the cart already in the cache from the tab
 * that owns it, so neither adds a request the app was not already making. The bar is absent
 * for an empty basket: a "Ver carrito" over nothing is a door to an empty room.
 *
 * ## Waiting is a shape, not a spinner
 *
 * The wait renders `FeedSkeleton`, which is this screen's own layout in grey: the header and
 * the field stay where they are and stay usable, and the blocks arrive under their own
 * headings. `useSkeletonHold` keeps a cache hit from flashing grey.
 *
 * The pull is `useRefreshControl`'s (`Rule 6`), and this screen is the case that file exists
 * for: the feed also refetches for reasons nobody asked for, because the coordinate lands a
 * beat after the screen does and every mount is a refetch.
 */
export default function HomeScreen() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const { colors, scheme } = useTheme();
	/**
	 * Whether this screen is the one that puts a *light* band under the status bar.
	 *
	 * `./home-gradient` draws lime at the top of the lime-dark theme, so the root layout's
	 * `<StatusBar style="light" />` — right for a `#0F0F0F` canvas — would put white clock and
	 * battery glyphs on `#C8FF18`, which measures **1.08:1**. Unreadable.
	 *
	 * **Scoped to this screen rather than taught to the root layout, on purpose.** The root's
	 * `onLightCanvas` is global, so teaching it about lime-dark would give *every* screen in
	 * that theme dark status-bar glyphs — and every screen except this one is `#0F0F0F` at the
	 * top. A `StatusBar` rendered here is mounted after the navigator's own and wins for this
	 * screen alone, so the other twenty-five theme/scheme combinations cannot regress.
	 *
	 * `null` otherwise, which leaves the root's answer untouched — the light theme included.
	 */
	const limeBand =
		scheme === "dark" && colors.primary.toLowerCase() === "#c8ff18";
	const { session } = useSession();
	const { coords, request } = useDeviceLocation();
	const toast = useToast();
	/**
	 * The one notice about having been downgraded to the customer stack, read once from the
	 * resolver (`lib/role.ts`) rather than from a URL — a URL that says "your membership ended"
	 * says it again on every reload. It is a *state*, so it is a sentence (Rule 2) and not an
	 * error block: `./rollback-notice` is for a write that was refused and `./toast` is for a
	 * write that succeeded, and this is neither.
	 */
	const [degradation, setDegradation] = useState<RoleDegradation | null>(null);
	useEffect(() => {
		setDegradation(takeDegradation());
	}, []);
	const { clearance, onHeightChange } = useActionBarClearance();
	/**
	 * The capsule's footprint, for the scroll's own `paddingBottom`.
	 *
	 * `Screen` never drew this scroll — the feed brings its own, for the `RefreshControl` and
	 * the sticky header — and `Screen`'s clearance is applied only to the `ScrollView` it
	 * renders itself. So the feed reserves for the nav bar here instead. `bottomInsetPaid` is
	 * `false` because this screen asks `Screen` for no bottom edge, so the home indicator is
	 * still unpaid and belongs in this number.
	 */
	const capsule = useTabBarClearance();

	const feed = useQuery(
		trpc.catalog.feed.queryOptions(
			{ lat: coords?.lat, lng: coords?.lng, limit: 20 },
			// The first fix arrives a beat after the screen does — it is a permission dialog
			// and a GPS read — and it changes the query key, so without this the list the
			// customer is already reading is torn out and replaced by grey the moment the
			// distance sort lands. Keeping the previous answer on screen until the sorted one
			// is here is the same move the storefront's docblock makes when it calls a
			// skeleton over real content "a step backwards the reader can see".
			{ placeholderData: keepPreviousData },
		),
	);
	const needsLegacyDiscover =
		feed.data?.discover === undefined &&
		feed.data !== undefined &&
		![...feed.data.featured, ...feed.data.offers].some(
			(product) => product.availability.inStock,
		);
	const legacyDiscover = useQuery(
		trpc.products.list.queryOptions(
			{ sort: "popular", inStockOnly: true, limit: 50 },
			{ enabled: needsLegacyDiscover },
		),
	);
	const fallbackDiscover = (legacyDiscover.data?.items ?? [])
		.filter((product) => product.availability.inStock)
		.slice(0, DISCOVER_PREVIEW);

	// Not `feed.isPending` alone: the first frame after a cache hit is a frame of skeleton,
	// and the hold is what keeps it from being a flicker.
	const waiting = useSkeletonHold(feed.isPending);

	/**
	 * Who the greeting is for. The profile answers first — `users.me`, which the account tab
	 * caches under the same key, so this is usually a cache hit — and the email prefix is the
	 * last resort, because a profile with no name is a real state and the header still has to
	 * say something. `enabled` and not merely fetched, so a signed-out visitor reads
	 * `home.greeting.anon` with no 401 behind it. `./home-header` owns what is done with it.
	 */
	const me = useQuery(
		trpc.users.me.queryOptions(undefined, { enabled: Boolean(session) }),
	);
	const name =
		me.data?.name.trim().split(/\s+/)[0] ||
		session?.email?.split("@")[0] ||
		null;

	// The repeat shelf and the basket: the two reads that are about *this* customer, and the
	// two that must not fire for a stranger. `cart.get` is cached by the cart screen under
	// the same key, so the bar is usually free.
	const again = useQuery(
		trpc.orders.purchasedProducts.queryOptions(
			{ limit: AGAIN_LIMIT },
			{ enabled: Boolean(session) },
		),
	);
	const cart = useQuery(
		trpc.cart.get.queryOptions(undefined, { enabled: Boolean(session) }),
	);

	const [quickAddError, setQuickAddError] = useState<unknown>(null);
	const { quickAdd } = useQuickAdd({
		// Rule 5: a write that succeeds silently teaches the customer to tap twice. The toast
		// is `product.added`, which names the thing — the count is already in the bar below.
		onAdded: (addedName) => toast.show(t("product.added", { name: addedName })),
		onNeedsOptions: (product) =>
			router.push({
				pathname: "/product/[id]",
				params: { id: product.id },
			}),
		onError: (error) => setQuickAddError(error),
	});

	/**
	 * What "Ver todo" does, and it is three destinations rather than one — see the file
	 * docblock. The labels are all `action.viewAll`; what differs is where they go, which is
	 * the half a label cannot carry and a hint would have to, which is why none of them
	 * borrows `discovery.seeAll.hint` ("Abre la búsqueda") — it would be a lie on all three.
	 */
	const seeAllAgain = {
		label: t("action.viewAll"),
		onPress: () => router.push("/orders"),
	};
	const seeAllNearby = {
		label: t("action.viewAll"),
		onPress: () => router.push("/nearby"),
	};
	const seeAllFeatured = {
		label: t("action.viewAll"),
		onPress: () => router.push("/featured"),
	};

	const pastItems = (again.data ?? []).slice(0, AGAIN_LIMIT);
	const items = cart.data?.items ?? [];
	const units = items.reduce((sum, item) => sum + item.quantity, 0);
	const currency: Currency = cart.data?.currency ?? "CRC";
	const shortfall =
		units > 0 ? (cart.data?.totals.missingForMinOrderMinor ?? 0) : 0;
	const cartBusinessName = cart.data?.businessName;
	const cartBusinessSlug = cart.data?.businessSlug;
	const needsMoreItems = shortfall > 0;
	const shortfallHint = needsMoreItems
		? t("cart.minOrderMissing", {
				amount: formatMoney(shortfall, currency, { locale: intlLocale }),
			})
		: undefined;

	/**
	 * Search, in place rather than on its own route.
	 *
	 * Tapping the field does not push `/search` — there is no swipe, no new screen, no lost
	 * scroll. The field activates where it sits and the feed below gives way to results with
	 * the same entrance the rows use, and the hardware back key (or the arrow in the field)
	 * stands the feed back up. The full `/search` screen stays for deep links and the feed's
	 * own exit; this is the same procedure behind a nearer door.
	 *
	 * The floor is two characters and the settle 300ms — the search screen's own numbers, so
	 * both doors ask at the same rhythm and share one cache entry per settled query.
	 */
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");
	const [recents, setRecents] = useState<string[]>([]);
	const scrollerRef = useRef<ScrollView>(null);
	const trimmed = query.trim();
	const settled = useDebouncedValue(trimmed, 300);
	const searchResults = useQuery(
		trpc.catalog.search.queryOptions(
			{ q: settled, lat: coords?.lat, lng: coords?.lng },
			{ enabled: searching && settled.length >= 2 },
		),
	);
	const searchingWait = useSkeletonHold(searching && searchResults.isPending);

	const openSearch = () => {
		scrollerRef.current?.scrollTo({ y: 0, animated: false });
		void readRecentSearches().then(setRecents);
		setSearching(true);
	};
	const closeSearch = () => {
		setSearching(false);
		setQuery("");
	};
	const submitSearch = () => {
		if (!trimmed) return;
		void rememberSearch(trimmed).then(setRecents);
	};

	// The back key stands the feed back up instead of leaving home: home is the root, so
	// without this the key would exit the app with a search open.
	useFocusEffect(
		useCallback(() => {
			if (!searching) return;
			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				// The two setters are React's own and stable, so the listener can be rebuilt
				// on `searching` alone; `closeSearch` is not in the deps because a callback
				// that changed every render would re-run this effect every render.
				() => {
					setSearching(false);
					setQuery("");
					return true;
				},
			);
			return () => subscription.remove();
		}, [searching]),
	);

	const refreshControl = useRefreshControl(() =>
		Promise.all([
			feed.refetch(),
			...(needsLegacyDiscover ? [legacyDiscover.refetch()] : []),
		]),
	);

	return (
		<Screen
			padded={false}
			contentStyle={styles.fill}
			background={<HomeGradient scheme={scheme} color={colors.primary} />}
		>
			{/* First child rather than a sibling of `<Screen>`, which would mean re-indenting
			    every line of the feed. `expo-status-bar` draws nothing, so its place in the
			    tree costs no layout, and being a descendant it mounts after the root layout's
			    own `<StatusBar>` — which is what lets it win for this screen alone. */}
			{limeBand ? <StatusBar style="dark" /> : null}
			{/* Outside the branch below on purpose. The header is the session's and the field
			    is static, so neither has any reason to disappear while the feed loads — and a
			    screen whose top third is stable reads as faster than one that rebuilds itself
			    from nothing. */}
			<HomeHeader
				hasLocation={coords !== null}
				onRequestLocation={request}
				name={name}
				avatarUrl={me.data?.image ?? null}
				onAvatarPress={() => router.push("/account")}
			/>

			{degradation ? (
				<View style={styles.degraded}>
					<Text variant="body" tone="muted">
						{t(
							degradation === "ended"
								? "account.profile.degraded.ended"
								: "account.profile.degraded.unreachable",
						)}
					</Text>
				</View>
			) : null}

			<View style={styles.hero}>
				{searching ? (
					// The field itself, where the hero link stood: same box, same tokens, now
					// editable. The arrow stands the feed back up; the X only clears the typing.
					<View
						style={[
							styles.searchField,
							{ backgroundColor: colors.card, borderColor: colors.input },
						]}
					>
						<Pressable
							onPress={closeSearch}
							// `hitSlopFor`'s answer for a control that is already the floor across,
							// which is what `./pressable`'s base style lays this out at — anything
							// more would reach into the field beside it and steal its presses.
							hitSlop={hitSlopFor(MIN_TOUCH_TARGET)}
							accessibilityRole="button"
							accessibilityLabel={t("action.back")}
							style={styles.iconButton}
						>
							<Ionicons
								name="arrow-back"
								size={icon.control}
								color={colors.mutedForeground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</Pressable>
						<TextInput
							value={query}
							onChangeText={setQuery}
							placeholder={t("home.search.placeholder")}
							placeholderTextColor={colors.mutedForeground}
							style={[styles.searchInput, { color: colors.foreground }]}
							accessibilityLabel={t("search.title")}
							returnKeyType="search"
							autoCorrect={false}
							autoCapitalize="none"
							clearButtonMode="while-editing"
							autoFocus
							onSubmitEditing={submitSearch}
						/>
						{query.length > 0 ? (
							<Pressable
								onPress={() => setQuery("")}
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
				) : (
					<HeroSearch onPress={openSearch} />
				)}
			</View>

			{/* One scroll view for all three branches, and one `RefreshControl` (`Rule 6`). */}
			<ScrollView
				ref={scrollerRef}
				style={styles.scroller}
				contentContainerStyle={{
					paddingBottom: clearanceOrSpace(clearance, units > 0, capsule),
				}}
				// The bar pays its own bottom inset (`./action-bar`'s docblock), so the scroll
				// reserves the *bar* and nothing more.
				scrollIndicatorInsets={{ bottom: 0 }}
				// This screen brings its own scroller, so `Screen`'s keyboard props never reach
				// it (`docs/design-mobile.md:124-133`) — and the search field above is
				// `autoFocus`, with the results and the recent chips drawn *in here*. Without the
				// first of these, RN's default `never` swallows the tap that would open a result
				// and only dismisses the keyboard; the reader taps twice for one row.
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
				// iOS only, and no value at all on Android — `components/screen.tsx` carries the
				// platform reasoning. `app/search.tsx` is the same screen one door away and opts
				// in the same three ways.
				automaticallyAdjustKeyboardInsets={
					Platform.OS === "ios" ? true : undefined
				}
				refreshControl={refreshControl}
			>
				{searching ? (
					<SearchResults
						results={searchResults.data}
						waiting={searchingWait}
						failed={searchResults.isError}
						error={searchResults.error}
						onRetry={() => void searchResults.refetch()}
						hasQuery={settled.length >= 2}
						recents={recents}
						onRecent={(term) => setQuery(term)}
						onClearRecents={() => void clearRecentSearches().then(setRecents)}
					/>
				) : (
					<>
						{feed.isError ? (
							// `padded` is off for this screen, because the rows are edge-to-edge;
							// the error is not a row, so it pays the horizontal padding itself.
							<View style={styles.stateWrap}>
								<ErrorState
									error={feed.error}
									onRetry={() => void feed.refetch()}
								/>
							</View>
						) : waiting || !feed.data ? (
							<FeedSkeleton />
						) : (
							<Feed
								data={feed.data}
								fallbackDiscover={fallbackDiscover}
								discoveryLoading={
									needsLegacyDiscover && legacyDiscover.isLoading
								}
								hasCoords={coords !== null}
								again={pastItems}
								onQuickAdd={(product: ProductCard) => {
									setQuickAddError(null);
									quickAdd(product);
								}}
								quickAddError={quickAddError}
								seeAllAgain={seeAllAgain}
								seeAllNearby={seeAllNearby}
								seeAllFeatured={seeAllFeatured}
							/>
						)}

						{/* The basket's own facts sit outside the catalogue's branch because
						    they are not catalogue data and they do not
						    wait for it. A strip above the bar is the place the design for this
						    screen gives it. Without a started cart and its shop, or after the
						    minimum is reached, this block is absent. */}
						{shortfall > 0 && cartBusinessName && cartBusinessSlug ? (
							<View style={styles.strip}>
								<CouponStrip
									amountMinor={shortfall}
									currency={currency}
									businessName={cartBusinessName}
									onPress={() =>
										router.push({
											pathname: "/store/[slug]",
											params: { slug: cartBusinessSlug },
										})
									}
								/>
							</View>
						) : null}
					</>
				)}
			</ScrollView>

			{units > 0 ? (
				<ActionBar
					summary={
						<CartSummary
							units={units}
							totalMinor={cart.data?.totals.totalMinor ?? 0}
							currency={currency}
							onPress={() => router.push("/cart")}
						/>
					}
					primary={{
						label: t(
							needsMoreItems ? "cart.bar.addItems" : "cart.bar.checkout",
						),
						onPress: () => {
							if (!needsMoreItems) return router.push("/checkout");
							if (!cartBusinessSlug) return router.push("/cart");
							router.push({
								pathname: "/store/[slug]",
								params: { slug: cartBusinessSlug },
							});
						},
						accessibilityHint: shortfallHint,
					}}
					onHeightChange={onHeightChange}
				/>
			) : null}
		</Screen>
	);
}

/**
 * How much of each vertical list the feed draws before it stops and hands over to "Ver todo".
 *
 * The API answers with up to twelve of each (`FEED_NEARBY_LIMIT`, `FEED_FEATURED_LIMIT`) and
 * the feed used to draw every one of them, which made the page six screens tall in the worst
 * case. Neither number removes anything: both sections' "Ver todo" points at the list that
 * holds the rest, so a section is a *way in* and the full list is one tap behind it.
 *
 * Three shops because three tall cards is one screen at the smallest text size and still one
 * screen at 200%; five products because a row is cheap and a shelf of five reads as a
 * recommendation instead of a catalogue. `AGAIN_LIMIT` is a rail rather than a list, so it
 * can carry more of them in the same vertical inch — eight, which is a cart's worth of
 * repeats without claiming to be the whole history behind "Ver todo".
 */
const NEARBY_PREVIEW = 3;
const FEATURED_PREVIEW = 5;
const DISCOVER_PREVIEW = 3;
const AGAIN_LIMIT = 8;

/** The banner peeks the next offer — `./rail`'s rule that a row must show it scrolls. */
const HERO_RATIO = 0.85;

/**
 * The basket's summary, and the second target inside `./action-bar`.
 *
 * The bar's contract is "a summary on the left and the one action the screen exists for on
 * the right"; this summary is itself a door, because on *this* screen the basket is
 * somewhere the customer goes rather than a figure they read — "Ver cart" and "Ir al pago"
 * are the two halves of the same decision and both are navigation. `./action-bar` takes a
 * node here precisely so the three screens that draw one can put their own thing in it.
 *
 * The count is a number over the glyph, while the text names the items total explicitly:
 * delivery has not been chosen yet, so this figure cannot promise the final charge.
 * The accessible label still speaks the full item count, including numbers above 99.
 */
function CartSummary({
	units,
	totalMinor,
	currency,
	onPress,
}: {
	units: number;
	totalMinor: number;
	currency: Currency;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const { t, tp, intlLocale } = useT();

	const money = formatMoney(totalMinor, currency, { locale: intlLocale });
	const itemsTotal = `${t("cart.itemsTotal")}: ${money}`;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			// The label is the action and it names where it goes ("Ver carrito"), so no hint
			// is owed — `app/settings.ts`'s rule is for labels that do *not* say.
			accessibilityLabel={`${t("cart.bar.viewCart")} · ${itemsTotal} · ${tp("order.itemCount", units)}`}
			style={styles.summary}
		>
			<View style={styles.summaryIcon}>
				<Ionicons
					name="cart-outline"
					size={icon.action}
					color={colors.primary}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<View style={[styles.count, { backgroundColor: colors.primary }]}>
					<Text variant="caption" tone="inverse" bold tabular>
						{units > 99 ? "99+" : String(units)}
					</Text>
				</View>
			</View>

			<View style={styles.summaryText}>
				<Text variant="label" bold>
					{t("cart.bar.viewCart")}
				</Text>
				<Text variant="caption" tone="muted" tabular>
					{itemsTotal}
				</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	hero: { marginTop: space.md },
	// `flex: 1` and not `flexGrow`/`flexShrink`, and the difference is `flexBasis`: RN's
	// `ScrollView` base style leaves the basis `auto`, so the scroller's hypothetical height
	// is its *content* and Android then clamps the scroll range to it — the last stretch of
	// the page could not be scrolled into view. `./paginated-list` records the same one word.
	scroller: { flex: 1 },
	stateWrap: { paddingHorizontal: space.lg },
	rail: { marginTop: space.xl },
	// `ScreenSection`'s own top margin, in the open: a section here is a header that owns its
	// inset and a block that owns its own, so the screen is what holds them together.
	section: { marginTop: space.xxl },
	sectionHead: { paddingHorizontal: space.lg },
	rows: {
		marginHorizontal: space.lg,
		borderRadius: radius.md,
		overflow: "hidden",
	},
	cards: { paddingHorizontal: space.lg, gap: space.md },
	empty: { paddingHorizontal: space.lg },
	// The recent searches, as chips the field can hand back to itself.
	recentWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.sm,
		paddingHorizontal: space.lg,
	},
	// A chip here is a `Pressable` with `accessibilityRole="button"`, so its edge is the one
	// the activated field beside it draws: `colors.input`, the 3:1 control boundary
	// `./hero-search` documents under WCAG 1.4.11. `border` is the decorative hairline at
	// ~1.3:1 — in the dark theme an edge nobody can find on a control the reader is meant to
	// tap. The colour is applied at the Pressable and not in this sheet, because a
	// `StyleSheet.create` object is module scope and sees no palette — the same reason
	// `searchField`'s View carries it.
	recentChip: {
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		borderRadius: radius.full,
		borderWidth: 1,
	},
	// The notice under the shelf that caused it: `./rollback-notice` is drawn in the layout
	// rather than floated, so the reader sees the refusal where the tap was.
	notice: { paddingHorizontal: space.lg, marginTop: space.md },
	// The downgrade sentence: a state, as a sentence (Rule 2) — not an error block and not a
	// toast, because neither is "a fact about why this screen is not the one you asked for".
	degraded: { paddingHorizontal: space.lg, paddingTop: space.sm },
	strip: { paddingHorizontal: space.lg, marginTop: space.xxl },
	// The searching field: `./hero-search`'s own box and tokens, in its place.
	searchField: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		marginHorizontal: space.lg,
		paddingHorizontal: space.lg,
		paddingVertical: space.md,
		borderRadius: radius.lg,
		borderWidth: 1,
	},
	// `type.heading` and not the bare 17/24 it replaced: the heading step is what the
	// stand-in link drew its placeholder in (`./hero-search`'s `variant="heading"`), so the
	// activated field is the same box at the same size — and Rule 1 names the scale step
	// rather than re-typing it. The reset stays: this is a bare `TextInput`, not `./text`,
	// so `docs/design-mobile.md`'s `includeFontPadding` contract reaches it from here.
	searchInput: {
		flex: 1,
		fontSize: type.heading.fontSize,
		lineHeight: type.heading.lineHeight,
		paddingVertical: 0,
		includeFontPadding: false,
	},
	summary: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	summaryIcon: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	// The count, pinned over the glyph's corner — `position: relative` on the wrapper is what
	// makes the pin possible (`./business-card`'s heart is the same two).
	//
	// No `height`, and there was one at 18. `./status-badge` is the app's badge primitive and
	// its docblock says what a fixed one costs: "a badge at 200% text is a taller badge", and
	// its own height is a derived `lineHeight * fontScale + inset * 2` for exactly that
	// reason. A literal 18 holding a `caption` line (16 at 100%, 32 at 200%) does not clip the
	// digits — nothing clips — but it lets them out of the disc they are pinned to. Padding
	// around the line is the same shape the primitive uses, and it grows with the reader.
	count: {
		position: "absolute",
		top: 2,
		right: 2,
		// Both numbers are the badge primitive's compact shape, read rather than retyped: the
		// vertical inset is `space.xs / 2` — `./status-badge`'s `DOT_INSET_Y`, measured against
		// the label inside the badge and deliberately no `space` step, as that file's own
		// docblock argues — and the width floor is `type.label.lineHeight`, the line box the
		// primitive builds a dot's height from. Derived here rather than imported because
		// `./status-badge` exports the height sum and not the inset; the expression is its own.
		minWidth: type.label.lineHeight,
		paddingHorizontal: space.xs,
		paddingVertical: space.xs / 2,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	// The action word over the money·count line: one text stack, so the gap between its two
	// lines is `TEXT_STACK_GAP` — the gap inside a stack — and not a `space` step, which is
	// the rhythm between blocks.
	summaryText: { flex: 1, minWidth: 0, gap: TEXT_STACK_GAP },
	// `./pressable`'s base floors the box at `MIN_TOUCH_TARGET` and sets no alignment, so its
	// child draws at the *top* of that box. On a full-width row that is invisible; in the
	// search field it is 13 points of a 44-point box, which puts the glyph above the line the
	// input beside it is set on. `./back-button` and `./home-header` both centre for this
	// reason, and the one screen that skipped it is why their comments exist.
	iconButton: { alignItems: "center", justifyContent: "center" },
});

/** `catalog.feed`'s five lists and its taxonomy, as `Feed` draws them. */
type FeedData = {
	featured: ProductCard[];
	discover?: ProductCard[];
	offers: ProductCard[];
	nearby: BusinessCardData[];
	promotions: PromotionCard[];
	categories: Category[];
};

type SeeAll = { label: string; onPress: () => void };

/**
 * The catalogue, in the order the design for this screen sets out.
 *
 * A component rather than four hundred lines of JSX in the screen's own body because every
 * block here is a *section* with the same three parts — a heading, a "Ver todo", a preview —
 * and the screen above it is busy with the header, the field, the search branch and the
 * basket. The style sheet it reads is still the screen's: these are one layout, not two.
 *
 * Every rail and list draws **nothing** when its own list is empty, so a marketplace with no
 * codes is a feed without the section rather than a heading with a shrug under it. The one
 * exception is "near you" when the marketplace has no commerce to show; its empty sentence
 * does not crowd a product-led feed when the customer can still shop for pickup.
 */
function Feed({
	data,
	fallbackDiscover,
	discoveryLoading,
	hasCoords,
	again,
	onQuickAdd,
	quickAddError,
	seeAllAgain,
	seeAllNearby,
	seeAllFeatured,
}: {
	data: FeedData;
	fallbackDiscover: ProductCard[];
	discoveryLoading: boolean;
	/** Whether the sort behind "near you" was a distance at all — see the file docblock. */
	hasCoords: boolean;
	/** The repeat shelf's products, already filtered to what can still be bought. */
	again: ProductCard[];
	onQuickAdd: (product: ProductCard) => void;
	/** The failed quick-add, drawn under the shelf that caused it. */
	quickAddError: unknown;
	seeAllAgain: SeeAll;
	seeAllNearby: SeeAll;
	seeAllFeatured: SeeAll;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const productRowSurface = {
		backgroundColor: colors.card,
		borderColor: colors.border,
		borderWidth: StyleSheet.hairlineWidth,
	};
	const hasAvailableFeature = [...data.featured, ...data.offers].some(
		(product) => product.availability.inStock,
	);
	const discover = data.discover ?? fallbackDiscover;
	const showDiscover = !hasAvailableFeature && discover.length > 0;
	const hasCommerce =
		data.nearby.length > 0 ||
		data.featured.length > 0 ||
		discoveryLoading ||
		discover.length > 0 ||
		data.offers.length > 0 ||
		data.promotions.length > 0 ||
		again.length > 0;
	const categories =
		data.categories.length > 0 ? (
			<View style={styles.rail}>
				<CategoryShowcase categories={data.categories} allHref="/categories" />
			</View>
		) : null;

	return (
		<>
			{!hasCommerce ? categories : null}

			{/* The offer banner, with the code as its brand-colour mark. It replaces the
			    "Cupones" rail this feed used to end with rather than joining it: one
			    promotion list drawn twice is the same fact on the screen twice, which is the
			    duplication `./home-header` exists to prevent. */}
			{data.promotions.length > 0 ? (
				<View style={styles.section}>
					<Rail ratio={HERO_RATIO}>
						{(width) =>
							data.promotions.map((promotion, index) => (
								<PromoHero
									key={promotion.id}
									promotion={promotion}
									index={index}
									style={{ width }}
								/>
							))
						}
					</Rail>
				</View>
			) : null}

			{/* The repeat shelf. Signed-out visitors never see it — the query behind it is
			    `enabled` only for a session — so there is no empty state to draw and no way
			    for a stranger to be told what they are missing. */}
			{again.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader title={t("home.orderAgain")} action={seeAllAgain} />
					</View>
					<ProductRail products={again} onQuickAdd={onQuickAdd} />
					{quickAddError ? (
						<View style={styles.notice}>
							{/* The refusal, in the API's own sentence, under the shelf that
							    caused it — `./rollback-notice` is drawn in the layout rather
							    than floated, and the optimistic line has already been rolled
							    back with its `warning` haptic. */}
							<RollbackNotice error={quickAddError} />
						</View>
					) : null}
				</View>
			) : null}

			{showDiscover || discoveryLoading ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader title={t("home.discover")} />
					</View>
					{discoveryLoading ? (
						<ProductRowsSkeleton />
					) : (
						<View style={[styles.rows, productRowSurface]}>
							{discover.map((product, index) => (
								<AnimateIn key={product.id} index={index}>
									<ProductRow
										product={product}
										showSeller
										showDisclosure
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
					)}
				</View>
			) : null}

			{data.featured.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader title={t("home.featured")} action={seeAllFeatured} />
					</View>
					<View style={[styles.rows, productRowSurface]}>
						{data.featured.slice(0, FEATURED_PREVIEW).map((product, index) => (
							<AnimateIn key={product.id} index={index}>
								<ProductRow
									product={product}
									showSeller
									showDisclosure
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
				</View>
			) : null}

			{data.offers.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader title={t("home.offers")} />
					</View>
					<ProductRail products={data.offers} />
				</View>
			) : null}

			{data.nearby.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader
							title={hasCoords ? t("home.nearby") : t("home.newest")}
							action={seeAllNearby}
						/>
					</View>
					<View style={styles.cards}>
						{data.nearby.slice(0, NEARBY_PREVIEW).map((business, index) => (
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
				</View>
			) : null}

			{hasCommerce ? categories : null}
			{data.nearby.length === 0 && !hasCommerce ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader
							title={hasCoords ? t("home.nearby") : t("home.newest")}
						/>
					</View>
					<View style={styles.empty}>
						<Text variant="body" tone="muted">
							{hasCoords ? t("home.nearby.empty") : t("home.nearby.empty.all")}
						</Text>
					</View>
				</View>
			) : null}
		</>
	);
}

/**
 * Search results, drawn where the feed stood.
 *
 * Four states and no skeleton of its own beyond the shared one: nothing typed yet (recents,
 * when the phone holds any), a wait, a refusal, and the answer — shops, then products, each
 * with its count, each row bound for the page it names. An empty answer is a sentence, not a
 * wall: the field above is still mounted and usable, so the way out of "nothing matched" is
 * another word, not a button.
 *
 * The refusal is drawn here rather than left to the screen because this is the only door that
 * can be wrong without the feed beside it being wrong too, and because the *absence* of an
 * error state is invisible: a failed read leaves `data` undefined, and without this branch
 * that undefined draws the skeleton — forever, on a screen that otherwise looks alive.
 *
 * Recent terms are remembered on submit (`lib/recent-searches.ts`), newest first and capped
 * at eight, and the list is device-local: a term typed on this phone is not a fact the
 * marketplace needs to keep.
 */
function SearchResults({
	results,
	waiting,
	failed,
	error,
	onRetry,
	hasQuery,
	recents,
	onRecent,
	onClearRecents,
}: {
	results: ProductSearchResult | undefined;
	waiting: boolean;
	failed: boolean;
	error: unknown;
	onRetry: () => void;
	hasQuery: boolean;
	recents: string[];
	onRecent: (term: string) => void;
	onClearRecents: () => void;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	if (!hasQuery) {
		return (
			<AnimateIn index={0}>
				{recents.length > 0 ? (
					<View style={styles.section}>
						<View style={styles.sectionHead}>
							<SectionHeader
								title={t("search.recent")}
								action={{ label: t("search.clear"), onPress: onClearRecents }}
							/>
						</View>
						<View style={styles.recentWrap}>
							{recents.map((term) => (
								<Pressable
									key={term}
									onPress={() => onRecent(term)}
									accessibilityRole="button"
									accessibilityLabel={term}
									style={[styles.recentChip, { borderColor: colors.input }]}
								>
									<Text variant="label">{term}</Text>
								</Pressable>
							))}
						</View>
					</View>
				) : null}
			</AnimateIn>
		);
	}

	// Before the skeleton, not after: a failure must not sit behind the minimum hold that was
	// meant for a fast success. The same order, for the same procedure, as `app/search.tsx`.
	if (failed) {
		return (
			<View style={styles.stateWrap}>
				<ErrorState error={error} onRetry={onRetry} />
			</View>
		);
	}

	if (waiting || !results) return <SearchResultsSkeleton />;

	const products: ProductCard[] = results.products;
	const businesses: BusinessCardData[] = results.businesses;
	if (products.length === 0 && businesses.length === 0) {
		return (
			<View style={styles.stateWrap}>
				<EmptyState
					icon="search-outline"
					title={t("search.empty.title")}
					body={t("search.empty.body")}
				/>
			</View>
		);
	}

	return (
		<>
			{businesses.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader
							title={`${t("search.businesses")} · ${businesses.length}`}
						/>
					</View>
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
				</View>
			) : null}
			{products.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<SectionHeader
							title={`${t("search.products")} · ${products.length}`}
						/>
					</View>
					<View style={styles.rows}>
						{products.map((product, index) => (
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
				</View>
			) : null}
		</>
	);
}

/**
 * What the scroll reserves at its foot.
 *
 * Two bars can want this space, and they are not the same bar. `clearance` is the *cart* bar's
 * own measured height, present only when the cart has something in it. `capsule` is the nav
 * bar's footprint, present on every frame of this screen.
 *
 * **They add, and neither replaces the other.** The capsule is `position: "absolute"`, so it
 * overlays whatever is under it and this scroll — which `Screen` did not draw, and so did not
 * pad — has to reserve for it itself. When the cart bar is up, `ActionBar` lifts itself clear
 * of the capsule (`components/action-bar.tsx`), so the two are stacked rather than competing,
 * and the scroll needs room for the pair. When the cart is empty there is no cart bar at all,
 * and the capsule is the only thing down there — which is why this is a sum and not a choice:
 * taking `clearance` alone leaves the last shop card under the nav bar on exactly the frame a
 * new reader is most likely looking at, an empty cart being the default state.
 *
 * `space.huge` is the page's own tail and is paid either way.
 */
function clearanceOrSpace(clearance: number, hasBar: boolean, capsule: number) {
	return (hasBar ? clearance : 0) + capsule + space.huge;
}
