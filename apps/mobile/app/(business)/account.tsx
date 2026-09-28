import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
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
	const [signingOut, setSigningOut] = useState(false);
	const [signOutOpen, setSignOutOpen] = useState(false);

	const me = useQuery(trpc.users.me.queryOptions(undefined));
	const waiting = useSkeletonHold(me.isPending);

	/**
	 * Signing out asks once, in `./confirm-sheet`, and the confirm carries the
	 * warning haptic. The session lives in the device keychain, so this changes
	 * the *device* rather than a screen — both buttons say what they do, and
	 * the button that opens the question is a quiet one: the destructive
	 * weight belongs on the answer, not on the row that asks.
	 */
	const confirmSignOut = () => {
		warning();
		setSigningOut(true);
		void signOut().finally(() => setSigningOut(false));
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

						{/* Quiet control, destructive weight on the confirm answer. */}
						<Button
							label={t("biz.more.signOut")}
							variant="secondary"
							fullWidth
							style={styles.signOut}
							loading={signingOut}
							disabled={signingOut}
							onPress={() => setSignOutOpen(true)}
						/>
					</>
				)}
			</Screen>
			{/* Sibling of the scroller, not inside it: `./sheet` has no portal, so
			    inside the `Screen` it would scroll away with the content. */}
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
