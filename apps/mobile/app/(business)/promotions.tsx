import { formatMoney, type PromotionDetail } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { Switch } from "@/components/switch";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { light, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space, useTheme } from "@/theme";

/**
 * The codes this shop has opened, and whether each one is still taking.
 *
 * ## The pause lives here, not in the form
 *
 * `promotions.setActive` is its own procedure and this switch is the only control that
 * calls it — see `packages/trpc-api/src/services/promotions.ts` for why a form saving a
 * typo must never be able to close a code people are holding. So the list is not just a
 * table of contents: it is the screen where a code is turned off, and the row that opens
 * the editor carries the switch beside it rather than inside it.
 *
 * That split is `./list-row`'s own documented case. A row that opens something is a
 * `Pressable`, and a `Pressable` swallows the accessibility tree of everything inside it
 * — which is exactly the trap `./switch` and `components/toast` both name. So the line
 * is a container that owns its hairline (`divider={false}` on the row) with the switch
 * as the row's **sibling**, the way `./business-product-row` puts its availability
 * switch outside the tappable half.
 *
 * ## Pausing gets a toast and an Undo, not a confirmation
 *
 * interface.md §47 asks "Are you sure?" only for the writes that are hard to reverse —
 * pause-all-orders, delete product, reject an accepted order. Pausing one code is one
 * switch away from being on again, so §46's `Product unavailable / Undo` is the right
 * answer and the reversal names its target from the mutation's own variables rather than
 * from whatever row is on screen when the button is pressed.
 */
export default function MerchantPromotions() {
	const { t, tp, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const scope = useMerchantScope();
	const { colors } = useTheme();

	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";

	const promotions = useQuery(
		trpc.promotions.list.queryOptions(
			{ businessId },
			{ enabled: !!businessId },
		),
	);

	const refresh = async () => {
		await cache.invalidateQueries({
			queryKey: trpc.promotions.list.pathKey(),
		});
	};

	const setActive = useMutation(
		trpc.promotions.setActive.mutationOptions({
			onSuccess: async (_data, variables) => {
				light();
				// Only the pause carries Undo: pausing is the protective write, and
				// resuming *is* the reversal. Naming the target from `variables` rather
				// than from the row under the toast is `./locations`' rule, restated.
				if (variables.isActive) {
					toast.show(t("biz.promotions.resumedToast"));
				} else {
					toast.show(t("biz.promotions.pausedToast"), () => {
						setActive.mutate({
							businessId: variables.businessId,
							promotionId: variables.promotionId,
							isActive: true,
						});
					});
				}
				await refresh();
			},
			onError: () => warning(),
		}),
	);

	const failed = shops.error ?? promotions.error;
	const items = promotions.data ?? [];

	return (
		<Screen
			title={t("biz.promotions.title")}
			subtitle={t("biz.promotions.subtitle")}
			leading={<BackButton to="/more" />}
			scroll
			bottomInset
		>
			{failed ? (
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void promotions.refetch();
					}}
				/>
			) : shops.isPending || (shop && promotions.isPending) ? (
				<Text>{t("state.loading")}</Text>
			) : !shop ? (
				<Text>{t("biz.onboarding.notLive")}</Text>
			) : items.length === 0 ? (
				<>
					<View style={styles.add}>
						<Button
							label={t("biz.promotions.add")}
							onPress={() => router.push("/(business)/promotion-form")}
						/>
					</View>
					<EmptyState
						icon="ticket-outline"
						title={t("biz.promotions.empty.title")}
						body={t("biz.promotions.empty.body")}
						actionLabel={t("biz.promotions.add")}
						onAction={() => router.push("/(business)/promotion-form")}
					/>
				</>
			) : (
				<>
					<View style={styles.add}>
						<Button
							label={t("biz.promotions.add")}
							onPress={() => router.push("/(business)/promotion-form")}
						/>
					</View>
					<Card>
						{items.map((promotion, index, all) => (
							<View
								key={promotion.id}
								style={[
									styles.line,
									{ borderBottomColor: colors.border },
									index === all.length - 1 && styles.lineLast,
								]}
							>
								<ListRow
									title={promotion.code}
									subtitle={subtitleOf(promotion, t, tp, intlLocale)}
									state={
										promotion.isActive
											? t("biz.promotions.open")
											: t("biz.promotions.paused")
									}
									divider={false}
									chevron
									style={styles.lineRow}
									onPress={() =>
										router.push({
											pathname: "/(business)/promotion-form",
											params: { id: promotion.id },
										})
									}
								/>
								{/* The sentence for the state the switch moves *to*, which is
								    `./business-product-row`'s reading of `./switch`'s label
								    contract — the control carries no words of its own. */}
								<Switch
									checked={promotion.isActive}
									onChange={(next) =>
										setActive.mutate({
											businessId,
											promotionId: promotion.id,
											isActive: next,
										})
									}
									label={
										promotion.isActive
											? t("biz.promotions.pause")
											: t("biz.promotions.resume")
									}
									disabled={setActive.isPending}
								/>
							</View>
						))}
					</Card>
				</>
			)}
			{setActive.error ? (
				<View style={styles.error}>
					<ErrorState error={setActive.error} />
				</View>
			) : null}
		</Screen>
	);
}

/**
 * What the code takes off, and how much of it is gone.
 *
 * The offer is printed in the kind's own unit rather than normalised — `15%`, `₡1 500`,
 * `Envío gratis` — for the reason `packages/shared/src/schemas/promotions.ts` keeps
 * `value` in its kind's unit: a client that multiplied a percent by a subtotal it does
 * not have would be inventing an amount the shop never agreed to. `FREE_DELIVERY` names
 * itself and has no number, which is why that branch is a word rather than a formatted
 * value with a hole in it.
 */
function subtitleOf(
	promotion: PromotionDetail,
	t: ReturnType<typeof useT>["t"],
	tp: ReturnType<typeof useT>["tp"],
	intlLocale: string,
): string {
	const offer =
		promotion.kind === "PERCENT"
			? `${promotion.value}%`
			: promotion.kind === "FIXED"
				? formatMoney(promotion.value, promotion.currency, {
						locale: intlLocale,
					})
				: t("biz.promotions.kind.FREE_DELIVERY");

	const used =
		promotion.maxRedemptions == null
			? tp("biz.promotions.used", promotion.redemptions)
			: t("biz.promotions.usedOf", {
					count: promotion.redemptions,
					max: promotion.maxRedemptions,
				});

	return `${offer} · ${used}`;
}

const styles = StyleSheet.create({
	add: { marginBottom: space.lg },
	// The hairline belongs to the line rather than to the row: the row is only the
	// tappable half of it and the switch beside it would leave the rule short.
	line: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	lineLast: { borderBottomWidth: 0 },
	lineRow: { flex: 1 },
	error: { marginTop: space.lg },
});
