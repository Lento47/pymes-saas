import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
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
import { NO_VALUE } from "@/lib/no-value";
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
 * The courier's account tab: the person, and every door out of here.
 *
 * ## Why this screen exists at all
 *
 * Until now the courier's whole account surface was three buttons at the foot of
 * `app/(delivery)/courier-profile.tsx` — a form, with a way out bolted underneath it. Two
 * consequences, both of them the reason this file is here:
 *
 * - **The tree could not reach the shared root routes.** From `/delivery` the only
 *   destinations were `/courier-profile`, `/delivery/[id]` and `/order/[id]`, so Ajustes,
 *   Ayuda, Seguridad and the Bandeja were unreachable — a courier could not change theme,
 *   language or haptics at all. `app/settings.tsx` was always role-agnostic; nothing linked it.
 * - **A docked save and a list of doors cannot share a screen.** The editor now pins a
 *   docked `ActionBar` to its foot, and a bar pinned over navigation is a bar the reader has
 *   to scroll out from under to reach the next screen.
 *
 * So the split is not tidiness: it is what makes a pinned save *possible* and it is what puts
 * the shared account routes within a courier's reach. The shape is `(business)/account.tsx`'s,
 * because that is the same job on the same tree layout.
 */
export default function CourierAccountScreen() {
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
	 * written after the call would be written by a component that is no longer on screen.
	 * See `lib/sign-out-intent.ts` and `(business)/account.tsx:55-85`, which this follows.
	 *
	 * **The haptic is `light`, not `warning`.** Signing out ends a *session* and destroys
	 * nothing: the profile, the runs and the account are all still there.
	 *
	 * **The promise is the panel's to handle.** A rejected sign-out has to be reported where
	 * the reader is looking, which is inside the panel they are still in.
	 */
	const confirmSignOut = () => {
		light();
		requestSignOutNavigation("authenticate");
		return signOut();
	};

	const initials = (me.data?.name ?? me.data?.email ?? "?")
		.trim()
		.charAt(0)
		.toUpperCase();

	if (me.isError) {
		return (
			<Screen title={t("account.title")}>
				<ErrorState error={me.error} onRetry={() => me.refetch()} />
			</Screen>
		);
	}

	return (
		<>
			<Screen title={t("account.title")} scroll>
				{waiting || !me.data ? (
					<AccountSkeleton loadingLabel={t("biz.more.loading")} />
				) : (
					<>
						{/* The person, opening `/profile` where name, phone, email and the picture
						    live. The shape `app/account.tsx` draws for the same person. */}
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
										{me.data.name || NO_VALUE}
									</Text>
									<Text variant="label" tone="muted">
										{me.data.email || NO_VALUE}
									</Text>
									{/* The number the shop calls. A fact, so a chip, and no chip at
									    all when `users.me` sends `null`. */}
									{me.data.phone ? (
										<Facts style={styles.facts}>
											<Fact
												value={me.data.phone}
												iconName="call-outline"
												accessibilityLabel={`${t("account.profile.phone")}, ${me.data.phone}`}
											/>
										</Facts>
									) : null}
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

						<ScreenSection title={t("biz.courier.profile")}>
							<Card>
								<ListRow
									title={t("biz.courier.profileTitle")}
									subtitle={t("biz.courier.preview.title")}
									leading={
										<Ionicons
											name="bicycle-outline"
											size={icon.control}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									divider={false}
									chevron
									onPress={() => router.push("/courier-profile")}
								/>
							</Card>
						</ScreenSection>

						<ScreenSection title={t("account.section.account")}>
							<Card>
								<ListRow
									title={t("admin.nav.settings")}
									subtitle={t("biz.more.settingsSubtitle")}
									chevron
									divider
									onPress={() => router.push("/settings")}
								/>
								{/* The inbox is here and not only on the root hub because
								    `app/account.tsx:331` is the other link to it and the courier tree
								    reaches neither. It matters most once `services/couriers.ts`
								    starts writing the invitation notification — see the sign-out
								    sheet's sibling decision in `docs/architecture.md`. */}
								<ListRow
									title={t("account.inbox")}
									subtitle={t("account.inbox.help")}
									chevron
									divider={false}
									onPress={() => router.push("/inbox")}
								/>
							</Card>
						</ScreenSection>

						{/* Help and Safety are the same two rows `app/account.tsx` draws, for
						    the same reason: they were routes with no way in. Each carries its
						    `.help` key as the hint rather than a restatement of its title. */}
						<ScreenSection title={t("account.section.support")}>
							<Card>
								<ListRow
									title={t("account.help")}
									accessibilityHint={t("account.help.help")}
									chevron
									divider
									onPress={() => router.push("/help" as Href)}
								/>
								<ListRow
									title={t("account.safety")}
									accessibilityHint={t("account.safety.help")}
									chevron
									divider={false}
									onPress={() => router.push("/safety" as Href)}
								/>
							</Card>
						</ScreenSection>

						{/* Quiet control, and it stays quiet: `./sign-out-sheet` carries the
						    weight of the answer, and a row that shouted *and* then asked spent
						    the alarm twice on one decision. */}
						<Button
							label={t("action.signOut")}
							variant="secondary"
							fullWidth
							style={styles.signOut}
							onPress={() => setSignOutOpen(true)}
						/>
					</>
				)}
			</Screen>

			{/* Sibling of the scroller, not inside it: `./sheet` has no portal, so inside the
			    `Screen` it would scroll away with the content. And last of the screen's root,
			    because `./sheet`'s own docblock says a later sibling paints over an earlier
			    overlay. */}
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
 * The wait, at the loaded screen's own rhythm: the identity card's lines and the account
 * rows, at the reader's font scale. The rows stand in at `./list-row`'s own floor.
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
				{[0, 1].map((index) => (
					<Skeleton key={index} style={{ height: MIN_TOUCH_TARGET }} />
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// The identity header: avatar, name stack, chevron in one row — the shape
	// `app/account.tsx:732` draws for the same person.
	headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	avatar: {
		width: media.card,
		height: media.card,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	headerBody: { flex: 1, gap: TEXT_STACK_GAP },
	facts: { marginTop: space.sm },
	skeletonLines: { gap: space.sm },
	skeletonRows: { gap: space.md, marginTop: space.xxl },
	// A long way from the last door above it, as in `app/account.tsx:749`.
	signOut: { marginTop: space.huge },
});
