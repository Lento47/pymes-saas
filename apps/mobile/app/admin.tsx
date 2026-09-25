import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { hitSlopFor, Pressable } from "@/components/pressable";
import { Price } from "@/components/price";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { useApiFailure } from "@/lib/api-error";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, type, useTheme } from "@/theme";

/**
 * The operator's console.
 *
 * Two reads and they are deliberately sequential. `users.me` answers "is this person an
 * admin" and nothing else is asked until it says yes — the metrics procedure refuses a
 * non-admin anyway, and firing it optimistically would be a guaranteed 403 on every visit
 * by every customer who ever taps through, which is a log full of refusals that mean
 * nothing.
 *
 * ## Waiting
 *
 * Both waits draw the same grey console, because the two answers are the same shape — the
 * toolbar, three metric cards and the totals group — and `ConsoleSkeleton` now draws every
 * one of those blocks, at the token line heights and the `MIN_TOUCH_TARGET` box the real
 * controls occupy. It did not before: the toolbar and the totals group were missing, so the
 * numbers landed on a page that had grown a control and a section since the grey version was
 * drawn — the layout move a skeleton exists to prevent, one block at a time. The skeleton
 * hangs off `isPending` and never off `isFetching` — the metrics poll every fifteen seconds,
 * and a screen that dropped its content into grey every fifteen seconds would be unreadable.
 *
 * The wait inside `Gate` draws the console too, and that is a guess rather than a certainty:
 * the permission read answers either "here are the metrics" or "you are not an admin", and
 * this file draws the first one before it knows. The guess is deliberate — this route is
 * offered in exactly one place in the app, the account tab's admin button, which is itself
 * drawn only for an account `users.me` has already called an admin
 * (`app/account.tsx`), so a non-admin arrives by typing the path or following a link
 * rather than through anything the app put in front of them, and their answer replaces the
 * grey cards the way any answer does. The alternative is not offered by the design doc: a
 * spinner is reserved for a round trip whose *shape* is unknown
 * (`docs/design-mobile.md:83-88`), and a console's shape is known here.
 *
 * ## The refresh control
 *
 * The metrics refetch on a timer, and the timer is not a reason to make a person wait for
 * it. The icon is small and the target is not: the glyph is drawn at `type.title.fontSize`
 * and `hitSlopFor` is where that becomes a 44-point target — stated at the call site rather
 * than left to `./pressable`'s own floor, which is a floor on the box and says nothing about
 * *this* control's ink. The eleven points it adds on each side reach into the gap under the
 * toolbar and not into the first card. It is icon-only, so it carries a Spanish
 * `accessibilityLabel` — an unlabelled button is announced as "button" and nothing else,
 * which on this screen is indistinguishable from the card it sits beside.
 *
 * And it answers the tap it was given: the glyph becomes a spinner, the control dims and its
 * accessibility state goes `busy` for as long as the read the tap started is out, and it is
 * `disabled` so a second tap cannot start a second one. The flag behind all of that is the
 * screen's own and not `query.isFetching` — the numbers on this screen come back identical
 * most of the time, so a control lit by the poll would say nothing about the tap. See the
 * note at the flag itself.
 *
 * ## The three cards are one component, because they are one set
 *
 * They used to be three hand-written `Card`s, and the third had quietly lost its meta line:
 * a set of numbers read down a column is only readable while the three share a rhythm, and
 * the one place that rhythm can be kept is a single component. `MetricCard` is that, and it
 * carries the two rules the set has — the stack gap the skeleton also draws, and `tabular`
 * on the figure *and* on the count under it, so a three-digit total and a two-digit one line
 * up where the eye is already scanning.
 */
export default function Admin() {
	const { t } = useT();

	return (
		<Screen
			title={t("admin.nav.overview")}
			scroll
			bottomInset
			contentStyle={styles.content}
		>
			<SignedIn>
				<Gate />
			</SignedIn>
		</Screen>
	);
}

/** The permission check. Nothing about the console is asked for until it passes. */
function Gate() {
	const trpc = useTRPC();
	const { t } = useT();
	const me = useQuery(trpc.users.me.queryOptions());
	const waiting = useSkeletonHold(me.isPending);

	if (waiting) return <ConsoleSkeleton loadingLabel={t("state.loading")} />;
	if (me.isError) {
		return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
	}
	if (!me.data) {
		// Unreachable: the skeleton covers the pending read and the branch above covers the
		// failed one. Rendering nothing beats reading `isAdmin` off `undefined`.
		return null;
	}
	if (!me.data.isAdmin) {
		return (
			<EmptyState
				icon="lock-closed-outline"
				title={t("admin.forbidden.title")}
				body={t("admin.forbidden.body")}
			/>
		);
	}

	return <Overview />;
}

function Overview() {
	const trpc = useTRPC();
	const { t, tp } = useT();
	const { colors } = useTheme();
	const query = useQuery(
		trpc.admin.metrics.queryOptions(undefined, { refetchInterval: 15000 }),
	);
	const cache = useQueryClient();
	const courierReview = useQuery(
		trpc.admin.courierProfiles.queryOptions({ status: "PENDING", limit: 10 }),
	);
	const reviewCourier = useMutation(
		trpc.admin.reviewCourier.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({
					queryKey: trpc.admin.pathKey(),
				});
			},
		}),
	);
	const reviewFailure = useApiFailure(reviewCourier.error);
	const [reviewTarget, setReviewTarget] = useState<{
		profileId: string;
		name: string;
		decision: "VERIFIED" | "REJECTED";
	} | null>(null);
	// `isPending`, not `isFetching`: the first is "no answer yet" and the second is "asking
	// again while the answer is on screen". Only the first one is a skeleton.
	const waiting = useSkeletonHold(query.isPending);
	/**
	 * The refresh control's own busy state, which is the whole of what tells the operator that
	 * the tap registered.
	 *
	 * `isFetching` is deliberately *not* what drives it. The metrics poll every fifteen seconds
	 * and the numbers often come back identical, so a glyph driven by the query's own flag
	 * would light up on the timer as well as on the tap — and a control that is busy for a
	 * reason nobody chose says nothing about the tap, which is the same argument the waiting
	 * branch above makes against greying the cards on a poll. The flag is local and resolved in
	 * `finally` (`components/pull-refresh.tsx:19-23` states the rule; `:51-56` is where that
	 * file resolves it), so it goes down whether the read succeeded or failed: a control that
	 * only came down on success would spin for the rest of the screen's life after one dropped
	 * request.
	 */
	const [refreshing, setRefreshing] = useState(false);
	function refresh() {
		setRefreshing(true);
		void query.refetch().finally(() => setRefreshing(false));
	}

	if (waiting) return <ConsoleSkeleton loadingLabel={t("state.loading")} />;
	if (query.isError) {
		return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
	}

	const data = query.data;
	if (!data) {
		// Same unreachable pair as above: the wait and the failure are both handled, so this is
		// only here to keep four metric reads off a value that might not exist.
		return null;
	}

	return (
		<View style={styles.content}>
			<View style={styles.toolbar}>
				<Pressable
					onPress={refresh}
					disabled={refreshing}
					accessibilityRole="button"
					// `action.refresh`, which this screen needed and the dictionary now has:
					// refreshing is what you do when the screen is fine and you want it newer,
					// retrying is what you do after something failed. The control that said
					// "Reintentar" here was telling the operator something had gone wrong when
					// nothing had.
					accessibilityLabel={t("action.refresh")}
					// State as well as ink: the ring replaces the glyph, and a reader who cannot
					// see it is told by the same object every other busy control in the app uses
					// (`./button` sets `busy` on its own). Without it the control was silent
					// about the one thing it exists to answer — whether the tap landed.
					accessibilityState={{ busy: refreshing, disabled: refreshing }}
					hitSlop={hitSlopFor(type.title.fontSize)}
					style={styles.refresh}
				>
					{refreshing ? (
						// Unlabelled and therefore decoration: the pressable carries `action.refresh`
						// and the state above, and a named spinner inside a named control is that
						// control announced twice (`./spinner`'s own docblock). The box does not
						// move — `./pressable` floors every target at `MIN_TOUCH_TARGET` on both
						// axes, which is the box the skeleton below already draws.
						<Spinner />
					) : (
						<Ionicons
							name="refresh"
							size={type.title.fontSize}
							color={colors.primary}
							// Decoration: the pressable around it carries the name, and an icon read
							// after it would announce the control twice.
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					)}
				</Pressable>
			</View>

			<AnimateIn index={0}>
				<MetricCard
					label={t("admin.overview.businesses")}
					figure={data.businesses.total}
					meta={tp("admin.overview.businesses.active", data.businesses.active)}
				/>
			</AnimateIn>

			<AnimateIn index={1}>
				<MetricCard
					label={t("admin.overview.orders")}
					figure={data.orders.total}
					meta={t("admin.overview.orders.today", {
						count: data.orders.today,
					})}
				/>
			</AnimateIn>

			<AnimateIn index={2}>
				{/* The line this card was missing, and it was missing rather than withheld: the API
				    answers how many of the accounts are administrators, and the operator reading
				    "Usuarios" is almost always asking exactly that. A blank line reserved to keep
				    the rhythm is a card pretending not to know a number it has. */}
				<MetricCard
					label={t("admin.overview.users")}
					figure={data.users.total}
					meta={tp("admin.overview.users.admins", data.users.admins)}
				/>
			</AnimateIn>

			<ScreenSection title={t("admin.overview.gmv")}>
				{data.volumeByCurrency.length === 0 ? (
					<Text variant="body" tone="muted">
						{t("admin.overview.empty")}
					</Text>
				) : (
					<View style={styles.volumes}>
						{data.volumeByCurrency.map((volume, index) => (
							// `reorder` because this group is a read on a timer rather than a
							// layout: `admin.metrics` groups orders by currency while excluding the
							// cancelled and rejected ones, so a currency can be in the answer on one
							// poll and gone on the next, and the rows under the one that went are
							// the same rows at new indices. The key is the currency's own code, so
							// a currency new to the ledger still mounts its own `AnimateIn` and
							// still enters.
							<AnimateIn key={volume.currency} index={index + 3} reorder>
								<Card style={styles.volume}>
									<Text variant="label" tone="muted">
										{volume.currency}
									</Text>
									<Price
										amountMinor={volume.grossMinor}
										currency={volume.currency}
									/>
								</Card>
							</AnimateIn>
						))}
					</View>
				)}
			</ScreenSection>

			<ScreenSection title={t("admin.courier.title")}>
				{courierReview.isPending ? (
					<Skeleton style={styles.courierCard} />
				) : courierReview.isError ? (
					<ErrorState
						error={courierReview.error}
						onRetry={() => courierReview.refetch()}
					/>
				) : courierReview.data?.rows.length ? (
					<View style={styles.courierList}>
						{courierReview.data.rows.map((courier) => (
							<Card key={courier.id} style={styles.courierCard}>
								<Text variant="heading" bold>
									{courier.displayName}
								</Text>
								<Text tone="muted">{courier.userEmail}</Text>
								<Text tone="muted">
									{t("admin.courier.serviceArea")}: {courier.serviceArea}
								</Text>
								{courier.bio ? <Text tone="muted">{courier.bio}</Text> : null}
								<View style={styles.courierActions}>
									<Button
										label={t("admin.courier.verify")}
										size="sm"
										loading={
											reviewCourier.isPending &&
											reviewCourier.variables?.profileId === courier.id
										}
										disabled={reviewCourier.isPending}
										onPress={() =>
											setReviewTarget({
												profileId: courier.id,
												name: courier.displayName,
												decision: "VERIFIED",
											})
										}
									/>
									<Button
										label={t("admin.courier.reject")}
										variant="ghost"
										size="sm"
										disabled={reviewCourier.isPending}
										onPress={() =>
											setReviewTarget({
												profileId: courier.id,
												name: courier.displayName,
												decision: "REJECTED",
											})
										}
									/>
								</View>
							</Card>
						))}
						{reviewFailure.message ? (
							<Text tone="destructive" accessibilityRole="alert">
								{reviewFailure.message}
							</Text>
						) : null}
					</View>
				) : (
					<Text tone="muted">{t("admin.courier.empty")}</Text>
				)}
			</ScreenSection>
			<ConfirmSheet
				open={reviewTarget !== null}
				onClose={() => setReviewTarget(null)}
				title={
					reviewTarget?.decision === "VERIFIED"
						? t("admin.courier.verify.confirm", {
								name: reviewTarget.name,
							})
						: t("admin.courier.reject.confirm", {
								name: reviewTarget?.name ?? "",
							})
				}
				confirmLabel={
					reviewTarget?.decision === "VERIFIED"
						? t("admin.courier.verify")
						: t("admin.courier.reject")
				}
				onConfirm={() => {
					if (!reviewTarget) return;
					const target = reviewTarget;
					setReviewTarget(null);
					if (target.decision === "REJECTED") warning();
					reviewCourier.mutate({
						profileId: target.profileId,
						decision: target.decision,
					});
				}}
			/>
		</View>
	);
}

/**
 * One metric: what it counts, the count, and the line that says what is inside the count.
 *
 * All three lines are required, which is the point — the shape is the guarantee that the
 * three cards cannot drift apart again, and a `meta` that were optional is the same drift
 * with a different spelling. `Card` still draws the surface; this is only the stack on it.
 *
 * The gap is `space.sm`, the value `ConsoleSkeleton` already draws its grey card at, so the
 * swap from grey to numbers does not move the stack the reader is looking at.
 */
function MetricCard({
	label,
	figure,
	meta,
}: {
	label: string;
	/** A number, not a pre-formatted string: `tabular` is a decision about digits. */
	figure: number;
	meta: string;
}) {
	return (
		<Card>
			<View style={styles.metric}>
				<Text variant="label" tone="muted">
					{label}
				</Text>
				<Text variant="display" bold tabular>
					{figure}
				</Text>
				{/* `tabular` here too: the line carries a count, and three cards read down a
				    column are three numbers the eye compares by position. */}
				<Text variant="caption" tone="muted" tabular>
					{meta}
				</Text>
			</View>
		</Card>
	);
}

/**
 * The three cards the console opens with, named so the grey version has keys that mean
 * something. A skeleton keyed by array position is a block that gets reused for a different
 * card the moment one is added.
 */
const SKELETON_CARDS = ["businesses", "orders", "users"] as const;

/**
 * The console in grey: the toolbar, three metric cards and the totals group.
 *
 * The block heights are the text they stand in for, through `./skeletons`' `line()` at the
 * reader's `fontScale` — a height frozen at 100% metrics is exact at 100% and short of the
 * real card at 200% by the growth of its own lines, so the cards are the size the real
 * cards will be at whatever size the reader reads them and nothing shifts when the numbers
 * land. Exactly one block carries the label — a screen reader that hears the wait once is
 * being told, and one that hears it per block is being interrupted by the same word over
 * and over.
 */
function ConsoleSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={styles.content}>
			{/* The refresh control's box, not its glyph. `./pressable` gives every target
			    `MIN_TOUCH_TARGET` whatever its ink draws at, and that box is what the first
			    block of content lands under. */}
			<View style={styles.toolbar}>
				<Skeleton
					style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
				/>
			</View>
			{SKELETON_CARDS.map((card, index) => (
				<Card key={card}>
					<View style={styles.skeletonCard}>
						<Skeleton
							label={index === 0 ? loadingLabel : undefined}
							style={{ width: "40%", ...line("label", fontScale) }}
						/>
						<Skeleton style={{ width: "30%", ...line("display", fontScale) }} />
						{/* The meta line, at its own line height. A grey card one line short of
						    the card that replaces it is the jump the skeleton exists to prevent. */}
						<Skeleton style={{ width: "50%", ...line("caption", fontScale) }} />
					</View>
				</Card>
			))}
			{/* The totals group, in `ScreenSection`'s own shape: a heading line, then a row with
			    the currency on the left and the money on the right. One row, because the number
			    of currencies in the answer is not known until it arrives and `CRC` is the one
			    every deployment has; the group can only grow past it.
			    A wrapper rather than two loose blocks because the group's two spacings differ —
			    `space.xxl` above it and `space.md` under its heading (`screen.tsx:258`, `:263`)
			    — and the parent's single `gap` cannot say both. */}
			<View style={styles.skeletonGroup}>
				<Skeleton style={{ width: "40%", ...line("heading", fontScale) }} />
				<Card style={styles.volume}>
					<Skeleton style={{ width: "20%", ...line("label", fontScale) }} />
					<Skeleton style={{ width: "25%", ...line("heading", fontScale) }} />
				</Card>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	content: { gap: space.lg },
	toolbar: { alignItems: "flex-end" },
	refresh: { alignItems: "center", justifyContent: "center" },
	volumes: { gap: space.sm },
	volume: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
	},
	metric: { gap: space.sm },
	courierList: { gap: space.md },
	courierCard: { gap: space.sm },
	courierActions: { flexDirection: "row", gap: space.sm },
	skeletonCard: { gap: space.sm },
	// The totals group's own two spacings, and they are not one number — see the note in
	// `ConsoleSkeleton`.
	skeletonGroup: { marginTop: space.xxl, gap: space.md },
});
