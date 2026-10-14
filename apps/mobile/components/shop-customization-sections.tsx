import type {
	BusinessCard,
	BusinessHoursEntry,
	StorefrontAppearance,
} from "@pymeshub/shared";
import { brandAccentCheck } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space, useTheme } from "@/theme";
import { ErrorState } from "./error-state";
import { HoursTable } from "./hours-table";
import { ProductRow } from "./product-row";
import { ProductRowsSkeleton } from "./skeletons";
import { Text } from "./text";

/** The same optional content in the editor preview and the customer's shop. */
export function ShopCustomizationSections({
	appearance,
	card,
	hours,
	isOpen,
	preview = false,
}: {
	appearance: StorefrontAppearance;
	card: BusinessCard;
	hours: readonly BusinessHoursEntry[];
	isOpen: boolean;
	preview?: boolean;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const offersVisible = !appearance.hidden.includes("offers");
	const featuredVisible = !appearance.hidden.includes("featured");
	const offers = useQuery(
		trpc.products.list.queryOptions(
			{ businessId: card.id, onSaleOnly: true, limit: 6 },
			{ enabled: offersVisible },
		),
	);
	const featured = useQuery(
		trpc.products.list.queryOptions(
			{ businessId: card.id, featuredOnly: true, limit: 6 },
			{ enabled: featuredVisible },
		),
	);
	const accent =
		appearance.accentColor && brandAccentCheck(appearance.accentColor).valid
			? appearance.accentColor
			: colors.action;
	return (
		<View style={{ gap: space.lg }}>
			{appearance.sections
				.filter((id) => !appearance.hidden.includes(id))
				.map((id) => {
					if (id === "information")
						return (
							<View
								key={id}
								style={{ paddingHorizontal: space.lg, gap: space.sm }}
							>
								{card.description ? (
									<Text variant="body" tone="muted">
										{card.description}
									</Text>
								) : null}
								<HoursTable hours={hours} isOpen={isOpen} />
							</View>
						);
					const query = id === "offers" ? offers : featured;
					const products = query.data?.items ?? [];
					if (!preview && query.isSuccess && products.length === 0) return null;
					return (
						<View
							key={id}
							style={{ paddingHorizontal: space.lg, gap: space.sm }}
						>
							<Text variant="title" bold style={{ color: accent }}>
								{id === "offers"
									? t("customize.offers")
									: t("customize.featured")}
							</Text>
							{query.isPending ? <ProductRowsSkeleton /> : null}
							{query.error ? (
								<ErrorState
									error={query.error}
									onRetry={() => void query.refetch()}
								/>
							) : null}
							{preview && query.isSuccess && products.length === 0 ? (
								<Text variant="body" tone="muted">
									{id === "offers"
										? t("home.offers.empty.title")
										: t("home.featured.empty.title")}
								</Text>
							) : null}
							{products.map((product) => (
								<ProductRow
									key={product.id}
									product={product}
									onPress={() => {
										if (!preview)
											router.push({
												pathname: "/(customer)/product/[id]",
												params: { id: product.id },
											});
									}}
								/>
							))}
						</View>
					);
				})}
		</View>
	);
}
