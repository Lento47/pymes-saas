import { localizedName } from "@pymeshub/i18n";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
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

const PAGE_SIZE = 20;

export default function CategoryProducts() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const { t, locale } = useT();
	const trpc = useTRPC();

	const categories = useQuery(trpc.catalog.categories.queryOptions());
	const category = categories.data?.find((entry) => entry.slug === slug);
	const products = useInfiniteQuery(
		trpc.products.list.infiniteQueryOptions(
			{
				categoryId: category?.id,
				inStockOnly: true,
				sort: "popular",
				limit: PAGE_SIZE,
			},
			{
				enabled: !!category,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);

	const waitingForCategories = useSkeletonHold(categories.isPending);
	const waitingForProducts = useSkeletonHold(products.isPending);
	const items = useMemo(
		() => products.data?.pages.flatMap((page) => page.items) ?? [],
		[products.data],
	);
	const rows = useMemo(() => chunkPairs(items), [items]);
	const shown =
		waitingForProducts || (products.isError && !products.data) ? [] : rows;

	return (
		<Screen padded={false} bottomInset contentStyle={styles.fill}>
			<PaginatedList
				data={shown}
				keyExtractor={(pair) => pair[0].id}
				renderItem={(pair, row) => (
					<View style={styles.row}>
						{pair.map((product, column) => (
							<ProductTile
								key={product.id}
								product={product}
								index={row * 2 + column}
								style={styles.tile}
							/>
						))}
						{pair.length === 1 ? <View style={styles.tile} /> : null}
					</View>
				)}
				header={
					<View style={styles.header}>
						<View style={styles.pad}>
							<BackButton
								to={
									category
										? { pathname: "/category/[slug]", params: { slug } }
										: "/categories"
								}
							/>
						</View>
						{categories.isError && !categories.data ? (
							<View style={styles.pad}>
								<ErrorState
									error={categories.error}
									onRetry={() => void categories.refetch()}
								/>
							</View>
						) : waitingForCategories || !categories.data ? (
							<ProductGridSkeleton />
						) : !category ? (
							<View style={styles.pad}>
								<EmptyState
									icon="pricetags-outline"
									title={t("category.unknown.title")}
									body={t("category.unknown.body")}
								/>
							</View>
						) : (
							<>
								<View style={styles.pad}>
									<Text variant="title" bold>
										{localizedName(category, locale)}
									</Text>
									<Text variant="body" tone="muted">
										{t("category.products.title")}
									</Text>
								</View>
								{products.isError ? (
									<View style={styles.pad}>
										<ErrorState
											error={products.error}
											onRetry={() => void products.refetch()}
										/>
									</View>
								) : null}
								{waitingForProducts || (!products.data && !products.isError) ? (
									<ProductGridSkeleton />
								) : products.data && items.length === 0 ? (
									<View style={styles.pad}>
										<EmptyState
											icon="cube-outline"
											title={t("category.products.empty.title")}
											body={t("category.products.empty.body")}
										/>
									</View>
								) : null}
							</>
						)}
					</View>
				}
				hasNextPage={Boolean(category) && products.hasNextPage}
				loadingMore={products.isFetchingNextPage}
				onLoadMore={() => void products.fetchNextPage()}
				onRefresh={() =>
					Promise.all([
						categories.refetch(),
						...(category ? [products.refetch()] : []),
					])
				}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	pad: { paddingHorizontal: space.lg },
	header: { gap: space.lg },
	row: { flexDirection: "row", gap: space.md },
	tile: { flex: 1 },
});
