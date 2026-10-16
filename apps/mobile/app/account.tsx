import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { SignOutSheet } from "@/components/sign-out-sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { NO_VALUE } from "@/lib/no-value";
import { useResolvedRole } from "@/lib/role";
import { requestSignOutNavigation } from "@/lib/sign-out-intent";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
} from "@/theme";

/**
 * What a profile field with no value prints.
 *
 * An em dash is punctuation, so it cannot be anybody's name; it is what a table
 * in any language prints for "no value here", and it is the same glyph in both
 * dictionaries, which is why it is a constant and not a key in
 * `@pymeshub/i18n`: there is nothing in it to translate. It now comes from
 * `@/lib/no-value` with `components/merchant-pulse` and
 * `app/(business)/index.tsx`, which each used to keep their own.
 */

/**
 * One door in the account group. The same shape the four rows and the three conditional ones
 * use, with an explicit destination and an accessible label.
 *
 * `hint` is optional on purpose: a hint is the row's *outcome* — the contract the support
 * group's rows state with their `.help` keys — and where the dictionary holds no outcome
 * sentence for a door, the field is left unset rather than pointed at the title key again.
 * A hint that restates its title is spoken twice by the screen reader, which is worse than
 * no hint at all (`docs/design-mobile.md`, Touch — VoiceOver and TalkBack).
 */
type AccountRow = {
	key: string;
	title: string;
	hint?: string;
	href: Href;
	icon: React.ComponentProps<typeof Ionicons>["name"];
	state?: string;
};

/** Shared account links open the account screen for the active app profile. */
export default function AccountRoute() {
	const { t } = useT();
	const role = useResolvedRole();
	if (role.state === "boot") {
		return (
			<Screen scroll contentStyle={styles.gap}>
				<AccountSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}
	if (role.role === "delivery")
		return <Redirect href="/(delivery)/(tabs)/account" />;
	if (role.role === "business")
		return <Redirect href="/(business)/(tabs)/account" />;
	return <CustomerAccountScreen />;
}

/** Customer identity, shopping history, saved addresses and personal preferences. */
export function CustomerAccountScreen() {
	const trpc = useTRPC();
	const { t } = useT();
	const { colors } = useTheme();
	const { status: sessionStatus, signOut } = useSession();
	const [signOutOpen, setSignOutOpen] = useState(false);

	const signedIn = sessionStatus === "signed-in";
	const me = useQuery(
		trpc.users.me.queryOptions(undefined, { enabled: signedIn }),
	);
	const addresses = useQuery(
		trpc.users.addresses.queryOptions(undefined, { enabled: signedIn }),
	);

	const waiting = useSkeletonHold(
		sessionStatus === "loading" || (signedIn && me.isPending),
	);

	if (waiting) {
		return (
			<Screen scroll contentStyle={styles.gap}>
				<BackButton to="/" />
				<AccountSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}

	if (!signedIn) {
		return (
			<Screen scroll>
				<BackButton to="/" />
				<EmptyState
					icon="person-outline"
					title={t("auth.signIn.title")}
					body={t("auth.signIn.subtitle")}
					actionLabel={t("action.signIn")}
					onAction={() => router.push("/sign-in" as Href)}
				/>
				<Button
					label={t("action.signUp")}
					onPress={() => router.push("/sign-up" as Href)}
					variant="ghost"
					fullWidth
					style={styles.secondAction}
				/>
			</Screen>
		);
	}

	/**
	 * The steps a profile has, and whether this one has taken them. The address
	 * is pushed on once its read lands — until `addresses.data` is there the
	 * card cannot claim an address is missing.
	 *
	 * The avatar is not one of them, and it was: `account.setup.photo` was listed with a
	 * chevron that led to `app/profile.tsx`, which has no control for it — `users.updateProfile`
	 * accepts an `image` (`packages/shared/src/schemas/user.ts:101`) and no client can produce
	 * one, because the API has no upload route and no storage binding for it. So the row was a
	 * step nobody could take, drawn with the affordance of one that could, and it renewed
	 * itself on every visit: precisely the sentence `app/profile.tsx` refuses to count the
	 * avatar in its own completion line over ("a step nobody can take is not progress, it is a
	 * permanent complaint"). The two screens agreed about the avatar in principle and disagreed
	 * in front of the customer; this is the one of the two that was wrong. The row comes back
	 * with the upload path — which is an API route and a picker away, not a control away.
	 */
	const setup: { key: MessageKey; done: boolean; href: Href }[] = [
		{
			key: "account.setup.name",
			done: Boolean(me.data?.name),
			href: "/profile",
		},
		{
			key: "account.setup.phone",
			done: Boolean(me.data?.phone),
			href: "/profile",
		},
	];
	if (addresses.data) {
		setup.push({
			key: "account.setup.address",
			done: addresses.data.length > 0,
			href: "/addresses",
		});
	}
	const missing = setup.filter((item) => !item.done);
	const done = setup.length - missing.length;

	/**
	 * Signing out, the same three-part path `(business)/account` and `(delivery)/account`
	 * already use. The note lands before `signOut()` because that call unmounts this
	 * screen; the haptic is `light` because a session ending destroys nothing; the
	 * promise stays in `./sign-out-sheet` so a refusal is reported in the panel.
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

	// Courier and business tools belong to their dedicated account screens.

	const customerRows: AccountRow[] = [
		{
			key: "history",
			title: t("account.history"),
			hint: t("account.history.help"),
			href: { pathname: "/orders", params: { segment: "past" } },
			icon: "receipt-outline",
		},
		{
			key: "favorites",
			title: t("favorites.title"),
			href: "/favorites",
			icon: "heart-outline",
		},
		{
			key: "addresses",
			title: t("account.addresses.title"),
			hint: t("account.addresses.seeAll.help"),
			href: "/addresses",
			icon: "location-outline",
			state: addresses.data ? `${addresses.data.length}` : undefined,
		},
		{
			key: "inbox",
			title: t("account.inbox"),
			hint: t("account.inbox.help"),
			href: "/inbox",
			icon: "mail-outline",
		},
	];

	const accountRows: AccountRow[] = [
		...customerRows,

		// Ajustes is the device's, not a profile's: theme, language and haptics do not change
		// meaning because you are looking at your runs instead of your orders.
		{
			key: "settings",
			title: t("admin.nav.settings"),
			href: "/settings",
			icon: "settings-outline",
		},
	];
	// Platform access remains gated by the server-confirmed administrator permission.
	if (me.data?.isAdmin) {
		accountRows.push({
			key: "admin",
			title: t("admin.nav.overview"),
			href: "/admin",
			icon: "shield-checkmark-outline",
		});
	}

	return (
		<>
			<Screen scroll contentStyle={styles.gap}>
				<BackButton to="/" />
				{/* The screen's one loud thing. The card itself opens `/profile` —
				    a separate Editar slab under it was the same destination twice.
				    When `users.me` failed there is no card to draw — not one built from
				    `undefined` — so the failure takes the card's own slot, where the
				    reader is already looking, rather than the foot of the screen. */}
				{me.isError ? (
					<AnimateIn index={1}>
						<ErrorState error={me.error} onRetry={() => me.refetch()} />
					</AnimateIn>
				) : (
					<AnimateIn index={1}>
						<Card
							onPress={() => router.push("/edit-profile")}
							accessibilityLabel={me.data?.name ?? t("account.title")}
							accessibilityHint={t("action.edit")}
						>
							<View style={styles.headerRow}>
								<Image
									uri={me.data?.image}
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
										{me.data?.name || NO_VALUE}
									</Text>
									<Text variant="label" tone="muted">
										{me.data?.email || NO_VALUE}
									</Text>
									{/* The number the shop calls, when there is one. A fact,
								    so a chip, and no chip at all when `users.me`
								    sends `null`. */}
									{me.data?.phone ? (
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
					</AnimateIn>
				)}
				{/* Only while something is missing, and gone the moment nothing is.
				    Lists the missing rows rather than every step, so the card shrinks
				    as it is used. Each row routes to its fix. Never while `users.me` is
				    in error: `missing` is computed from a profile nobody read, so every
				    step would be drawn untaken — a complaint about work the reader may
				    have done already. */}
				{!me.isError && missing.length > 0 ? (
					<AnimateIn index={2}>
						<Card style={styles.setupCard}>
							<Text variant="heading" bold>
								{t("account.setup.title")}
							</Text>
							<Text variant="caption" tone="muted" tabular>
								{t("account.setup.progress", {
									done,
									total: setup.length,
								})}
							</Text>
							<View>
								{missing.map((item, index) => (
									<ListRow
										key={item.key}
										title={t(item.key)}
										chevron
										leading={
											<Ionicons
												name="alert-circle-outline"
												size={icon.control}
												color={colors.mutedForeground}
												accessibilityElementsHidden
												importantForAccessibility="no"
											/>
										}
										divider={index < missing.length - 1}
										onPress={() => router.push(item.href)}
									/>
								))}
							</View>
						</Card>
					</AnimateIn>
				) : null}
				{/* Wait for the actual account before showing its available actions. */}
				{me.isError ? null : (
					<AnimateIn index={3}>
						<ScreenSection title={t("account.section.account")}>
							<Card>
								{accountRows.map((row, index) => (
									<ListRow
										key={row.key}
										title={row.title}
										state={row.state}
										chevron
										leading={
											<Ionicons
												name={row.icon}
												size={icon.control}
												color={colors.mutedForeground}
												accessibilityElementsHidden
												importantForAccessibility="no"
											/>
										}
										divider={index < accountRows.length - 1}
										accessibilityHint={row.hint}
										onPress={() => router.push(row.href)}
									/>
								))}
							</Card>
						</ScreenSection>
					</AnimateIn>
				)}
				{/* Two doors that existed as routes with no way in. `./list-row` draws
			    both, and each carries its `.help` key as the hint rather than a
			    restatement of its title — "Abre las preguntas frecuentes" is the
			    outcome, which is the whole job of a hint. */}
				<AnimateIn index={4}>
					<ScreenSection title={t("account.section.support")}>
						<Card>
							<ListRow
								title={t("account.help")}
								chevron
								leading={
									<Ionicons
										name="help-circle-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								divider
								accessibilityHint={t("account.help.help")}
								onPress={() => router.push("/help" as Href)}
							/>
							<ListRow
								title={t("ideas.title")}
								chevron
								leading={
									<Ionicons
										name="bulb-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								divider
								accessibilityHint={t("ideas.help")}
								onPress={() => router.push("/ideas" as Href)}
							/>
							<ListRow
								title={t("account.safety")}
								chevron
								leading={
									<Ionicons
										name="shield-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								divider={false}
								accessibilityHint={t("account.safety.help")}
								onPress={() => router.push("/safety" as Href)}
							/>
						</Card>
					</ScreenSection>
				</AnimateIn>
				<AnimateIn index={5}>
					<Button
						label={t("action.signOut")}
						variant="secondary"
						fullWidth
						style={styles.signOut}
						onPress={() => setSignOutOpen(true)}
					/>
				</AnimateIn>
			</Screen>
			{/* Last in the screen's root and a sibling of the scroller: `./sheet` has no portal,
		    so inside the `Screen` it would scroll away with the content. */}
			<SignOutSheet
				open={signOutOpen}
				onClose={() => setSignOutOpen(false)}
				title={t("auth.signOut.confirm")}
				body={t("auth.signOut.body")}
				confirmLabel={t("action.signOut")}
				busyLabel={t("auth.signOut.busy")}
				cancelLabel={t("action.cancel")}
				errorLabel={t("auth.signOut.failed")}
				onSignOut={confirmSignOut}
			/>
		</>
	);
}

/**
 * The account screen in grey, at the sizes the real thing will be.
 *
 * The text lines are composed with the reader's font scale — the skeleton is the layout
 * standing in for itself, and a skeleton frozen at 100% metrics is eight points short of a
 * real row at 200% (`docs/design-mobile.md`, Waiting). The `MIN_TOUCH_TARGET` blocks are not
 * composed: they stand in for controls, and keep the floor a control owns.
 */
function AccountSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	// The height a line of the variant draws at the reader's scale — the same composition
	// `app/orders`'s skeleton uses, typed once rather than written out per block.
	const line = (variant: keyof typeof type) =>
		Math.round(type[variant].lineHeight * fontScale);

	return (
		<>
			<Card>
				<View style={styles.skeletonLines}>
					<Skeleton
						label={loadingLabel}
						style={{ width: "50%", height: line("heading") }}
					/>
					<Skeleton style={{ width: "70%", height: line("label") }} />
					<Skeleton
						style={{ width: "40%", height: space.sm + line("label") }}
					/>
				</View>
			</Card>
			<View style={styles.stack}>
				<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
				<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	gap: { gap: space.lg },
	stack: { gap: space.md },
	skeletonLines: { gap: space.sm },
	facts: { marginTop: space.sm },
	secondAction: { marginTop: space.sm },
	// The identity header: avatar, name stack, chevron in one row.
	headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	avatar: {
		width: media.card,
		height: media.card,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	// The name stack inside the identity card, at the one text-stack gap the app already
	// owns — `TEXT_STACK_GAP`, which `./business-card`, `./product-row` and `./list-row`
	// stack their bodies at — not another copy of its 2 typed at a fourth call site.
	headerBody: { flex: 1, gap: TEXT_STACK_GAP },
	// The completion card's four lines read as one statement — heading, count, and the rows
	// that are the count's continuation — so they stack at the same `space.sm` the emergency
	// block on `app/safety` uses. `./card` carries padding and no gap of its own, so the
	// statement's gap is stated here and nowhere else.
	setupCard: { gap: space.sm },
	signOut: { marginTop: space.huge },
});
