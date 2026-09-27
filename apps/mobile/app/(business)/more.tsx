import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Switch } from "@/components/switch";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import {
	initDevicePrefs,
	isBoardSoundEnabled,
	setBoardSoundEnabled,
} from "@/lib/device-prefs";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP, useTheme } from "@/theme";

/**
 * The More tab: the reads that are neither a work tab nor a screen of their own.
 *
 * Four sections of rows over four reads — the shop's settings, its payouts, its team and
 * its newest reviews — plus §57's board-sound switch, which is a device answer and not a
 * read at all. Every word on the screen is the dictionary's. The first shop is
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
	const { signOut } = useSession();
	const scope = useMerchantScope();
	const [signingOut, setSigningOut] = useState(false);
	const [signOutOpen, setSignOutOpen] = useState(false);
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const locations = useQuery(
		trpc.business.locations.queryOptions(
			{ businessId },
			{ enabled, refetchInterval: 5_000 },
		),
	);
	const selectedLocation =
		locations.data?.find((location) => location.id === scope.locationId) ??
		locations.data?.find((location) => location.isDefault) ??
		locations.data?.[0];
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
		locations.error ??
		settings.error ??
		staff.error ??
		payouts.error ??
		reviews.error;
	const waiting = useSkeletonHold(
		shops.isPending ||
			(enabled &&
				(locations.isPending ||
					settings.isPending ||
					staff.isPending ||
					payouts.isPending ||
					reviews.isPending)),
	);

	/**
	 * The board's chime, interface.md §57's one configurable sound.
	 *
	 * A device answer like the rest of `lib/device-prefs.ts`: whether this phone rings
	 * for a new order is a property of the phone, not a fact the marketplace keeps about
	 * the shop, so there is no fifth read above and no write behind a procedure. Seeded
	 * the way `app/settings.tsx` seeds its own haptics switch — the root layout fires
	 * `initDevicePrefs()` and does not await it, so a screen that draws the value asks
	 * again rather than assuming the in-memory copy is warm.
	 *
	 * On until the merchant says otherwise. A missed order costs money in real time, so
	 * the silence has to be asked for; the same flag carries that reasoning where it is
	 * stored.
	 */
	const [soundOn, setSoundOn] = useState(true);
	useEffect(() => {
		void initDevicePrefs().then(() => setSoundOn(isBoardSoundEnabled()));
	}, []);

	/**
	 * Signing out asks once, in `./confirm-sheet`, and the confirm carries the warning haptic.
	 * The session lives in the device keychain, so this changes the *device* rather than a
	 * screen — both buttons say what they do, and the button that opens the question is a quiet
	 * one: the destructive weight belongs on the answer, not on the row that asks.
	 * Same recipe as `app/account.tsx`, because the More tab is the business tree's own way out
	 * and a shop on Home/Orders/Menu/Analytics must not have to leave the tab to close the session.
	 */
	const confirmSignOut = () => {
		warning();
		setSigningOut(true);
		void signOut().finally(() => setSigningOut(false));
	};

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
				<MoreSkeleton loadingLabel={t("biz.more.loading")} />
			</Screen>
		);
	}

	if (!shop) {
		return (
			<Screen title={t("biz.more.title")}>
				<EmptyState
					icon="storefront-outline"
					title={t("biz.more.empty.title")}
					body={t("biz.more.empty.body")}
					actionLabel={t("biz.more.empty.action")}
					onAction={() => router.push("/new-business")}
				/>
			</Screen>
		);
	}

	return (
		<>
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
						{/* The shop's identity first, and the delivery numbers second: the
						    name and the two pictures are what a customer sees before they
						    see a fee. The identity row opens `./merchant-settings`, the one
						    place either is set; the delivery row carries the shop it is
						    editing, because `app/business-delivery.tsx` reads that
						    parameter and a push without one used to bounce straight back
						    here. */}
						<ListRow
							title={t("biz.settings.profile")}
							subtitle={t("biz.more.shopSubtitle")}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/merchant-settings",
									params: { businessId },
								})
							}
						/>
						{/* Hours beside the identity, and not beside delivery: the week is
					    something a merchant sets once and corrects, the way the shop's name
					    is — the three delivery numbers on the row below are the ones that
					    move with a busy night. `architecture.md` lists Business hours under
					    More for the same reason. */}
						<ListRow
							title={t("biz.settings.hours")}
							subtitle={t("biz.more.hoursSubtitle")}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/shop-hours",
									params: { businessId },
								})
							}
						/>
						<ListRow
							title={t("biz.more.settingsDelivery")}
							subtitle={
								settings.data
									? t(`biz.status.${settings.data.status}`)
									: t("biz.more.settingsFallback")
							}
							chevron
							onPress={() =>
								router.push({
									pathname: "/business-delivery",
									params: { businessId },
								})
							}
						/>
						<ListRow
							title={t("biz.locations.title")}
							subtitle={
								selectedLocation
									? `${t("biz.locations.current")} · ${selectedLocation.name}`
									: t("biz.locations.subtitle")
							}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/locations",
									params: { businessId },
								})
							}
						/>
						{/* The codes this shop opened, beside the places it sells from:
						    both are "where and how this business takes an order", and
						    `architecture.md` files promotions under More rather than under
						    the catalogue because a discount is a pricing decision, not an
						    item on the menu. */}
						<ListRow
							title={t("biz.promotions.title")}
							subtitle={t("biz.promotions.subtitle")}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/promotions",
									params: { businessId },
								})
							}
						/>
						<ListRow
							title={t("biz.more.auditHistory")}
							subtitle={t("biz.more.subtitle")}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/audit-history",
									params: { businessId },
								})
							}
						/>
						{/* Last in the card, so it drops the trailing hairline the row's own
					    default draws — the rhythm every card of `./list-row`s here keeps. */}
						<ListRow
							title={t("biz.more.catalog")}
							subtitle={t("biz.more.catalogSubtitle")}
							chevron
							divider={false}
							onPress={() =>
								router.push({
									pathname: "/(business)/products",
									params: { businessId },
								})
							}
						/>
					</Card>
				</ScreenSection>

				<ScreenSection title={t("biz.more.moneyPeople")}>
					<Card>
						<ListRow
							title={t("biz.more.payouts")}
							subtitle={tp(
								"biz.more.payoutsSubtitle",
								payouts.data?.length ?? 0,
							)}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/payouts",
									params: { businessId },
								})
							}
						/>
						<ListRow
							title={t("biz.more.team")}
							subtitle={tp("biz.more.teamSubtitle", staff.data?.length ?? 0)}
							divider={false}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/team",
									params: { businessId },
								})
							}
						/>
					</Card>
				</ScreenSection>

				<ScreenSection title={t("biz.more.feedback")}>
					<Card>
						<ListRow
							title={t("biz.more.viewReviews")}
							subtitle={t("biz.reviews.title")}
							chevron
							onPress={() =>
								router.push({
									pathname: "/(business)/reviews",
									params: { businessId },
								})
							}
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

				{/* §57's one configurable sound. Drawn as `./switch` beside the sentence
				    that names it — the pair `app/business-delivery.tsx` draws for its two
				    capability switches — and not as a `./list-row` with a trailing control:
				    a list row is a door, and this one goes nowhere. `./switch` carries the
				    same string as its accessibility name, so the words drawn here and the
				    sentence a reader hears are one fact. */}
				<ScreenSection title={t("biz.settings.notifications")}>
					<View style={styles.switchRow}>
						<Switch
							checked={soundOn}
							onChange={(next) => {
								setSoundOn(next);
								void setBoardSoundEnabled(next);
							}}
							label={t("biz.settings.notifications.sound")}
						/>
						<Text variant="label">{t("biz.settings.notifications.sound")}</Text>
					</View>
				</ScreenSection>

				<ScreenSection title={t("biz.more.account")}>
					<Card>
						<ListRow
							title={t("biz.more.profile")}
							subtitle={t("biz.more.profileSubtitle")}
							chevron
							onPress={() => router.push("/profile")}
						/>
						<ListRow
							title={t("biz.more.settings")}
							subtitle={t("biz.more.settingsSubtitle")}
							chevron
							onPress={() => router.push("/settings")}
						/>
						<ListRow
							title={t("biz.more.support")}
							subtitle={t("biz.more.supportSubtitle")}
							divider={false}
							chevron
							onPress={() => router.push("/help")}
						/>
					</Card>
				</ScreenSection>

				{/* Quiet control, destructive weight on the confirm answer — `./confirm-sheet`'s
				    rule. Sibling of the scroller, not inside it: `./sheet` has no portal, so
				    inside the `Screen` it would scroll away with the content. */}
				<Button
					label={t("biz.more.signOut")}
					variant="secondary"
					fullWidth
					style={styles.signOut}
					loading={signingOut}
					disabled={signingOut}
					onPress={() => setSignOutOpen(true)}
				/>
			</Screen>
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

/** The wait's parts, named so every key identifies content rather than array position. */
type MoreSkeletonRowKey =
	| "settings"
	| "hours"
	| "delivery"
	| "locations"
	| "promotions"
	| "audit"
	| "catalog"
	| "payouts"
	| "team"
	| "reviews"
	| "profile";
type MoreSkeletonReviewKey = "first" | "second" | "third";
type MoreSkeletonSwitchKey = "sound";

type MoreSkeletonShape = {
	business: { rows: readonly MoreSkeletonRowKey[] };
	moneyPeople: { rows: readonly MoreSkeletonRowKey[] };
	feedback: {
		rows: readonly MoreSkeletonRowKey[];
		reviews: readonly MoreSkeletonReviewKey[];
	};
	notifications: { switchTarget: MoreSkeletonSwitchKey };
	account: { rows: readonly MoreSkeletonRowKey[] };
};

/** The wait's parts, named so every key identifies content rather than array position. */
const MORE_SKELETON_SHAPE = {
	business: {
		rows: [
			"settings",
			"hours",
			"delivery",
			"locations",
			"promotions",
			"audit",
			"catalog",
		],
	},
	moneyPeople: { rows: ["payouts", "team"] },
	feedback: {
		rows: ["reviews"],
		reviews: ["first", "second", "third"],
	},
	notifications: { switchTarget: "sound" },
	account: { rows: ["profile"] },
} as const satisfies MoreSkeletonShape;

/**
 * The wait, at the loaded screen's own rhythm: five sections, at the two spacings
 * `ScreenSection` pays the loaded screen — `space.xxl` above each section and
 * `space.md` under its heading line — so grey sits exactly where the content it stands
 * for sits and the swap moves nothing. Business holds seven two-line rows, money and
 * team two, customer feedback one row plus three review stacks, notifications one
 * switch target, and account one row.
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
	const { colors } = useTheme();

	// One `./list-row` of title and subtitle, over its own touch floor.
	const rowHeight = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 +
			line("body", fontScale).height +
			TEXT_STACK_GAP +
			line("label", fontScale).height,
	);

	const renderRows = (rows: readonly MoreSkeletonRowKey[]) =>
		rows.map((rowKey) => (
			<Skeleton key={rowKey} style={{ height: rowHeight }} />
		));

	return (
		<>
			<View style={styles.section}>
				<Skeleton
					label={loadingLabel}
					style={[styles.skeletonSection, line("heading", fontScale)]}
				/>
				<Card>{renderRows(MORE_SKELETON_SHAPE.business.rows)}</Card>
			</View>

			<View style={styles.section}>
				<Skeleton
					style={[styles.skeletonSection, line("heading", fontScale)]}
				/>
				<Card>{renderRows(MORE_SKELETON_SHAPE.moneyPeople.rows)}</Card>
			</View>

			<View style={styles.section}>
				<Skeleton
					style={[styles.skeletonSection, line("heading", fontScale)]}
				/>
				<Card>
					{renderRows(MORE_SKELETON_SHAPE.feedback.rows)}
					{MORE_SKELETON_SHAPE.feedback.reviews.map((reviewKey, index) => (
						<View
							key={reviewKey}
							style={[
								styles.review,
								index > 0 && {
									borderTopWidth: StyleSheet.hairlineWidth,
									borderTopColor: colors.border,
								},
							]}
						>
							<Skeleton style={line("body", fontScale)} />
							<Skeleton style={line("body", fontScale)} />
						</View>
					))}
				</Card>
			</View>

			<View style={styles.section}>
				<Skeleton
					style={[styles.skeletonSection, line("heading", fontScale)]}
				/>
				<View style={styles.switchRow}>
					<Skeleton
						key={MORE_SKELETON_SHAPE.notifications.switchTarget}
						style={styles.switchTarget}
					/>
				</View>
			</View>

			<View style={styles.section}>
				<Skeleton
					style={[styles.skeletonSection, line("heading", fontScale)]}
				/>
				<Card>{renderRows(MORE_SKELETON_SHAPE.account.rows)}</Card>
			</View>
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
	// `components/switch` beside the sentence that names it. No height written: the
	// control's own 48-point target is the row's, which is the number
	// `app/business-delivery.tsx` restates as `SWITCH_TARGET` for the same reason — a row
	// at `MIN_TOUCH_TARGET` would be a row the control does not pay.
	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	switchTarget: { width: 48, height: 48 },
	// Same air as `app/account.tsx`'s sign-out: a long way from the last door above it.
	signOut: { marginTop: space.huge },
});
