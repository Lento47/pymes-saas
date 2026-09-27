import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import {
	type AccountProfile,
	getAccountProfile,
	initDevicePrefs,
	setAccountProfile,
} from "@/lib/device-prefs";
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
	type,
	useTheme,
} from "@/theme";

/**
 * What a profile field with no value prints.
 *
 * An em dash is punctuation, so it cannot be anybody's name; it is what a table
 * in any language prints for "no value here", and it is the same glyph in both
 * dictionaries, which is why it is a constant here and not a key in
 * `@pymeshub/i18n`: there is nothing in it to translate.
 */
const NO_VALUE = "—";

/**
 * One door in the account group. The same shape the four rows and the three conditional ones
 * always had; named because three profile branches and two shared rows now build it.
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

/**
 * The word on each profile's segment.
 *
 * Spelled out rather than built from the value, the way `./status-badge`'s map and
 * `app/settings.tsx`'s are: a profile added to `AccountProfile` fails `tsc` here before it
 * fails a customer's screen. Every one of the three is a landed key — the first two are the
 * admin console's own role filter, the third is the fourth membership role's label — and
 * `docs/design-mobile.md:484-489` is why they are read rather than re-invented.
 */
const PROFILE_LABEL: Record<AccountProfile, MessageKey> = {
	customer: "admin.users.role.customer",
	business: "admin.users.role.business",
	delivery: "biz.staff.role.COURIER",
};

/**
 * Everything about you, and every door out of here.
 *
 * A distilled hub: one identity header, one account group, one support group,
 * and the way out. Preferences live behind the Ajustes row (`app/settings.tsx`)
 * rather than inline: theme and language are device-level choices, and the
 * hub's job is identity plus the account's doors. The business and admin
 * consoles are rows in the account group rather than buttons; the inbox folds
 * into the same group. No 2x2 shortcut grid — it duplicated the four rows below
 * it with the same four destinations. No payments row: the API has no payments
 * procedure by design (`docs/api-surface.md`), and `account.ts` carries no
 * `wallet.*` key for the same reason.
 *
 * The support group is the dictionary's `account.section.support`, and it is
 * drawn because both of its destinations already existed as routes and were
 * reachable *only* by deep link: `app/help.tsx` and `app/safety.tsx` had no row
 * anywhere, so "Ayuda" and "Seguridad" were screens a customer could not walk
 * to. `account.help`, `account.safety` and their two `.help` hints are the keys
 * this group reads — landed in the dictionary before the screen that wanted
 * them, which is `docs/design-mobile.md` Rule 8 working in the direction it was
 * written for. It is a separate group rather than three more rows in the
 * account group because the account group is *about the customer's own record*
 * (their history, their addresses, their inbox) and these two are about the
 * platform: the dictionary names the distinction `account.section.account` vs
 * `account.section.support`, and a row about how to report a problem does not
 * belong under a heading that means "your account".
 *
 * The profile comes from `users.me`; completeness adds one short read,
 * `users.addresses`, shared with `app/addresses.tsx` via the cache.
 *
 * ## Three profiles, one screen
 *
 * A person can be a customer, the owner of a shop and a courier at once, and this hub used to
 * answer that by drawing every set of rows in one list — "Historial de pedidos" and "Tu negocio"
 * as neighbours, which reads as one account rather than one person wearing three hats. The
 * switch at the top now decides it: **Cliente** draws the four customer doors,
 * **Negocio** draws the owner doors (the console, or the onboarding that leads to it when
 * there is no shop yet), **Repartidor** draws the courier board, profile and invitations,
 * and what stays is what belongs to the person either way — identity, completeness, Ajustes, support
 * and the way out. The choice is remembered on the device (`lib/device-prefs.ts`): a switch that
 * forgot would put an owner back in the customer hub on every visit.
 *
 * Which profiles are *offered* is read from `memberships`, and that is what makes the three
 * exclusive rather than three names for one thing. A `COURIER` row earns Repartidor and nothing
 * else; any other role earns Negocio; a customer with neither is offered one profile and the
 * switch is not drawn at all. So "delivery cannot be business and cannot be a regular user" is
 * not a rule this screen enforces — it is what the data already says, drawn.
 *
 * It decides the *view*, never the permission. `apps/api/src/context.ts` re-reads the caller's
 * memberships on every request and every procedure decides for itself, so switching is a way of
 * looking at the account rather than a claim about it — which is also why the doors are chosen
 * from `me.memberships` rather than from the switch. A signed-in person with no shop who switches
 * to Negocio is not shown a console they cannot open; they are shown the onboarding, which is the
 * same row that was there before the switch existed.
 */
export default function AccountScreen() {
	const trpc = useTRPC();
	const { t } = useT();
	const { colors } = useTheme();
	const { status: sessionStatus, signOut } = useSession();
	const [signingOut, setSigningOut] = useState(false);
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [profile, setProfile] = useState<AccountProfile>("customer");

	// The stored answer, read once. `"customer"` is the value a fresh install behaves as, so the
	// first frame is never wrong, only possibly stale for the milliseconds storage takes — the
	// same order `app/settings.tsx` reads its two device preferences in.
	useEffect(() => {
		void initDevicePrefs().then(() => setProfile(getAccountProfile()));
	}, []);

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
	 * Signing out asks once, in `./confirm-sheet`, and the confirm carries the warning haptic.
	 * The session lives in the device keychain, so this changes the *device* rather than a
	 * screen — both buttons say what they do, and the button that opens the question is a quiet
	 * one: the destructive weight belongs on the answer, not on the row that asks.
	 */
	const confirmSignOut = () => {
		warning();
		setSigningOut(true);
		void signOut().finally(() => setSigningOut(false));
	};

	const initials = (me.data?.name ?? me.data?.email ?? "?")
		.trim()
		.charAt(0)
		.toUpperCase();

	/**
	 * Which profiles this person has, and which one is drawn.
	 *
	 * A profile is earned by a membership row, read from `users.me` — the same read the owner
	 * door has always come from. A `COURIER` membership earns the delivery profile; any other
	 * role earns the business one; and `customer` needs no row at all, because that is what
	 * everybody is before they are anything else. The three are exclusive by construction:
	 * nobody is offered delivery without a `COURIER` row, and the switch cannot grant what the
	 * API would refuse — `apps/api/src/context.ts` re-reads the memberships on every request
	 * and each procedure decides for itself.
	 *
	 * `shown` is the state with the offered set applied. The stored answer can be a profile this
	 * person no longer has — a courier whose run ended, a shop that was closed — and a screen
	 * that honoured it would draw an empty board as though it were the truth. It falls to the
	 * last profile they do have, which for a courier-and-nothing-else is delivery: `docs/domain.md`
	 * says a courier is not a shopper, so the customer's four doors are not where their account
	 * opens.
	 */
	const isCourier = Boolean(
		me.data?.memberships.some((one) => one.role === "COURIER"),
	);
	const isBusiness = Boolean(
		me.data?.memberships.some((one) => one.role !== "COURIER"),
	);
	const offered: AccountProfile[] = ["customer"];
	if (isBusiness) offered.push("business");
	if (isCourier) offered.push("delivery");
	const shown: AccountProfile = offered.includes(profile)
		? profile
		: isCourier && !isBusiness
			? "delivery"
			: "customer";

	/**
	 * The rows the chosen profile owns, and the two doors that belong to neither.
	 *
	 * The switch above decides the middle of this screen and then moves the app to
	 * the tree that owns the choice (board, runs, or feed) - staying on the hub
	 * would leave the menu the reader asked for one navigation away. What stays put
	 * either way is deliberate: the identity card,
	 *
	 * Business and admin rows join only when the API confirms them — a button to a console the
	 * reader does not have is worse than no button. `users.me` is that confirmation and it
	 * arrives with the profile: `MeResult` carries every membership with its business name and
	 * role (`apps/api/src/services/users.ts:44`), resolved from D1 on every request
	 * (`apps/api/src/context.ts:182`), so the owner profile costs one read rather than two.
	 */
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

	// The owner's doors, and which ones they are depends on whether they have a shop yet.
	// Nothing is drawn while `users.me` is in doubt: an owner whose profile failed to load is
	// not an owner with no shop, and "Crear negocio" is the wrong sentence for them.
	//
	// Two doors once there is a shop, because a shop is two jobs: the day at a glance
	// (`/(business)`, the feed — the group href, which resolves to the tree's own index,
	// the same door a cold start and a profile switch both land on) and the menu those
	// orders are for (`/products`). The feed carries the board as one of its tabs, so
	// this row opens the whole console rather than one tab of it.
	const ownerRows: AccountRow[] = me.data
		? isBusiness
			? [
					{
						key: "business",
						title: t("biz.dashboard.title"),
						href: "/(business)",
						icon: "storefront-outline",
					},
					{
						key: "products",
						title: t("biz.nav.products"),
						href: "/products",
						icon: "fast-food-outline",
					},
				]
			: [
					{
						key: "new-business",
						title: t("biz.onboarding.create"),
						href: "/new-business",
						icon: "storefront-outline",
					},
				]
		: [];

	// The courier's own view: the board, the profile that businesses review, and the
	// invitations that can add this person to a shop.
	const deliveryRows: AccountRow[] = [
		{
			key: "delivery",
			title: t("biz.staff.role.COURIER"),
			href: "/delivery",
			icon: "bicycle-outline",
		},
		{
			key: "courier-profile",
			title: t("biz.courier.profile"),
			href: "/courier-profile",
			icon: "person-circle-outline",
		},
		{
			key: "courier-invites",
			title: t("biz.courier.invites"),
			href: "/courier-invites",
			icon: "mail-outline",
		},
	];

	const courierSetupRow: AccountRow = {
		key: "courier-profile",
		title: t("biz.courier.profile"),
		href: "/courier-profile",
		icon: "bicycle-outline",
	};
	const accountRows: AccountRow[] = [
		...(shown === "delivery"
			? deliveryRows
			: shown === "business"
				? ownerRows
				: customerRows),
		...(shown === "delivery" ? [] : [courierSetupRow]),

		// Ajustes is the device's, not a profile's: theme, language and haptics do not change
		// meaning because you are looking at your runs instead of your orders.
		{
			key: "settings",
			title: t("admin.nav.settings"),
			href: "/settings",
			icon: "settings-outline",
		},
	];
	// Neither profile, so it is drawn in both: the admin console is the platform's, and an
	// administrator who switched to their shop would otherwise have to switch back to reach it.
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

				{/* Three profiles, one screen. The switch is at the top because it decides what
				    everything under it is about, and it is a `./segmented` rather than a row
				    because the set is closed and choosing one changes the screen you are already
				    on — which is the distinction that component's own docblock draws against
				    `./category-rail`.

				    Its strings are landed keys rather than new ones: the group's own label is
				    `account.profile.title` ("Perfil"), the two person names are the dictionary's
				    `admin.users.role.*` pair ("Cliente", "Negocio"), and the courier's is
				    `biz.staff.role.COURIER` ("Repartidor"), the fourth membership role's own label.
				    Those were written for the admin console's user filter and the owner's staff
				    list; this screen is the next surface reading them, and
				    `docs/design-mobile.md:484-489` is why that is a promotion rather than an
				    addition — a lane that needs a string reports it and stops, and a switcher
				    that invented `account.profile.customer` would not compile until both locales
				    landed. If the dictionary ever grows that set, this call site moves to it. */}
				{offered.length > 1 ? (
					<AnimateIn index={0}>
						<Segmented
							label={t("account.profile.title")}
							value={shown}
							// The haptic is `./segmented`'s own, on the settle. A switch that only
							// changes the state would forget by the next visit, which is not a switch.
							onChange={(value) => {
								const next = value as AccountProfile;
								setProfile(next);
								// Persist first, move second: the write below lands the module
								// synchronously and the storage asynchronously, and the destination
								// tree's guard re-reads storage on mount - navigating before the
								// write lands would let it resolve the old profile and bounce
								// straight back. The hub rows update from the local state
								// immediately, so the wait below is invisible.
								void (async () => {
									await setAccountProfile(next);
									// The group href, not a member route: `(business)` resolves to
									// the tree's own index — the feed — while `/business` names the
									// orders *tab* inside it. An owner who switches profile wants
									// the day at a glance, and the board is one tab of it, not the
									// door; `app/index.tsx`'s resolver redirects to the same group
									// href on a cold start.
									router.replace(
										next === "business"
											? "/(business)"
											: next === "delivery"
												? "/(delivery)"
												: "/(customer)",
									);
								})();
							}}
							options={offered.map((one) => ({
								value: one,
								label: t(PROFILE_LABEL[one]),
							}))}
						/>
					</AnimateIn>
				) : null}

				{/* The screen's one loud thing. The card itself opens `/profile` —
				    a separate Editar slab under it was the same destination twice. */}
				{me.isError ? null : (
					<AnimateIn index={1}>
						<Card
							onPress={() => router.push("/profile")}
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
			    as it is used. Each row routes to its fix. */}
				{missing.length > 0 ? (
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

				{me.isError ? (
					<AnimateIn index={5}>
						<ErrorState error={me.error} onRetry={() => me.refetch()} />
					</AnimateIn>
				) : null}

				<AnimateIn index={6}>
					<Button
						label={t("action.signOut")}
						variant="secondary"
						fullWidth
						style={styles.signOut}
						loading={signingOut}
						disabled={signingOut}
						onPress={() => setSignOutOpen(true)}
					/>
				</AnimateIn>
			</Screen>
			{/* Last in the screen's root and a sibling of the scroller: `./sheet` has no portal,
		    so inside the `Screen` it would scroll away with the content. */}
			<ConfirmSheet
				open={signOutOpen}
				onClose={() => setSignOutOpen(false)}
				title={t("auth.signOut.confirm")}
				body={t("auth.signOut.body")}
				confirmLabel={t("action.signOut")}
				onConfirm={confirmSignOut}
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
