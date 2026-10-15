import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { BackButton } from "@/components/back-button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";

export default function Customize() {
	const { t } = useT();
	const scope = useMerchantScope();
	const trpc = useTRPC();
	const params = useLocalSearchParams<{ businessId?: string }>();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const businessId =
		params.businessId || scope.businessId || shops.data?.[0]?.businessId || "";
	const role = shops.data?.find((shop) => shop.businessId === businessId)?.role;
	return (
		<Screen
			title={t("customize.title")}
			leading={<BackButton to="/(business)/menu" />}
			scroll
			bottomInset
		>
			{shops.error ? (
				<ErrorState error={shops.error} onRetry={() => void shops.refetch()} />
			) : null}
			<Card>
				<ListRow
					title={t("customize.dashboard")}
					subtitle={t("customize.saved")}
					chevron
					onPress={() =>
						router.push({
							pathname: "/(business)/customize-dashboard",
							params: { businessId },
						})
					}
				/>
				{role === "OWNER" || role === "MANAGER" ? (
					<ListRow
						title={t("customize.shop")}
						subtitle={t("customize.draft")}
						chevron
						onPress={() =>
							router.push({
								pathname: "/(business)/customize-shop",
								params: { businessId },
							})
						}
					/>
				) : null}
			</Card>
		</Screen>
	);
}
