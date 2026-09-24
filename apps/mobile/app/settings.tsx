import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type Locale,
	type MessageKey,
	SUPPORTED_LOCALES,
} from "@pymeshub/i18n";
import type { FulfilmentKind } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { DeviceSettings } from "@/components/device-settings";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { marketplaceAuth } from "@/lib/auth/client";
import { authErrorKey, useSession } from "@/lib/auth/session";
import {
	areHapticsEnabled,
	getDefaultFulfilment,
	initDevicePrefs,
	setDefaultFulfilment,
	setHapticsEnabled,
} from "@/lib/device-prefs";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	space,
	THEME_MODES,
	type ThemeMode,
	useTheme,
	useThemeMode,
} from "@/theme";

/**
 * Ajustes: preferences and the doors they open.
 *
 * Preferencias lives here rather than inline on the account hub: theme,
 * language, the fulfilment checkout opens on and the haptics switch are
 * device-level choices that work signed out, and the hub's job is identity
 * plus the account's doors. The rows below it are the same destinations the
 * hub used to draw — profile, addresses, help, safety — as rows, never as
 * duplicated forms.
 *
 * What is deliberately not here: payments (no gateway by design), terms
 * screens (no routes), promo or new-store toggles (no producer writes those
 * rows — `packages/db/src/schema.ts` says so on the columns — so a switch for
 * them would be a control for a silence), and a "clear searches" row
 * (`lib/recent-searches.ts` is unreferenced: nothing draws the list, so a
 * button clearing it would clear something nobody can see).
 */
export default function Settings() {
	const { t, locale, setLocale } = useT();
	const { colors } = useTheme();
	const { mode, setMode } = useThemeMode();
	const { status } = useSession();
	const toast = useToast();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [fulfilment, setFulfilment] = useState<FulfilmentKind>("PICKUP");
	const [haptics, setHaptics] = useState(true);
	const [revoking, setRevoking] = useState(false);
	const [revokeFailure, setRevokeFailure] = useState<string | null>(null);
	const [revokeOpen, setRevokeOpen] = useState(false);
	const revokingRef = useRef(false);

	const signedIn = status === "signed-in";

	// The device's own answers, read once. The defaults match a fresh install
	// (`true`, `"PICKUP"`), so the first frame is never wrong, only possibly
	// stale for the milliseconds storage takes.
	useEffect(() => {
		void initDevicePrefs().then(() => {
			setFulfilment(getDefaultFulfilment());
			setHaptics(areHapticsEnabled());
		});
	}, []);

	/**
	 * The server's answers, read once the session says whose they are. Each
	 * toggle keeps a local override so the control answers the tap
	 * immediately; the mutation writes through, and a refusal reverts to the
	 * row the server is still holding — said the two ways the optimistic-write
	 * rule asks: the failure's own sentence under the section, and the
	 * `warning` haptic a rolled-back write owes (`docs/design-mobile.md`,
	 * Waiting §3). No toast on success — a switch that
	 * stays where it was put is its own confirmation, and a toast on every
	 * flip would be four announcements for two decisions.
	 */
	const serverPrefs = useQuery(
		trpc.users.notificationPrefs.queryOptions(undefined, {
			enabled: signedIn,
		}),
	);
	const [override, setOverride] = useState<{
		notifyOrderUpdates?: boolean;
		notifyReviewReplies?: boolean;
		showReviewAvatar?: boolean;
	} | null>(null);
	const prefsSave = useMutation(
		trpc.users.updatePreferences.mutationOptions({
			onSuccess: async () => {
				setOverride(null);
				await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
			},
			onError: () => {
				// The rollback's haptic half: a failed optimistic write is a commit
				// that did not stick, so it warns beside the revert (design-mobile,
				// Waiting §3) — the sentence is `prefsFailure`'s, drawn under the section.
				warning();
				setOverride(null);
			},
		}),
	);
	const prefsFailure = useApiFailure(prefsSave.error);
	const shown = {
		notifyOrderUpdates:
			override?.notifyOrderUpdates ??
			serverPrefs.data?.notifyOrderUpdates ??
			true,
		notifyReviewReplies:
			override?.notifyReviewReplies ??
			serverPrefs.data?.notifyReviewReplies ??
			true,
		showReviewAvatar:
			override?.showReviewAvatar ?? serverPrefs.data?.showReviewAvatar ?? true,
	};
	const flip = (
		key: "notifyOrderUpdates" | "notifyReviewReplies" | "showReviewAvatar",
		value: boolean,
	) => {
		if (!signedIn || prefsSave.isPending) return;
		setOverride((was) => ({ ...was, [key]: value }));
		prefsSave.mutate({ [key]: value });
	};

	/**
	 * The question is asked in `./confirm-sheet`; the guard against a second tap stays here,
	 * because the sheet closes on confirm and a screen that is mid-revoke is not re-asked.
	 */
	const confirmRevoke = () => {
		if (revokingRef.current) return;
		warning();
		revokingRef.current = true;
		setRevoking(true);
		setRevokeFailure(null);
		void marketplaceAuth
			.revokeOtherSessions()
			.then(() => toast.show(t("account.sessions.revoked")))
			.catch((error: unknown) => {
				setRevokeFailure(
					t(authErrorKey(error instanceof Error ? error.message : "")),
				);
			})
			.finally(() => {
				revokingRef.current = false;
				setRevoking(false);
			});
	};

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the two
	 * assertions on `prefsFailure` below and the one on the revoke line are the whole of
	 * Android's announcement, and iOS, which ignores the prop, has to be told.
	 *
	 * One effect for the screen and not one per live region: `prefsFailure.message` is drawn
	 * twice (the two notification switches share one form and one sentence), and an effect per
	 * region would say the same words twice on iOS while Android kept saying them once. The
	 * pair is joined into one value for the same reason — the two failures are independent
	 * mutations, so this is the one place that has to decide which is the sentence now, and a
	 * screen with something newer to say is a screen that has stopped saying the older thing.
	 * Guarded by the platform rather than announced on both: a sentence a live region has
	 * already spoken is not read twice, it is read as two sentences.
	 */
	const announcement = prefsFailure.message || revokeFailure;
	useEffect(() => {
		if (Platform.OS !== "ios" || !announcement) return;
		AccessibilityInfo.announceForAccessibility(announcement);
	}, [announcement]);

	return (
		<>
			<Screen title={t("admin.nav.settings")} scroll contentStyle={styles.gap}>
				<AnimateIn index={0}>
					<ScreenSection title={t("account.section.preferences")}>
						<View style={styles.setting}>
							<Text variant="label" bold>
								{t("settings.theme")}
							</Text>
							<Text variant="caption" tone="muted">
								{t("settings.theme.help")}
							</Text>
							<Segmented
								label={t("settings.theme")}
								value={mode}
								onChange={(value) => setMode(value as ThemeMode)}
								options={THEME_MODES.map((option) => ({
									value: option,
									label: t(THEME_LABELS[option]),
								}))}
							/>
						</View>

						<View style={styles.setting}>
							<Text variant="label" bold>
								{t("locale.switch")}
							</Text>
							<Segmented
								label={t("locale.switch")}
								value={locale}
								onChange={(value) => setLocale(value as Locale)}
								options={SUPPORTED_LOCALES.map((option) => ({
									value: option,
									label: t(option === "es" ? "locale.es" : "locale.en"),
								}))}
							/>
						</View>

						{/* Which of the two closed options checkout opens on. Stored on
					    the device beside the locale; checkout reads it as its
					    initial state rather than hardcoding PICKUP. */}
						<View style={styles.setting}>
							<Text variant="label" bold>
								{t("settings.fulfilment")}
							</Text>
							<Segmented
								label={t("settings.fulfilment")}
								value={fulfilment}
								onChange={(value) => {
									const next = value as FulfilmentKind;
									setFulfilment(next);
									void setDefaultFulfilment(next);
								}}
								options={[
									{ value: "PICKUP", label: t("checkout.pickup") },
									{ value: "DELIVERY", label: t("checkout.delivery") },
								]}
							/>
						</View>

						{/* The customer's own switch for the four haptics. Off means
					    `lib/haptics.ts` runs none of them; the visual twin carries
					    the meaning alone, which the module already guarantees. */}
						<View style={styles.setting}>
							<Text variant="label" bold>
								{t("settings.haptics")}
							</Text>
							<Text variant="caption" tone="muted">
								{t("settings.haptics.help")}
							</Text>
							<Segmented
								label={t("settings.haptics")}
								value={haptics ? "on" : "off"}
								onChange={(value) => {
									const next = value === "on";
									setHaptics(next);
									void setHapticsEnabled(next);
								}}
								options={[
									{ value: "on", label: t("settings.haptics.on") },
									{ value: "off", label: t("settings.haptics.off") },
								]}
							/>
						</View>
					</ScreenSection>
				</AnimateIn>

				<DeviceSettings />

				{/* Only signed in: the switches are rows on this customer's own
			    record, and signed out there is no record to read them from.
			    Each flips locally and writes through; a refusal reverts to the
			    stored row and names itself under the section. */}
				{signedIn ? (
					<AnimateIn index={1}>
						<ScreenSection title={t("settings.notifications")}>
							<View style={styles.setting}>
								<Text variant="label" bold>
									{t("settings.notifications.orders")}
								</Text>
								<Text variant="caption" tone="muted">
									{t("settings.notifications.orders.help")}
								</Text>
								<Segmented
									label={t("settings.notifications.orders")}
									disabled={!serverPrefs.isSuccess || prefsSave.isPending}
									value={shown.notifyOrderUpdates ? "on" : "off"}
									onChange={(value) =>
										flip("notifyOrderUpdates", value === "on")
									}
									options={[
										{ value: "on", label: t("settings.switch.on") },
										{ value: "off", label: t("settings.switch.off") },
									]}
								/>
							</View>

							<View style={styles.setting}>
								<Text variant="label" bold>
									{t("settings.notifications.replies")}
								</Text>
								<Text variant="caption" tone="muted">
									{t("settings.notifications.replies.help")}
								</Text>
								<Segmented
									label={t("settings.notifications.replies")}
									disabled={!serverPrefs.isSuccess || prefsSave.isPending}
									value={shown.notifyReviewReplies ? "on" : "off"}
									onChange={(value) =>
										flip("notifyReviewReplies", value === "on")
									}
									options={[
										{ value: "on", label: t("settings.switch.on") },
										{ value: "off", label: t("settings.switch.off") },
									]}
								/>
							</View>

							{prefsSave.isError ? (
								<Text
									variant="body"
									tone="destructive"
									accessibilityRole="alert"
									accessibilityLiveRegion="assertive"
								>
									{prefsFailure.message}
								</Text>
							) : null}
						</ScreenSection>
					</AnimateIn>
				) : null}

				{signedIn ? (
					<AnimateIn index={2}>
						<ScreenSection title={t("settings.privacy")}>
							<View style={styles.setting}>
								<Text variant="label" bold>
									{t("settings.privacy.photo")}
								</Text>
								<Text variant="caption" tone="muted">
									{t("settings.privacy.photo.help")}
								</Text>
								<Segmented
									label={t("settings.privacy.photo")}
									disabled={!serverPrefs.isSuccess || prefsSave.isPending}
									value={shown.showReviewAvatar ? "on" : "off"}
									onChange={(value) => flip("showReviewAvatar", value === "on")}
									options={[
										{ value: "on", label: t("settings.switch.on") },
										{ value: "off", label: t("settings.switch.off") },
									]}
								/>
							</View>

							{prefsSave.isError ? (
								<Text
									variant="body"
									tone="destructive"
									accessibilityRole="alert"
									accessibilityLiveRegion="assertive"
								>
									{prefsFailure.message}
								</Text>
							) : null}
						</ScreenSection>
					</AnimateIn>
				) : null}

				<AnimateIn index={3}>
					<ScreenSection title={t("account.section.account")}>
						<Card>
							<ListRow
								title={t("account.profile.title")}
								chevron
								leading={
									<Ionicons
										name="person-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								onPress={() => router.push("/profile")}
							/>
							<ListRow
								title={t("account.addresses.title")}
								chevron
								divider={false}
								leading={
									<Ionicons
										name="location-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								accessibilityHint={t("account.addresses.seeAll.help")}
								onPress={() => router.push("/addresses")}
							/>
						</Card>
					</ScreenSection>
				</AnimateIn>

				{/* Only signed in: both rows spend the session — one changes the
			    identifier it belongs to, the other drops every session but this
			    one. Signed out there is no session to spend either on. */}
				{signedIn ? (
					<AnimateIn index={4}>
						<ScreenSection title={t("account.safety")}>
							<Card>
								<ListRow
									title={t("account.password.title")}
									chevron
									leading={
										<Ionicons
											name="key-outline"
											size={icon.control}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									onPress={() => router.push("/change-password")}
								/>
								<ListRow
									title={t("account.sessions.revoke")}
									divider={false}
									leading={
										<Ionicons
											name="phone-portrait-outline"
											size={icon.control}
											color={colors.mutedForeground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									accessibilityHint={t("account.sessions.revokeBody")}
									onPress={() => setRevokeOpen(true)}
								/>
							</Card>
							{revokeFailure || revoking ? (
								<Text
									variant="body"
									tone={revokeFailure ? "destructive" : "muted"}
									accessibilityRole={revokeFailure ? "alert" : undefined}
									accessibilityLiveRegion="assertive"
									style={styles.revokeStatus}
								>
									{revokeFailure ?? t("state.loading")}
								</Text>
							) : null}
						</ScreenSection>
					</AnimateIn>
				) : null}

				<AnimateIn index={5}>
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
								accessibilityHint={t("account.help.help")}
								onPress={() => router.push("/help")}
							/>
							<ListRow
								title={t("account.safety")}
								chevron
								divider={false}
								leading={
									<Ionicons
										name="lock-closed-outline"
										size={icon.control}
										color={colors.mutedForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								}
								accessibilityHint={t("account.safety.help")}
								onPress={() => router.push("/safety")}
							/>
						</Card>
					</ScreenSection>
				</AnimateIn>

				<AnimateIn index={6}>
					<ScreenSection title={t("settings.about")}>
						<Card>
							{/* No `onPress`, so the row draws as text rather than a
						    button that does nothing. The version is data from the
						    manifest, not copy, which is why it needs no key. */}
							<ListRow
								title={t("settings.version")}
								state={Constants.expoConfig?.version ?? "—"}
								accessibilityRole="none"
								divider={false}
							/>
						</Card>
					</ScreenSection>
				</AnimateIn>
			</Screen>
			{/* Last in the screen's root and a sibling of the scroller: `./sheet` has no portal, so
		    inside the `Screen` it would scroll away with the content. */}
			<ConfirmSheet
				open={revokeOpen}
				onClose={() => setRevokeOpen(false)}
				title={t("account.sessions.revoke")}
				body={t("account.sessions.revokeBody")}
				confirmLabel={t("account.sessions.revoke")}
				onConfirm={confirmRevoke}
			/>
		</>
	);
}

/**
 * The theme as a set of segments, and this screen is the only caller.
 */
const THEME_LABELS: Record<ThemeMode, MessageKey> = {
	system: "settings.theme.system",
	light: "settings.theme.light",
	dark: "settings.theme.dark",
};

const styles = StyleSheet.create({
	gap: { gap: space.lg },
	// One labelled setting: its name, what it does, and the control.
	setting: { gap: space.sm, marginBottom: space.md },
	// The section draws its children with no gap of its own, so this margin is the whole
	// separation between the card and the status that answers it — the same `space.md` the
	// section head pays under its title and the failure line under a preference sits at.
	revokeStatus: { marginTop: space.md },
});
