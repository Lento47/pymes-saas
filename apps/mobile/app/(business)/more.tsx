import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * The More tab: the reads that are neither a work tab nor a screen of their own.
 *
 * Four sections of rows over four reads — the shop's settings, its payouts, its team and
 * its newest reviews — and every word on the screen is the dictionary's. The first shop is
 * the non-courier membership, the rule every owner screen reads; a courier entry has no
 * settings to configure, and `myBusinesses` carries it beside the owner's own shops.
 *
 * While the reads are on their way the screen holds its shape rather than spinning: a
 * skeleton in the loaded screen's own shape, announced once — a spinner is a wait being
 * performed, and `docs/design-mobile.md`'s rule is that a wait is drawn, not performed.
 * One skeleton stands for the whole screen, held until the shop's read and the four
 * sections' reads have all settled, so no count ever draws as a zero on its way to its
 * value. A read that fails is an `ErrorState` with its retry, not a zero drawn as an empty.
 *
 * The reviews are the one read this screen answers for beyond its rows: the rating is the
 * dictionary's own sentence and the comment is drawn as written, and a review without
 * written words is drawn as the dictionary's absence (`biz.more.noWrittenReview`) rather
 * than as an empty row — a rating the customer left is still a fact the owner can read.
 */
export default function MoreScreen() {
	const trpc = useTRPC();
	const { colors } = useTheme();
	const { t, tp } = useT();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop = (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId }, { enabled }),
	);
	const staff = useQuery(
		trpc.business.staff.queryOptions({ businessId }, { enabled }),
	);
	const payouts = useQuery(
		trpc.payouts.list.queryOptions({ businessId }, { enabled }),
	);
	const reviews = useQuery(
		trpc.reviews.listForBusiness.queryOptions(
			{ businessId, limit: 5 },
			{ enabled },
		),
	);
	// The gate covers the four sections as well as the membership: a count that draws as a
	// zero while its own read is still in flight is a fact the screen does not have yet.
	const failed =
		shops.error ??
		settings.error ??
		staff.error ??
		payouts.error ??
		reviews.error;
	const waiting = useSkeletonHold(
		shops.isPending ||
			(enabled &&
				(settings.isPending ||
					staff.isPending ||
					payouts.isPending ||
					reviews.isPending)),
	);

	if (failed) {
		return (
			<Screen title={t("biz.more.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void settings.refetch();
						void staff.refetch();
						void payouts.refetch();
						void reviews.refetch();
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

	return (
		<Screen
			title={t("biz.more.title")}
			subtitle={shop?.businessName}
			scroll
			bottomInset
		>
			{/* Each section is the `ScreenSection` shape the console's other screens use:
			    `space.xxl` above the section and `space.md` under its heading, so a card
			    ends with air before the next heading instead of butting against it. */}
			<ScreenSection title={t("biz.more.business")}>
				<Card>
					<ListRow
						title={t("biz.more.settingsDelivery")}
						subtitle={
							settings.data
								? t(`biz.status.${settings.data.status}`)
								: t("biz.more.settingsFallback")
						}
						chevron
						onPress={() => router.push("/business-delivery")}
					/>
					<ListRow
						title={t("biz.locations.title")}
						subtitle={t("biz.locations.subtitle")}
						chevron
						onPress={() => router.push("/(business)/locations")}
					/>
					{/* Last in the card, so it drops the trailing hairline the row's own
					    default draws — the rhythm every card of `./list-row`s here keeps. */}
					<ListRow
						title={t("biz.more.catalog")}
						subtitle={t("biz.more.catalogSubtitle")}
						chevron
						divider={false}
						onPress={() => router.push("/products")}
					/>
				</Card>
			</ScreenSection>

			<ScreenSection title={t("biz.more.moneyPeople")}>
				<Card>
					<ListRow
						title={t("biz.more.payouts")}
						subtitle={tp("biz.more.payoutsSubtitle", payouts.data?.length ?? 0)}
						chevron
						onPress={() => router.push("/(business)/payouts")}
					/>
					<ListRow
						title={t("biz.more.team")}
						subtitle={tp("biz.more.teamSubtitle", staff.data?.length ?? 0)}
						divider={false}
						chevron
						onPress={() => router.push("/(business)/team")}
					/>
				</Card>
			</ScreenSection>

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
						divider={false}
						chevron
						onPress={() => router.push("/profile")}
					/>
				</Card>
			</ScreenSection>
		</Screen>
	);
}

/** The wait's sections and their rows, named so a key never falls to array position. */
const SKELETON_SECTIONS = ["business", "moneyPeople"] as const;
const SKELETON_ROWS = ["first", "second"] as const;

/**
 * The wait, at the loaded screen's own rhythm: two sections, each a header line and a
 * card of two `./list-row`s, at the two spacings `ScreenSection` pays the loaded
 * screen — `space.xxl` above the section, `space.md` under the heading line — so grey
 * sits exactly where the content it stands for sits and the swap moves nothing.
 *
 * The section line is the heading line it stands in for, at the reader's `fontScale`,
 * and a row is the sum a two-line `./list-row` pays — `space.md` of vertical padding
 * twice, the title's `body` line and the subtitle's `label` one at the text stack's
 * gap, over the row's own touch floor (`components/list-row.tsx`'s `row`). Every text
 * height comes from `./skeletons`' `line()` at the reader's scale: a block frozen at
 * 100% metrics is exact at 100% and short of the real card at 200% by the growth of
 * its own lines, which is the one jump a skeleton exists to prevent. `Skeleton`'s
 * `label` on the first section line is the one announcement for the whole wait.
 */
function MoreSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	// One `./list-row` of title and subtitle, over its own touch floor.
	const row = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 +
			line("body", fontScale).height +
			TEXT_STACK_GAP +
			line("label", fontScale).height,
	);

	return (
		<>
			{SKELETON_SECTIONS.map((section, index) => (
				<View key={section} style={styles.section}>
					<Skeleton
						label={index === 0 ? loadingLabel : undefined}
						style={[styles.skeletonSection, line("heading", fontScale)]}
					/>
					<Card>
						{SKELETON_ROWS.map((one) => (
							<Skeleton key={one} style={{ height: row }} />
						))}
					</Card>
				</View>
			))}
		</>
	);
}

const styles = StyleSheet.create({
	// `ScreenSection`'s two spacings, restated because the heading here is grey while
	// the primitive's `title` is a real word: `space.xxl` above the section and
	// `space.md` between the heading line and the card
	// (`components/screen.tsx`'s `sectionStyles`) — the air the loaded sections pay.
	section: { marginTop: space.xxl },
	skeletonSection: {
		// Width only: the height is the heading line it stands in for, from `line()` —
		// a line height cannot live down here.
		width: "40%",
		marginBottom: space.md,
	},
	review: {
		// One stack: the rating's line and the written words beneath it are the two
		// lines of one review, so the gap inside it is `TEXT_STACK_GAP`.
		gap: TEXT_STACK_GAP,
		paddingVertical: space.md,
	},
});
