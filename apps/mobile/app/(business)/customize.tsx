import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";

export default function Customize() {
	const { t } = useT();
	const scope = useMerchantScope();
	const trpc = useTRPC();
	const params = useLocalSearchParams<{ businessId?: string }>();
	const businessId = params.businessId ?? scope.businessId ?? "";
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const role = shops.data?.find((shop) => shop.businessId === businessId)?.role;
	return (
		<Screen title={t("customize.title")} scroll bottomInset>
			<ScreenSection title={t("customize.title")}>
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
			</ScreenSection>
		</Screen>
	);
}
