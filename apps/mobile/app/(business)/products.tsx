import Ionicons from "@expo/vector-icons/Ionicons";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { BusinessProductRow } from "@/components/business-product-row";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { PaginatedList } from "@/components/paginated-list";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { SearchInput } from "@/components/search-input";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useApiFailure } from "@/lib/api-error";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useReducedMotion } from "@/lib/reduced-motion";
import { useTRPC } from "@/lib/trpc/context";
import { icon, MIN_TOUCH_TARGET, space, useTheme } from "@/theme";

/**
 * Merchant menu. Todos is the unfiltered product list; the other tabs are
 * categories created by this business. Marketplace taxonomy remains separate.
 */

/**
 * Twenty, which is `productListInput.limit`'s own default and `app/featured`'s page. A menu
 * is read by scrolling rather than by paging, and the tail is behind `./list-end`'s button.
 */
const PAGE_SIZE = 20;

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
	const { t, tp } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const reducedMotion = useReducedMotion();
	const merchantScope = useMerchantScope();

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
	const shop =
		owned.find((one) => one.businessId === merchantScope.businessId) ??
		owned.find((one) => one.businessId === pickedId) ??
		owned[0];

	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [shopOpen, setShopOpen] = useState(false);
	const [categoryOpen, setCategoryOpen] = useState(false);
	const [categoryMode, setCategoryMode] = useState<
		"list" | "create" | "rename" | "delete"
	>("list");
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
		null,
	);
	const [categoryName, setCategoryName] = useState("");
	const [reassignToId, setReassignToId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	/**
	 * Whether the header is drawing its field or its title. `interface.md` §49: the
	 * search expands from an icon rather than holding vertical space all day. See the
	 * header below for what each shape draws and why closing clears the box.
	 */
	const [searchOpen, setSearchOpen] = useState(false);

	const categories = useQuery(
		trpc.products.merchantCategories.queryOptions(
			{ businessId: shop?.businessId ?? "" },
			{ enabled: shop !== undefined },
		),
	);
	const pickerRows = categories.data ?? [];

	const refreshCategories = () => {
		void cache.invalidateQueries({
			queryKey: trpc.products.merchantCategories.pathKey(),
		});
		void cache.invalidateQueries({ queryKey: trpc.products.list.pathKey() });
		void cache.invalidateQueries({ queryKey: trpc.products.detail.pathKey() });
	};
	const createCategory = useMutation(
		trpc.products.createMerchantCategory.mutationOptions({
			onSuccess: () => {
				refreshCategories();
				setCategoryMode("list");
				setCategoryName("");
			},
		}),
	);
	const renameCategory = useMutation(
		trpc.products.renameMerchantCategory.mutationOptions({
			onSuccess: () => {
				refreshCategories();
				setCategoryMode("list");
			},
		}),
	);
	const deleteCategory = useMutation(
		trpc.products.deleteMerchantCategory.mutationOptions({
			onSuccess: () => {
				refreshCategories();
				setCategoryId(null);
				setCategoryMode("list");
			},
		}),
	);
	const categoryError = useApiFailure(
		createCategory.error ?? renameCategory.error ?? deleteCategory.error,
	);
	const editingCategory = pickerRows.find(
		(row) => row.id === editingCategoryId,
	);

	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			{
				businessId: shop?.businessId ?? "",
				merchantCategoryId: categoryId ?? undefined,
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

	// `categories` are in the hold with the other two because the filter row
	// is part of the header: a wait that cleared before either answered would land the row
	// after the list and push the first row down — the late arrival the hold exists to hold
	// back. The predicate is `isLoading` and not `isPending`: `products` are
	// `enabled: shop !== undefined`, and a disabled query reports `isPending` forever, which
	// would hold the skeleton up on the account-with-no-shop path this screen has an empty
	// state for. `isLoading` is the one that means "an enabled read is still on the network".
	const waiting = useSkeletonHold(
		shops.isLoading || products.isLoading || categories.isLoading,
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
				// The same answer `Screen` above was given. This is the one list in the app
				// that floats under the merchant capsule — `./tab-bar` has the reasoning, and
				// the number is 82 points of the last row being unreachable without it.
				bottomInset
				keyExtractor={(product) => product.id}
				renderItem={(product, index) => (
					<AnimateIn index={index}>
						<BusinessProductRow
							product={product}
							featured={index === 0}
							onPress={() => openForm(product.id)}
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
							{/* §49's two shapes of one header.
							    The collapsed one is the title and a 44pt door; the expanded one is the
							    field and nothing beside it. The contract asks the search to *expand from
							    an icon* rather than to hold vertical space all day, and the price of that
							    is a header with two shapes — which is why the toggle names the state it
moves to (`./switch`'s contract) instead of saying "search" in both.
 Collapsing clears the box. A query that is no longer on screen is a filter
							    the reader cannot see the reason for, and this screen already draws a
							    different empty state for a narrowed list — keeping the text while hiding
							    the field would narrow the rows behind the reader's back. Clearing is the
							    one rule that leaves no hidden state. */}
							<BackButton to="/account" />
							{searchOpen ? (
								<SearchInput
									value={search}
									onChangeText={setSearch}
									placeholder={t("biz.catalog.search")}
									accessibilityLabel={t("biz.catalog.search")}
									clearLabel={t("search.clear")}
									style={styles.catalogSearch}
									autoFocus
								/>
							) : (
								<View style={styles.catalogCopy}>
									<Text variant="label" bold>
										{t("biz.catalog.title")}
									</Text>
									<Text variant="caption" tone="muted">
										{tp("biz.catalog.count", items.length)}
									</Text>
								</View>
							)}
							<Pressable
								onPress={() => {
									selection();
									if (searchOpen) {
										setSearch("");
										setSearchOpen(false);
										return;
									}
									setSearchOpen(true);
								}}
								accessibilityRole="button"
								accessibilityLabel={
									searchOpen ? t("action.close") : t("biz.catalog.search")
								}
								style={styles.catalogSearchToggle}
							>
								<Ionicons
									name={searchOpen ? "close-outline" : "search-outline"}
									size={icon.action}
									color={colors.foreground}
								/>
							</Pressable>
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
								{categories.isError ? (
									<View style={styles.pad}>
										<ErrorState
											error={categories.error}
											onRetry={() => {
												void categories.refetch();
											}}
										/>
									</View>
								) : (
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
												label={row.name}
												selected={row.id === categoryId}
												onPress={() => {
													if (row.id !== categoryId) selection();
													setCategoryId(row.id);
												}}
											/>
										))}
										<CategoryTab
											label={t("biz.products.category.new")}
											selected={false}
											onPress={() => {
												setCategoryMode("create");
												setCategoryName("");
												setCategoryOpen(true);
											}}
										/>
									</ScrollView>
								)}
								{!categories.isError ? (
									<Pressable
										style={styles.manageCategories}
										onPress={() => {
											setCategoryMode("list");
											setCategoryOpen(true);
										}}
										accessibilityRole="button"
									>
										<Text variant="caption" tone="action">
											{t("biz.products.category.manage")}
										</Text>
									</Pressable>
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

			<Modal
				visible={categoryOpen}
				transparent
				presentationStyle="overFullScreen"
				statusBarTranslucent
				navigationBarTranslucent
				animationType={reducedMotion ? "none" : "fade"}
				onRequestClose={() => setCategoryOpen(false)}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={[
						styles.categoryDialogRoot,
						{
							paddingTop: insets.top + space.lg,
							paddingBottom: insets.bottom + space.lg,
						},
					]}
				>
					<Pressable
						style={[
							StyleSheet.absoluteFill,
							{ backgroundColor: colors.scrim, opacity: 0.32 },
						]}
						onPress={() => setCategoryOpen(false)}
						accessibilityRole="button"
						accessibilityLabel={t("action.close")}
					/>
					<View
						style={[
							styles.categoryDialog,
							{
								backgroundColor: colors.card,
								borderColor: colors.border,
								maxHeight: height - insets.top - insets.bottom - space.lg * 2,
							},
						]}
						accessibilityViewIsModal
						onAccessibilityEscape={() => setCategoryOpen(false)}
					>
						<View style={styles.categoryDialogHeader}>
							<Text variant="title" bold style={styles.categoryDialogTitle}>
								{t("biz.products.category.manage")}
							</Text>
							<Pressable
								onPress={() => setCategoryOpen(false)}
								accessibilityRole="button"
								accessibilityLabel={t("action.close")}
								style={styles.categoryDialogClose}
							>
								<Ionicons
									name="close"
									size={icon.action}
									color={colors.foreground}
								/>
							</Pressable>
						</View>
						<ScrollView
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={styles.categoryManager}
						>
							{categoryMode === "list" ? (
								<>
									<Button
										label={t("biz.products.category.new")}
										onPress={() => {
											setCategoryName("");
											setCategoryMode("create");
										}}
									/>
									{pickerRows.map((row) => (
										<View key={row.id} style={styles.categoryManageRow}>
											<View style={styles.categoryManageCopy}>
												<Text bold>{row.name}</Text>
												<Text variant="caption" tone="muted">
													{tp("biz.catalog.count", row.productCount)}
												</Text>
											</View>
											<Button
												size="sm"
												variant="ghost"
												label={t("biz.products.category.rename")}
												onPress={() => {
													setEditingCategoryId(row.id);
													setCategoryName(row.name);
													setCategoryMode("rename");
												}}
											/>
											<Button
												size="sm"
												variant="ghost"
												label={t("biz.products.category.delete")}
												onPress={() => {
													setEditingCategoryId(row.id);
													setReassignToId(null);
													setCategoryMode("delete");
												}}
											/>
										</View>
									))}
								</>
							) : null}
							{categoryMode === "create" || categoryMode === "rename" ? (
								<>
									<Field
										label={t("biz.products.category.name")}
										value={categoryName}
										onChangeText={setCategoryName}
										maxLength={60}
									/>
									<Button
										label={t("biz.products.category.save")}
										disabled={
											!categoryName.trim() ||
											createCategory.isPending ||
											renameCategory.isPending
										}
										loading={
											createCategory.isPending || renameCategory.isPending
										}
										onPress={() => {
											if (!shop || !categoryName.trim()) return;
											if (categoryMode === "create")
												createCategory.mutate({
													businessId: shop.businessId,
													name: categoryName.trim(),
												});
											else if (editingCategoryId)
												renameCategory.mutate({
													businessId: shop.businessId,
													id: editingCategoryId,
													name: categoryName.trim(),
												});
										}}
									/>
									<Button
										variant="ghost"
										label={t("action.back")}
										onPress={() => setCategoryMode("list")}
									/>
								</>
							) : null}
							{categoryMode === "delete" && editingCategory ? (
								<>
									<Text>
										{t("biz.products.category.deletePrompt", {
											name: editingCategory.name,
										})}
									</Text>
									{editingCategory.productCount > 0 ? (
										<>
											<Text variant="caption" tone="muted">
												{t("biz.products.category.reassign")}
											</Text>
											{pickerRows
												.filter((row) => row.id !== editingCategory.id)
												.map((row) => (
													<ListRow
														key={row.id}
														title={row.name}
														state={
															reassignToId === row.id
																? t("biz.new.selected")
																: undefined
														}
														onPress={() => setReassignToId(row.id)}
													/>
												))}
											{pickerRows.length === 1 ? (
												<Text tone="muted">
													{t("biz.products.category.createFirst")}
												</Text>
											) : null}
										</>
									) : null}
									<Button
										variant="destructive"
										label={t("biz.products.category.delete")}
										disabled={
											deleteCategory.isPending ||
											(editingCategory.productCount > 0 && !reassignToId)
										}
										loading={deleteCategory.isPending}
										onPress={() => {
											if (shop)
												deleteCategory.mutate({
													businessId: shop.businessId,
													id: editingCategory.id,
													reassignToId: reassignToId ?? undefined,
												});
										}}
									/>
									<Button
										variant="ghost"
										label={t("action.back")}
										onPress={() => setCategoryMode("list")}
									/>
								</>
							) : null}
							{categoryError.message ? (
								<Text tone="destructive">{categoryError.message}</Text>
							) : null}
						</ScrollView>
					</View>
				</KeyboardAvoidingView>
			</Modal>
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
									if (!selected) {
										selection();
										merchantScope.selectBusiness(one.businessId);
									}
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
	manageCategories: {
		alignSelf: "flex-start",
		minHeight: MIN_TOUCH_TARGET,
		justifyContent: "center",
		paddingHorizontal: space.lg,
	},
	categoryDialogRoot: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: space.lg,
	},
	categoryDialog: {
		width: "100%",
		maxWidth: 440,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 24,
		overflow: "hidden",
	},
	categoryDialogHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingLeft: space.lg,
		paddingRight: space.xs,
		paddingTop: space.sm,
	},
	categoryDialogTitle: { flex: 1 },
	categoryDialogClose: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	categoryManager: {
		gap: space.md,
		paddingHorizontal: space.lg,
		paddingBottom: space.lg,
	},
	categoryManageRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: space.xs,
	},
	categoryManageCopy: { flexGrow: 1, minWidth: 120 },
	catalogHeader: {
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	// Grows so the toggle sits at the bar's right edge in the collapsed shape, and
	// yields the line to `catalogSearch` in the expanded one.
	catalogCopy: { flex: 1, minWidth: 64, gap: 2 },
	/** The §49 door: a bare 44pt target, no box to fill — the bar already has one. */
	catalogSearchToggle: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	// The outer box only: `components/search-input` owns the skin and the 44pt floor.
	// This screen owns the flex that makes the field take the header's leftover width
	// beside the toggle.
	catalogSearch: { flex: 1 },
	categoryTabs: {
		gap: space.sm,
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
