import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { SignOutSheet } from "@/components/sign-out-sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { requestSignOutNavigation } from "@/lib/sign-out-intent";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * The account tab: the person behind the shop, and the way out.
 *
 * The identity card and the three doors are the account section the menu
 * used to carry (`./menu.tsx` before the burger restructure) — profile,
 * settings, support — moved here so the menu holds only the business. The
 * root `/account` hub stays untouched: it draws `BackButton`s and a profile
 * switcher, both of which are wrong on a root tab, and the customer tree
 * keeps reading it as before.
 *
 * One read (`users.me`) and the session's own sign-out. No shop scope is
 * needed: nothing here is about which shop is on screen.
 */
export default function BusinessAccountScreen() {
	const trpc = useTRPC();
	const { colors } = useTheme();
	const { t } = useT();
	const { signOut } = useSession();
	const [signOutOpen, setSignOutOpen] = useState(false);

	const me = useQuery(trpc.users.me.queryOptions(undefined));
	const waiting = useSkeletonHold(me.isPending);

	/**
	 * Signing out, in three parts, and the middle one is the whole of it.
	 *
	 * **The note goes in before the call does.** `signOut()` ends by setting
	 * `status: "signed-out"`, which makes `lib/role.ts` answer `customer`, which flips the
	 * root `Stack.Protected` guard and unmounts *this screen* in the same commit. A note
	 * written after the call would be written by a component that is no longer on screen,
	 * so `app/_layout.tsx`'s gate would find nothing. See `lib/sign-out-intent.ts`.
	 *
	 * **The haptic is `light`, not `warning`.** The old confirm buzzed `warning()` for a
	 * session that ends and destroys nothing: the codes, the catalogue and the account are
	 * all still there, and the reader signs back in to the same board — which is the whole
	 * of `lib/role.ts`'s argument for keeping the stored preference across a sign-out. The
	 * alarm was spent on the reversible action, and `./sign-out-sheet` spends the app's one
	 * loud colour on the same thing for the same reason.
	 *
	 * **The promise is the sheet's to handle.** This used to be
	 * `void signOut().finally(() => setSigningOut(false))`, which discarded a rejection:
	 * a failed sign-out left the reader on this screen with a spinner that had already
	 * stopped and no sentence anywhere. `SignOutSheet` takes the promise, so a refusal is
	 * reported where the reader is looking, which is inside the panel they are still in.
	 *
	 * The `signingOut` state is **gone**, and that is the fix rather than a cleanup: it
	 * lived on the button *behind* the panel, so its spinner was only ever visible after
	 * `./confirm-sheet` had closed — a busy state on a screen the reader had left.
	 */
	const confirmSignOut = () => {
		light();
		requestSignOutNavigation("authenticate");
		return signOut();
	};

	const initials = me.data?.name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");

	if (me.isError) {
		return (
			<Screen title={t("account.title")}>
				<ErrorState error={me.error} onRetry={() => me.refetch()} />
			</Screen>
		);
	}

	return (
		<>
			<Screen title={t("account.title")} scroll bottomInset>
				{waiting || !me.data ? (
					<AccountSkeleton loadingLabel={t("biz.more.loading")} />
				) : (
					<>
						{/* The person, opening `/profile` where the fields live. */}
						<Card
							onPress={() => router.push("/profile")}
							accessibilityLabel={me.data.name ?? t("account.title")}
							accessibilityHint={t("action.edit")}
						>
							<View style={styles.headerRow}>
								<Image
									uri={me.data.image}
									radiusToken="full"
									style={styles.avatar}
									accessibilityElementsHidden
									importantForAccessibility="no"
								>
									<Text variant="heading" bold>
										{initials}
									</Text>
								</Image>
								<View style={styles.headerBody}>
									<Text variant="heading" bold>
										{me.data.name}
									</Text>
									<Text variant="label" tone="muted">
										{me.data.email}
									</Text>
								</View>
								<Ionicons
									name="chevron-forward"
									size={icon.control}
									color={colors.mutedForeground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
							</View>
						</Card>

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

						{/* Quiet control, and it stays quiet: `./sign-out-sheet` carries the weight of
						    the answer, and a row that shouted *and* then asked spent the alarm
						    twice on one decision. */}
						<Button
							label={t("biz.more.signOut")}
							variant="secondary"
							fullWidth
							style={styles.signOut}
							onPress={() => setSignOutOpen(true)}
						/>
					</>
				)}
			</Screen>
			{/* Sibling of the scroller, not inside it: `./sheet` has no portal, so
			    inside the `Screen` it would scroll away with the content. And a sibling of
			    the fragment's end, not before the row — `./sheet`'s own docblock says a later
			    sibling paints over an earlier overlay, and this is the last thing rendered.

			    Every string arrives as a prop, the same as `./confirm-sheet` took them, and the
			    words themselves are `biz.more.*` rather than new keys: the question and its
			    consequence are this screen's copy, and `auth.signOut.*` stays the courier's so
			    the two trees can word the same question for their own reader. Only the busy
			    and the refusal are shared, because they are about the session rather than
			    about the shop. */}
			<SignOutSheet
				open={signOutOpen}
				onClose={() => setSignOutOpen(false)}
				title={t("biz.more.signOutConfirm")}
				body={t("biz.more.signOutBody")}
				confirmLabel={t("biz.more.signOut")}
				busyLabel={t("auth.signOut.busy")}
				cancelLabel={t("action.cancel")}
				errorLabel={t("auth.signOut.failed")}
				onSignOut={confirmSignOut}
			/>
		</>
	);
}

/**
 * The wait, at the loaded screen's own rhythm: the identity card's lines and
 * the three account rows, at the reader's font scale. The rows stand in at
 * `./list-row`'s own floor, the way `./menu.tsx`'s skeleton does.
 */
function AccountSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={loadingLabel}
		>
			<Card>
				<View style={styles.skeletonLines}>
					<Skeleton style={[{ width: "50%" }, line("heading", fontScale)]} />
					<Skeleton style={[{ width: "70%" }, line("label", fontScale)]} />
				</View>
			</Card>
			<View style={styles.skeletonRows}>
				{[0, 1, 2].map((index) => (
					<Skeleton key={index} style={{ height: MIN_TOUCH_TARGET }} />
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// The identity header: avatar, name stack, chevron in one row — the shape
	// `app/account.tsx` draws for the same person.
	headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	avatar: {
		width: media.card,
		height: media.card,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	headerBody: { flex: 1, gap: TEXT_STACK_GAP },
	skeletonLines: { gap: space.sm },
	skeletonRows: { gap: space.md, marginTop: space.xxl },
	// A long way from the last door above it, as in `app/account.tsx`.
	signOut: { marginTop: space.huge },
});
