import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import {
	MAX_LINE_QUANTITY,
	type MerchantHome,
	type ProductCard,
} from "@pymeshub/shared";
import {
	type InfiniteData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { BusinessProductRow } from "@/components/business-product-row";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { PaginatedList } from "@/components/paginated-list";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { categoryPickerRows } from "@/lib/category-scope";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

/**
 * The shop's menu: what the business sells, and the door to changing it.
 *
 * ## The read is the public one, and the reason is written down in the web app
 *
 * `products.list` with `businessId` is not a dashboard procedure. It is the *public*
 * catalogue read, and it is the one this screen stays on even though a
 * business-scoped read exists: the member-only `status` filter on this same
 * procedure, plus `products.detail` for one row. This menu shows the published
 * shelf by decision rather than by necessity — a draft created here would
 * vanish from the menu that created it (see the form), so the menu shows what
 * the customers see and the form creates what the menu can hold. What
 * `products.list` does have is an exemption - a caller who is a *member* of
 * the shop it was asked about skips the `publicBusiness()` filter - and the
 * two notes below are what that exemption buys.
 *
 * - **The exemption is what makes this screen work for a shop that has not
 *   opened yet.** A caller who is a *member* of the shop it was asked about
 *   skips the `publicBusiness()` filter, so a shop that is `DRAFT`, `CLOSED` or
 *   `SUSPENDED` still shows its own team the menu
 *   (`apps/api/src/services/products.ts`). The member `status` filter the same
 *   procedure carries is deliberately left alone here, for the reason above.
 * - **`archivedAt IS NULL` is unconditional.** So the world this screen can see
 *   is *published and not archived*, and nothing else. `biz.products.status.DRAFT`,
 *   `biz.products.status.ARCHIVED` and `biz.products.filter.hidden` are landed keys that this
 *   screen deliberately does not draw: a filter for rows the read cannot return is a control
 *   that answers "nothing here" every time it is used, and a status chip that can only ever
 *   read "Publicado" states a fact rather than offering a choice.
 *
 * The consequence lands on the *create* path, and `apps/web` already decided it rather
 * than re-deriving it (`apps/web/components/business/product-form.tsx:45`): the member
 * read could reopen a draft, but this menu would not show it, so the honest create path
 * is still the one that ends with a product the owner can still see.
 *
 * ## The row is `./business-product-row`, and it is not the customer row
 *
 * A menu row for the customer and a menu row for the owner used to be one object -
 * `ProductRow` with a different `onPress` - and that read as one menu wearing two
 * labels: the owner saw the photo, the rating and the discount, which are the
 * customer's facts, and nothing of their own. The owner row answers a different
 * question ("what state is it in") with the name, the price and the availability
 * word, and its tap opens the form instead of the storefront. Same `ListRow`
 * family, none of the merchandising - which is what makes the two menus two.
 *
 * ## Two pickers, and both are the sheet-of-`ListRow`s this app already owns
 *
 * Every shop on the account is a shop this screen can be pointed at, and the choice travels
 * in the route when a product is opened, so it is made here once rather than re-derived by
 * the form. A single shop skips the picker entirely — a control with one option is a label.
 *
 * The category filter is `products.list`'s own `categoryId` and not a filter applied to a
 * loaded page: the API narrows in SQL (`docs/api.md`), and a client that filtered its first
 * twenty rows would report an empty category to an owner whose twenty-first product is in it.
 * "Todos" is the absence of the parameter rather than a value, which is the same shape the
 * input has.
 *
 * The list inside that sheet is the shop's vertical and nothing else — `@/lib/category-scope`
 * owns the rule. A shop is filed on a leaf of the taxonomy (`assertLeafCategory` refuses a
 * sector), so its vertical is that leaf's parent: a bakery filters by "Food & Beverage"'s
 * children, a phone shop by "Electronics & Technology"'s. The help line under the filter row
 * names that vertical (`biz.products.category.help`), because a filter list that is suddenly
 * ten rows long reads as one with rows missing unless the reason is beside it.
 */

/**
 * Twenty, which is `productListInput.limit`'s own default and `app/featured`'s page. A menu
 * is read by scrolling rather than by paging, and the tail is behind `./list-end`'s button.
 */
const PAGE_SIZE = 20;

type ProductListPage = {
	items: ProductCard[];
	nextCursor: string | null;
};
type ProductListData = InfiniteData<ProductListPage>;

function withAvailability(product: ProductCard, quantity: number): ProductCard {
	return {
		...product,
		availability: {
			...product.availability,
			inStock: quantity > 0,
			quantity,
			maxOrderQuantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, quantity)),
		},
	};
}

export default function ProductsScreen() {
	return (
		<Screen padded={false} bottomInset contentStyle={styles.fill}>
			<SignedIn>
				<Menu />
			</SignedIn>
		</Screen>
	);
}

/**
 * The shops, the filter, and the menu — one component rather than three, because
 * `./paginated-list` takes its header as a node and the header is where both pickers live.
 *
 * The alternative is threading a `header` element built by a parent into a child that owns
 * the query, which puts the two halves of one screen in two places to save nothing.
 */
function Menu() {
	const { t, tp, locale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();

	const shops = useQuery(trpc.business.myBusinesses.queryOptions());

	// A `COURIER` membership is not a shop to choose between. It earns the delivery profile
	// and it holds no `products:read` — `ROLE_CAPABILITIES` in `packages/shared/src/schemas/
	// user.ts` gives a courier `orders:read` and `orders:advance` and nothing else — so a
	// courier on this list would be a shop whose menu the API answers 403 for.
	const owned = useMemo(
		() => (shops.data ?? []).filter((one) => one.role !== "COURIER"),
		[shops.data],
	);

	const [pickedId, setPickedId] = useState<string | null>(null);
	const shop = owned.find((one) => one.businessId === pickedId) ?? owned[0];

	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [shopOpen, setShopOpen] = useState(false);
	const [search, setSearch] = useState("");

	// The shop's own `categoryId` — a leaf — is what scopes the filter to this shop's
	// vertical and names it on the row's help line (`@/lib/category-scope`). The read is
	// `business.settings` rather than a field on `myBusinesses`, so the memberships list stays
	// the five facts a switcher needs and the one fact only this filter wants rides with the
	// one screen that wants it.
	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId: shop?.businessId ?? "" },
			{ enabled: shop !== undefined },
		),
	);

	const categories = useQuery(trpc.catalog.categories.queryOptions());
	const all = categories.data ?? [];

	/*
	 * The filter panel draws this shop's vertical and nothing else — see `@/lib/category-scope`,
	 * which owns both the scoping rule and the shape of the list it returns. A shop with a
	 * readable category gets its sector's children flat (about ten rows); the expansion below
	 * is only the fallback for a shop the read cannot name a vertical for, and it is derived
	 * from the filter rather than held in its own state so the panel opens on the branch the
	 * list is already narrowed to.
	 */
	const pickerRows = categoryPickerRows(all, {
		businessCategoryId: settings.data?.categoryId ?? null,
		chosenId: categoryId,
	});

	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			{
				businessId: shop?.businessId ?? "",
				categoryId: categoryId ?? undefined,
				search: search.trim() || undefined,
				// `sortDirection` is left alone: `products.list` defaults to `desc`, and the
				// reserved key is `direction` — see `productListInput`'s docblock.
				limit: PAGE_SIZE,
			},
			{
				// `shop` is `undefined` on an account with no shop, and a query asked with
				// `businessId: ""` would be a round trip whose only answer is an empty list.
				enabled: shop !== undefined,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);

	const setStock = useMutation(
		trpc.products.setStock.mutationOptions({
			onMutate: async ({ id, quantity }) => {
				const listKey = trpc.products.list.pathKey();
				const homeKey = trpc.business.home.pathKey();

				await Promise.all([
					cache.cancelQueries({ queryKey: listKey }),
					cache.cancelQueries({ queryKey: homeKey }),
				]);

				const previousLists = cache.getQueriesData<ProductListData>({
					queryKey: listKey,
				});
				const previousHome = cache.getQueriesData<MerchantHome>({
					queryKey: homeKey,
				});

				cache.setQueriesData<ProductListData>(
					{ queryKey: listKey },
					(current) =>
						current && {
							...current,
							pages: current.pages.map((page) => ({
								...page,
								items: page.items.map((product) =>
									product.id === id
										? withAvailability(product, quantity)
										: product,
								),
							})),
						},
				);
				cache.setQueriesData<MerchantHome>(
					{ queryKey: homeKey },
					(current) =>
						current && {
							...current,
							catalog: {
								...current.catalog,
								products: current.catalog.products.map((product) =>
									product.id === id
										? withAvailability(product, quantity)
										: product,
								),
							},
						},
				);

				return { previousLists, previousHome };
			},
			onError: (_error, _input, context) => {
				for (const [queryKey, data] of context?.previousLists ?? []) {
					cache.setQueryData(queryKey, data);
				}
				for (const [queryKey, data] of context?.previousHome ?? []) {
					cache.setQueryData(queryKey, data);
				}
			},
			onSettled: async () => {
				await Promise.all([
					cache.invalidateQueries({
						queryKey: trpc.products.pathKey(),
					}),
					cache.invalidateQueries({
						queryKey: trpc.business.home.pathKey(),
					}),
				]);
			},
		}),
	);

	// `categories` and `settings` are in the hold with the other two because the filter row
	// is part of the header: a wait that cleared before either answered would land the row
	// after the list and push the first row down — the late arrival the hold exists to hold
	// back. The predicate is `isLoading` and not `isPending`: `products` and `settings` are
	// `enabled: shop !== undefined`, and a disabled query reports `isPending` forever, which
	// would hold the skeleton up on the account-with-no-shop path this screen has an empty
	// state for. `isLoading` is the one that means "an enabled read is still on the network".
	const waiting = useSkeletonHold(
		shops.isLoading ||
			products.isLoading ||
			categories.isLoading ||
			settings.isLoading,
	);

	const items = useMemo(
		() => products.data?.pages.flatMap((page) => page.items) ?? [],
		[products.data],
	);

	// Nothing is drawn under the skeleton or under a failure — `app/featured`'s rule, and the
	// hold is why: a row appearing inside the window the skeleton is holding would be the two
	// of them disagreeing about what is on screen.
	const shown = waiting || products.isError || items.length === 0 ? [] : items;
	const filtered = categoryId !== null || search.trim().length > 0;

	const openForm = (id?: string) => {
		if (!shop) return;
		router.push({
			pathname: "/product-form",
			params: { businessId: shop.businessId, ...(id ? { id } : {}) },
		});
	};

	return (
		<>
			<PaginatedList
				data={shown}
				keyExtractor={(product) => product.id}
				renderItem={(product, index) => (
					<AnimateIn index={index}>
						<BusinessProductRow
							product={product}
							featured={index === 0}
							onPress={() => openForm(product.id)}
							onAvailabilityChange={(quantity) => {
								if (!shop) return;
								setStock.mutate({
									businessId: shop.businessId,
									id: product.id,
									quantity,
								});
							}}
							availabilityPending={
								setStock.isPending && setStock.variables?.id === product.id
							}
						/>
					</AnimateIn>
				)}
				header={
					<View style={styles.header}>
						<View
							style={[
								styles.catalogHeader,
								{ borderBottomColor: colors.border },
							]}
						>
							<BackButton to="/account" />
							<View style={styles.catalogCopy}>
								<Text variant="label" bold>
									{t("biz.catalog.title")}
								</Text>
								<Text variant="caption" tone="muted">
									{tp("biz.catalog.count", items.length)}
								</Text>
							</View>
							<View
								style={[
									styles.catalogSearch,
									{
										backgroundColor: colors.card,
										borderColor: colors.input,
									},
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
									value={search}
									onChangeText={setSearch}
									placeholder={t("biz.catalog.search")}
									placeholderTextColor={colors.mutedForeground}
									style={[styles.catalogInput, { color: colors.foreground }]}
									accessibilityLabel={t("biz.catalog.search")}
									returnKeyType="search"
									autoCorrect={false}
									autoCapitalize="none"
									clearButtonMode="while-editing"
								/>
							</View>
						</View>

						{/* The read itself failed, and the failure is its own sentence — not the
						    permission one below, which is about an account with no shop on it.
						    `products` never enables with no shop to ask about, so nothing else on
						    this screen can draw the failure or its retry. */}
						{shops.isError ? (
							<View style={styles.pad}>
								<ErrorState
									error={shops.error}
									onRetry={() => void shops.refetch()}
								/>
							</View>
						) : null}

						{/* No shop, and no error: the account is a customer's or a courier's, and
						    the sentence is the one `app/delivery` draws from the other side —
						    "you do not have permission", not "something went wrong". */}
						{!waiting && !shops.isError && !shop ? (
							<View style={styles.pad}>
								<EmptyState
									icon="storefront-outline"
									title={t("biz.permission.title")}
									body={t("biz.permission.body")}
								/>
							</View>
						) : null}

						{shop ? (
							<>
								{/* Only when there is a choice to make. One shop is the ordinary
								    case for a phone, and a picker over one option is a label. */}
								{owned.length > 1 ? (
									<View style={styles.pad}>
										<Card>
											<ListRow
												title={t("biz.nav.primary")}
												subtitle={shop.businessName}
												divider={false}
												chevron
												onPress={() => setShopOpen(true)}
											/>
										</Card>
									</View>
								) : null}

								{/* The taxonomy read failing is its own sentence, not an empty list:
								    the filter quietly vanishing would be a control an owner cannot
								    tell from one that was never there. */}
								{categories.isError || settings.isError ? (
									<View style={styles.pad}>
										<ErrorState
											error={categories.error ?? settings.error}
											onRetry={() => {
												void categories.refetch();
												void settings.refetch();
											}}
										/>
									</View>
								) : pickerRows.length > 0 ? (
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerStyle={styles.categoryTabs}
									>
										<CategoryTab
											label={t("biz.products.filter.all")}
											selected={categoryId === null}
											onPress={() => {
												if (categoryId !== null) selection();
												setCategoryId(null);
											}}
										/>
										{pickerRows.map((row) => (
											<CategoryTab
												key={row.id}
												label={localizedName(row, locale)}
												selected={row.id === categoryId}
												onPress={() => {
													if (row.id !== categoryId) selection();
													setCategoryId(row.id);
												}}
											/>
										))}
									</ScrollView>
								) : null}

								<View style={styles.pad}>
									<Button
										label={t("biz.products.add")}
										onPress={() => openForm()}
									/>
								</View>

								{products.isError ? (
									<View style={styles.pad}>
										<ErrorState
											error={products.error}
											onRetry={() => void products.refetch()}
										/>
									</View>
								) : waiting ? (
									<MenuRowsSkeleton />
								) : items.length === 0 ? (
									<View style={styles.pad}>
										{/* Two sentences, because a filter that matched nothing and a
										    menu with nothing on it are different facts, and only one
										    of them is fixed by adding a product. */}
										{!filtered ? (
											<EmptyState
												icon="fast-food-outline"
												title={t("biz.products.empty.title")}
												body={t("biz.products.empty.body")}
											/>
										) : (
											<EmptyState
												icon="search-outline"
												title={t("biz.products.filter.empty")}
												body={t("biz.products.filter.empty.body")}
											/>
										)}
									</View>
								) : null}
							</>
						) : null}
					</View>
				}
				hasNextPage={products.hasNextPage}
				loadingMore={products.isFetchingNextPage}
				onLoadMore={() => void products.fetchNextPage()}
				onRefresh={() => products.refetch()}
			/>

			{/* Mounted last and as a sibling of the scroller, which is what `./sheet` needs —
			    it has no portal. Both stay mounted so their exits play; closed they draw
			    nothing. */}
			<Sheet
				open={shopOpen}
				onClose={() => setShopOpen(false)}
				title={t("biz.nav.primary")}
				closeLabel={t("action.close")}
			>
				<Card>
					{owned.map((one, index) => {
						const selected = one.businessId === shop?.businessId;
						return (
							<ListRow
								key={one.businessId}
								title={one.businessName}
								divider={index < owned.length - 1}
								state={selected ? t("biz.new.selected") : undefined}
								onPress={() => {
									// A picker settling on a value: the haptic answers the tap that
									// changes the shop, not a re-tap of the one already on
									// (`./business`'s ShopChips rule).
									if (!selected) selection();
									setPickedId(one.businessId);
									// The category belongs to the shop it was chosen under, so
									// changing shops drops it rather than carrying an id that
									// may be nobody's product.
									setCategoryId(null);
									setSearch("");
									setShopOpen(false);
								}}
							/>
						);
					})}
				</Card>
			</Sheet>
		</>
	);
}

function CategoryTab({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[
				styles.categoryTab,
				selected && { borderBottomColor: colors.primary },
			]}
		>
			<Text tone={selected ? "default" : "muted"}>{label}</Text>
		</Pressable>
	);
}

/**
 * The wait, in the shape the menu's rows arrive in.
 *
 * Not `./skeletons`' `ProductRowsSkeleton`, whose row is the customer's — a 60pt thumbnail
 * and three lines of title, seller and price (`./product-row`'s rhythm) — because the rows
 * this screen draws are `./business-product-row`: one `./list-row` line of title and price,
 * no photograph and no seller line. A grey block that promises a photo the loaded row never
 * draws is the swap-jump the skeleton rule exists to prevent. The block lives here rather
 * than beside `RowBlock` because the owner's row is this screen's shape alone, and the
 * customer screens that draw `./product-row` keep the block that mirrors it.
 *
 * One announcement for the group, which is `./skeletons`' own rule: the wrapper is the
 * accessible element and says "Cargando" once, and the leaves stay decorative.
 */
function MenuRowsSkeleton() {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={t("a11y.loading")}
			style={styles.menuSkeleton}
		>
			{[0, 1, 2, 3].map((index) => (
				<View key={index} style={styles.menuRowSkeleton}>
					<Skeleton
						style={[styles.menuTitleSkeleton, line("body", fontScale)]}
					/>
					<Skeleton
						style={[styles.menuPriceSkeleton, line("body", fontScale)]}
					/>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	// The body's height, which `./paginated-list`'s `flex: 1` grows into.
	fill: { flex: 1 },
	pad: { paddingHorizontal: space.lg },
	catalogHeader: {
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	catalogCopy: { minWidth: 64, gap: 2 },
	catalogSearch: {
		flex: 1,
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.sm,
		borderRadius: radius.md,
		borderWidth: 1,
	},
	catalogInput: {
		flex: 1,
		minHeight: 44,
		fontSize: type.body.fontSize,
		includeFontPadding: false,
	},
	categoryTabs: {
		gap: 24,
		paddingHorizontal: space.lg,
	},
	categoryTab: {
		height: 44,
		minWidth: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
		borderBottomWidth: 2,
		borderBottomColor: "transparent",
	},
	// The back button, the title, the pickers and whichever of the error, skeleton or empty
	// block is standing in for the rows are one column, with the gap the scroll used to pay
	// between them. The gutter, the gap down to the first row and the foot are
	// `./paginated-list`'s.
	header: { gap: space.lg },
	// The menu's wait, in the shape the rows arrive in: `./paginated-list`'s `item` and
	// `separator` as one column — the gutter either side of a row and the `space.md` between
	// two of them — and each row the `./list-row` rhythm `./business-product-row` is drawn
	// in. The title's and the price's heights come from `line()` at the reader's scale, the
	// way the real row's text does.
	menuSkeleton: { gap: space.md },
	menuRowSkeleton: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.md,
		paddingHorizontal: space.lg,
	},
	menuTitleSkeleton: { width: "65%" },
	menuPriceSkeleton: { width: "20%" },
});
