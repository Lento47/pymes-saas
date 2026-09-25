import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

export default function CourierProfileScreen() {
	const { t } = useT();
	const { signOut } = useSession();
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	/**
	 * The same ask-once sign-out the account hub uses (`./account.tsx`): the warning haptic
	 * rides the confirm, because the session lives in the device keychain and this question
	 * changes the device rather than a screen.
	 */
	const confirmSignOut = () => {
		warning();
		setSigningOut(true);
		void signOut().finally(() => setSigningOut(false));
	};

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.courier.profileTitle")}
				subtitle={t("biz.courier.profileSubtitle")}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					<ProfileForm
						onSignOut={() => setSignOutOpen(true)}
						signingOut={signingOut}
					/>
				</SignedIn>
			</Screen>
			{/* Last in the screen's root and a sibling of the scroller: `./sheet` has no
		    portal, so inside the `Screen` it would scroll away with the content - the
		    placement `./account.tsx` documents for the identical sheet. */}
			<ConfirmSheet
				open={signOutOpen}
				onClose={() => setSignOutOpen(false)}
				title={t("auth.signOut.confirm")}
				body={t("auth.signOut.body")}
				confirmLabel={t("action.signOut")}
				onConfirm={confirmSignOut}
			/>
		</View>
	);
}

function ProfileForm({
	onSignOut,
	signingOut,
}: {
	onSignOut: () => void;
	signingOut: boolean;
}) {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const { status } = useSession();
	const profile = useQuery(
		trpc.couriers.profile.queryOptions(undefined, {
			enabled: status === "signed-in",
		}),
	);
	const me = useQuery(
		trpc.users.me.queryOptions(undefined, {
			enabled: status === "signed-in",
		}),
	);
	const [displayName, setDisplayName] = useState("");
	const [serviceArea, setServiceArea] = useState("");
	const [bio, setBio] = useState("");
	const [isAvailable, setIsAvailable] = useState(true);
	const [submitted, setSubmitted] = useState(false);
	const initialized = useRef(false);

	useEffect(() => {
		if (initialized.current || profile.data === undefined || !me.data) return;
		initialized.current = true;
		setDisplayName(profile.data?.displayName ?? me.data.name);
		setServiceArea(profile.data?.serviceArea ?? "");
		setBio(profile.data?.bio ?? "");
		setIsAvailable(profile.data?.isAvailable ?? true);
	}, [me.data, profile.data]);

	const save = useMutation(
		trpc.couriers.saveProfile.mutationOptions({
			onSuccess: async () => {
				toast.show(t("biz.courier.saved"));
				await cache.invalidateQueries({
					queryKey: trpc.couriers.pathKey(),
				});
			},
		}),
	);
	const failure = useApiFailure(save.error);
	const waiting = useSkeletonHold(
		status === "loading" || profile.isPending || me.isPending,
	);

	if (waiting) {
		return (
			<View style={styles.skeleton}>
				<Skeleton style={styles.skeletonLine} />
				<Skeleton style={styles.skeletonLine} />
				<Skeleton style={styles.skeletonLine} />
			</View>
		);
	}
	if (profile.isError) {
		return (
			<ErrorState error={profile.error} onRetry={() => profile.refetch()} />
		);
	}
	if (me.isError) {
		return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
	}

	const nameError =
		submitted && !displayName.trim() ? t("form.required") : null;
	const areaError =
		submitted && !serviceArea.trim() ? t("form.required") : null;
	const ready = status === "signed-in" && !!me.data;
	const statusValue = profile.data?.verificationStatus;

	return (
		<View style={styles.content}>
			<Card style={styles.statusCard}>
				<Text variant="heading" bold>
					{statusValue === "VERIFIED"
						? t("biz.courier.verified")
						: statusValue === "REJECTED"
							? t("biz.courier.rejected")
							: t("biz.courier.reviewPending")}
				</Text>
				<Text tone="muted">
					{statusValue === "REJECTED"
						? t("biz.courier.rejected.body")
						: statusValue === "VERIFIED"
							? t("biz.courier.directoryVerified")
							: t("biz.courier.reviewPending.body")}
				</Text>
			</Card>

			<ScreenSection title={t("biz.courier.profile")}>
				<Field
					label={t("biz.courier.displayName")}
					value={displayName}
					onChangeText={setDisplayName}
					error={nameError}
					autoComplete="name"
					maxLength={80}
				/>
				<Field
					label={t("biz.courier.serviceArea")}
					value={serviceArea}
					onChangeText={setServiceArea}
					error={areaError}
					autoComplete="address-line2"
					maxLength={100}
				/>
				<Field
					label={t("biz.courier.bio")}
					value={bio}
					onChangeText={setBio}
					help={t("biz.courier.bio.help")}
					maxLength={300}
					multiline
					numberOfLines={3}
				/>
			</ScreenSection>

			<ScreenSection title={t("biz.courier.availability")}>
				<View style={styles.choices}>
					<Button
						label={t("biz.courier.available")}
						selected={isAvailable}
						onPress={() => setIsAvailable(true)}
						variant="ghost"
						fullWidth
					/>
					<Button
						label={t("biz.courier.unavailable")}
						selected={!isAvailable}
						onPress={() => setIsAvailable(false)}
						variant="ghost"
						fullWidth
					/>
				</View>
			</ScreenSection>

			<Button
				label={t("biz.courier.invites")}
				variant="secondary"
				fullWidth
				onPress={() => router.push("/courier-invites")}
			/>

			{failure.message ? (
				<Text tone="destructive" accessibilityRole="alert">
					{failure.message}
				</Text>
			) : null}

			{ready ? (
				<Button
					label={t("biz.courier.save")}
					loading={save.isPending}
					disabled={save.isPending}
					fullWidth
					onPress={() => {
						setSubmitted(true);
						if (!displayName.trim() || !serviceArea.trim()) return;
						save.mutate({
							displayName: displayName.trim(),
							serviceArea: serviceArea.trim(),
							bio: bio.trim() || undefined,
							isAvailable,
						});
					}}
				/>
			) : null}

			{/*
			    The courier tree has no account tab and no hub row: without these doors on
			    this screen a courier cannot reach the account fields (`/profile` owns name,
			    phone and email), the password, or the session itself - all three are shared
			    root routes the delivery stack simply never links to. Sign out sits last and
			    quiet, the same weight `./account.tsx` gives it: the destructive answer lives
			    in the confirm sheet, not on the row that asks.
			*/}
			<ScreenSection title={t("account.title")}>
				<View style={styles.rows}>
					<Button
						label={t("account.profile.title")}
						variant="secondary"
						fullWidth
						onPress={() => router.push("/profile")}
					/>
					<Button
						label={t("account.password.title")}
						variant="secondary"
						fullWidth
						onPress={() => router.push("/change-password")}
					/>
					<Button
						label={t("action.signOut")}
						variant="secondary"
						fullWidth
						loading={signingOut}
						disabled={signingOut}
						onPress={onSignOut}
					/>
				</View>
			</ScreenSection>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	statusCard: { gap: space.sm },
	choices: { gap: space.sm },
	rows: { gap: space.sm },
	skeleton: { gap: space.md },
	skeletonLine: { height: space.xl, width: "80%" },
});
