import { roleCan } from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * The More tab: the reads that are neither a work tab nor a screen of their own.
 *
 * The active business follows the same scope as the board and home. A merchant can belong
 * to more than one business, so More names the active one and lets the operator switch
 * without making the first membership a hidden default. The reads below are capability
 * aware: staff never asks for a payout or team read it cannot make, and an owner does not
 * have to open a dead row for a read the API refuses.
 */
export default function MoreScreen() {
	const trpc = useTRPC();
	const { colors } = useTheme();
	const { t, tp } = useT();
	const { signOut } = useSession();
	const merchantScope = useMerchantScope();
	const [businessPickerOpen, setBusinessPickerOpen] = useState(false);
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === merchantScope.businessId) ??
		shopList[0];
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const canManageStaff = !!shop && roleCan(shop.role, "staff:manage");
	const canReadPayouts = !!shop && roleCan(shop.role, "payouts:read");

	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId }, { enabled }),
	);
	const staff = useQuery(
		trpc.business.staff.queryOptions(
			{ businessId },
			{ enabled: enabled && canManageStaff },
		),
	);
	const payouts = useQuery(
		trpc.payouts.list.queryOptions(
			{ businessId },
			{ enabled: enabled && canReadPayouts },
		),
	);
	const reviews = useQuery(
		trpc.reviews.listForBusiness.queryOptions(
			{ businessId, limit: 5 },
			{ enabled },
		),
	);

	const failed =
		shops.error ??
		settings.error ??
		(canManageStaff ? staff.error : null) ??
		(canReadPayouts ? payouts.error : null) ??
		reviews.error;
	const waiting = useSkeletonHold(
		shops.isPending ||
			(enabled &&
				(settings.isPending ||
					reviews.isPending ||
					(canManageStaff && staff.isPending) ||
					(canReadPayouts && payouts.isPending))),
	);

	if (failed) {
		return (
			<Screen title={t("biz.more.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						if (enabled) void settings.refetch();
						if (canManageStaff) void staff.refetch();
						if (canReadPayouts) void payouts.refetch();
						if (enabled) void reviews.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (waiting) {
		return (
			<Screen title={t("biz.more.title")} scroll bottomInset>
				<MoreSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}

	if (!shop || !settings.data) {
		return (
			<Screen title={t("biz.more.title")} scroll bottomInset>
				<EmptyState
					icon="storefront-outline"
					title={t("biz.onboarding.title")}
					body={t("biz.onboarding.notLive")}
					actionLabel={t("biz.onboarding.create")}
					onAction={() => router.push("/new-business")}
				/>
			</Screen>
		);
	}

	const businessName = settings.data.name || shop.businessName;
	const status = t(`biz.status.${settings.data.status}`);
	const verification = settings.data.isVerified
		? t("biz.more.verified")
		: t("biz.more.verificationPending");
	const role = t(`biz.staff.role.${shop.role}`);

	const confirmSignOut = () => {
		warning();
		setSigningOut(true);
		void signOut().finally(() => setSigningOut(false));
	};

	return (
		<>
			<Screen
				title={t("biz.more.title")}
				subtitle={businessName}
				scroll
				bottomInset
			>
				<ScreenSection title={t("biz.more.business")}>
					<Card>
						<ListRow
							title={businessName}
							subtitle={`${status} · ${verification}`}
							state={role}
							divider={shopList.length > 1}
							chevron
							onPress={() => router.push("/(business)/merchant-settings")}
						/>
						{shopList.length > 1 ? (
							<ListRow
								title={t("biz.more.switchBusiness")}
								subtitle={t("biz.more.switchBusinessSubtitle")}
								chevron
								onPress={() => setBusinessPickerOpen(true)}
							/>
						) : null}
						<ListRow
							title={t("biz.settings.title")}
							subtitle={t("biz.more.businessNameSubtitle")}
							chevron
							onPress={() => router.push("/(business)/merchant-settings")}
						/>
						<ListRow
							title={t("biz.more.storeProfile")}
							subtitle={t("biz.more.storeProfileSubtitle")}
							chevron
							onPress={() => router.push("/(business)/store-profile")}
						/>
						<ListRow
							title={t("biz.more.businessHours")}
							subtitle={t("biz.more.businessHoursSubtitle")}
							chevron
							onPress={() => router.push("/(business)/business-hours")}
						/>
						<ListRow
							title={t("biz.locations.title")}
							subtitle={t("biz.locations.subtitle")}
							chevron
							onPress={() => router.push("/(business)/locations")}
						/>
						<ListRow
							title={t("biz.more.catalog")}
							subtitle={t("biz.more.catalogSubtitle")}
							divider={false}
							chevron
							onPress={() => router.push("/products")}
						/>
					</Card>
				</ScreenSection>

				<ScreenSection title={t("biz.more.operations")}>
					<Card>
						{canReadPayouts ? (
							<ListRow
								title={t("biz.more.payments")}
								subtitle={t("biz.more.paymentsSubtitle")}
								chevron
								onPress={() => router.push("/(business)/payments")}
							/>
						) : null}
						<ListRow
							title={t("biz.more.promotions")}
							subtitle={t("biz.more.promotionsSubtitle")}
							chevron
							onPress={() => router.push("/(business)/promotions")}
						/>
						{canReadPayouts ? (
							<ListRow
								title={t("biz.more.settlements")}
								subtitle={t("biz.more.settlementsSubtitle")}
								chevron
								onPress={() => router.push("/(business)/settlements")}
							/>
						) : null}
						<ListRow
							title={t("biz.more.support")}
							subtitle={t("biz.more.supportSubtitle")}
							chevron
							onPress={() => router.push("/(business)/support")}
						/>
						<ListRow
							title={t("biz.more.activity")}
							subtitle={t("biz.more.activitySubtitle")}
							divider={false}
							chevron
							onPress={() => router.push("/(business)/activity")}
						/>
					</Card>
				</ScreenSection>

				{canReadPayouts || canManageStaff ? (
					<ScreenSection title={t("biz.more.moneyPeople")}>
						<Card>
							{canReadPayouts ? (
								<ListRow
									title={t("biz.more.payouts")}
									subtitle={tp(
										"biz.more.payoutsSubtitle",
										payouts.data?.length ?? 0,
									)}
									divider={canManageStaff}
									chevron
									onPress={() => router.push("/(business)/payouts")}
								/>
							) : null}
							{canManageStaff ? (
								<ListRow
									title={t("biz.more.team")}
									subtitle={tp(
										"biz.more.teamSubtitle",
										staff.data?.length ?? 0,
									)}
									divider={false}
									chevron
									onPress={() => router.push("/(business)/team")}
								/>
							) : null}
						</Card>
					</ScreenSection>
				) : null}

				<ScreenSection title={t("biz.more.feedback")}>
					<Card>
						<ListRow
							title={t("biz.more.viewReviews")}
							subtitle={t("biz.reviews.title")}
							chevron
							onPress={() => router.push("/reviews")}
						/>
						{reviews.data?.items.length ? (
							reviews.data.items.slice(0, 3).map((review, index) => (
								<View
									key={review.id}
									style={[
										styles.review,
										index > 0 && {
											borderTopWidth: StyleSheet.hairlineWidth,
											borderTopColor: colors.border,
										},
									]}
								>
									<Text bold>
										{t("biz.reviews.breakdown", {
											count: review.rating,
											stars: 5,
										})}
										{review.comment ? null : (
											<Text tone="muted">{` · ${t("biz.more.noWrittenReview")}`}</Text>
										)}
									</Text>
									{review.comment ? (
										<Text tone="muted" numberOfLines={2}>
											{review.comment}
										</Text>
									) : null}
								</View>
							))
						) : (
							<Text tone="muted">{t("biz.more.noReviews")}</Text>
						)}
					</Card>
				</ScreenSection>

				<ScreenSection title={t("biz.more.account")}>
					<Card>
						<ListRow
							title={t("biz.more.profile")}
							subtitle={t("biz.more.profileSubtitle")}
							divider
							chevron
							onPress={() => router.push("/profile")}
						/>
						<ListRow
							title={t("biz.courier.profile")}
							subtitle={t("biz.courier.profileSubtitle")}
							divider
							chevron
							onPress={() => router.push("/courier-profile")}
						/>
						<ListRow
							title={t("biz.more.signOut")}
							destructive
							divider={false}
							onPress={() => {
								if (!signingOut) setSignOutOpen(true);
							}}
						/>
					</Card>
				</ScreenSection>
			</Screen>

			<Sheet
				open={businessPickerOpen}
				onClose={() => setBusinessPickerOpen(false)}
				title={t("biz.more.switchBusiness")}
				closeLabel={t("biz.more.close")}
			>
				<Card>
					{shopList.map((entry, index) => {
						const selected = entry.businessId === shop.businessId;
						return (
							<ListRow
								key={entry.businessId}
								title={entry.businessName}
								subtitle={t(`biz.staff.role.${entry.role}`)}
								state={selected ? t("biz.locations.current") : undefined}
								divider={index < shopList.length - 1}
								onPress={() => {
									if (selected) return;
									selection();
									merchantScope.selectBusiness(entry.businessId);
									setBusinessPickerOpen(false);
								}}
							/>
						);
					})}
				</Card>
			</Sheet>
			<ConfirmSheet
				open={signOutOpen}
				onClose={() => setSignOutOpen(false)}
				title={t("biz.more.signOutConfirm")}
				body={t("biz.more.signOutBody")}
				confirmLabel={t("biz.more.signOut")}
				onConfirm={confirmSignOut}
			/>
		</>
	);
}

const SKELETON_SECTIONS = [
	{ key: "business", rows: 5 },
	{ key: "operations", rows: 5 },
	{ key: "moneyPeople", rows: 2 },
	{ key: "feedback", rows: 1 },
	{ key: "account", rows: 3 },
] as const;
const SKELETON_ROWS = ["first", "second", "third", "fourth", "fifth"] as const;

function MoreSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	const row = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 +
			line("body", fontScale).height +
			TEXT_STACK_GAP +
			line("label", fontScale).height,
	);

	return (
		<>
			{SKELETON_SECTIONS.map((section, sectionIndex) => (
				<View key={section.key} style={styles.section}>
					<Skeleton
						label={sectionIndex === 0 ? loadingLabel : undefined}
						style={[styles.skeletonSection, line("heading", fontScale)]}
					/>
					<Card>
						{SKELETON_ROWS.slice(0, section.rows).map((rowKey) => (
							<Skeleton
								key={`${section.key}-${rowKey}`}
								style={{ height: row }}
							/>
						))}
					</Card>
				</View>
			))}
		</>
	);
}

const styles = StyleSheet.create({
	section: { marginTop: space.xxl },
	skeletonSection: {
		width: "40%",
		marginBottom: space.md,
	},
	review: {
		gap: TEXT_STACK_GAP,
		paddingVertical: space.md,
	},
});
