import type { MembershipRole, MerchantLocation } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

import { BackButton } from "./back-button";
import { ErrorState } from "./error-state";
import { MerchantLocationPicker } from "./merchant-location-picker";
import { Screen } from "./screen";
import { Text } from "./text";

export type ManagementScope = {
	businessId: string;
	locationId: string;
	businessName: string;
	locationName: string;
	locationStatus: MerchantLocation["status"] | null;
	role: MembershipRole;
	locations: MerchantLocation[];
};

export function MerchantManagementFrame({
	title,
	children,
}: {
	title: string;
	children: (scope: ManagementScope) => ReactNode;
}) {
	const trpc = useTRPC();
	const { t } = useT();
	const merchantScope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === merchantScope.businessId) ??
		shopList[0];
	const businessId = shop?.businessId ?? "";
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);
	const list = locations.data ?? [];
	const selected =
		list.find((location) => location.id === merchantScope.locationId) ??
		list[0];
	const failed = shops.error ?? locations.error;

	if (failed) {
		return (
			<Screen title={title} leading={<BackButton to="/more" />}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void locations.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (shops.isPending || (!!businessId && locations.isPending)) {
		return (
			<Screen title={title} leading={<BackButton to="/more" />}>
				<Text tone="muted">{t("biz.manage.loadingScope")}</Text>
			</Screen>
		);
	}

	if (!shop) {
		return (
			<Screen title={title} leading={<BackButton to="/more" />}>
				<Text tone="muted">{t("state.empty")}</Text>
			</Screen>
		);
	}

	const businessName = shop.businessName;
	const scope: ManagementScope = {
		businessId,
		locationId: selected?.id ?? "",
		businessName,
		locationName: selected?.name ?? t("biz.manage.noLocation"),
		locationStatus: selected?.status ?? null,
		role: shop.role,
		locations: list,
	};

	return (
		<Screen
			title={title}
			subtitle={`${businessName} · ${scope.locationName}`}
			leading={<BackButton to="/more" />}
			scroll
			bottomInset
		>
			<View style={styles.context}>
				<View style={styles.contextLine}>
					<Text variant="caption" tone="muted" bold>
						{t("biz.manage.activeLocation")}
					</Text>
					<Text variant="label" bold>
						{scope.locationName} ·{" "}
						{selected?.status
							? t(`biz.locations.status.${selected.status}`)
							: t("biz.manage.unavailable")}
					</Text>
				</View>
				{scope.locations.length ? (
					<MerchantLocationPicker
						locations={scope.locations}
						selectedId={scope.locationId}
						onPick={(locationId) =>
							merchantScope.selectLocation(businessId, locationId)
						}
					/>
				) : (
					<Text variant="label" tone="muted">
						{t("biz.manage.noLocations")}
					</Text>
				)}
			</View>
			{children(scope)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	context: {
		gap: space.sm,
		paddingVertical: space.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	contextLine: { gap: space.xs },
});
