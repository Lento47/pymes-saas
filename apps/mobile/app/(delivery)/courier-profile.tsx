import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Image,
	Platform,
	StyleSheet,
	View,
} from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { CourierDirectoryCard } from "@/components/courier-directory-card";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { radius, space } from "@/theme";

/**
 * The courier-owned `/courier-profile` route. Keeping it inside `(delivery)` gives a fresh
 * registration the delivery index as its native back destination and applies the role guard.
 *
 * `/files/:id` is a path on the API's origin - `imageUrlSchema` accepts a path
 * and no `http://`, and the web client is same-origin and needs no help. The
 * phone is neither, so this is the one place the prefix is added.
 */
function absolutePhotoUrl(url: string): string {
	return url.startsWith("/") ? `${env.apiUrl.replace(/\/$/, "")}${url}` : url;
}

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
	const [vehicleName, setVehicleName] = useState("");
	const [vehiclePlate, setVehiclePlate] = useState("");
	const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(null);
	const [isAvailable, setIsAvailable] = useState(true);
	const [submitted, setSubmitted] = useState(false);
	const initialized = useRef(false);
	const initial = useRef<{
		displayName: string;
		serviceArea: string;
		bio: string;
		vehicleName: string;
		vehiclePlate: string;
		vehiclePhotoUrl: string | null;
		isAvailable: boolean;
	} | null>(null);

	useEffect(() => {
		if (initialized.current || profile.data === undefined || !me.data) return;
		initialized.current = true;
		const snapshot = {
			displayName: profile.data?.displayName ?? me.data.name,
			serviceArea: profile.data?.serviceArea ?? "",
			bio: profile.data?.bio ?? "",
			vehicleName: profile.data?.vehicleName ?? "",
			vehiclePlate: profile.data?.vehiclePlate ?? "",
			vehiclePhotoUrl: profile.data?.vehiclePhotoUrl ?? null,
			isAvailable: profile.data?.isAvailable ?? true,
		};
		initial.current = snapshot;
		setDisplayName(snapshot.displayName);
		setServiceArea(snapshot.serviceArea);
		setBio(snapshot.bio);
		setVehicleName(snapshot.vehicleName);
		setVehiclePlate(snapshot.vehiclePlate);
		setVehiclePhotoUrl(snapshot.vehiclePhotoUrl);
		setIsAvailable(snapshot.isAvailable);
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
	const photoUpload = useMutation(
		trpc.uploads.create.mutationOptions({
			onSuccess: (result) => setVehiclePhotoUrl(result.path),
		}),
	);
	const photoFailure = useApiFailure(photoUpload.error);

	/**
	 * Pick, then upload - two steps because the picker holds bytes and the upload row
	 * holds the path, and the profile only ever stores the second. Quality 0.8 keeps a
	 * camera's original under the 2 MiB ceiling; over it is a sentence the reader can
	 * act on, not a silent failure, and the profile keeps the photo it already had.
	 */
	const pickVehiclePhoto = async () => {
		try {
			const picked = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				quality: 0.8,
				base64: true,
			});
			if (picked.canceled) return;
			const asset = picked.assets[0];
			if (!asset?.base64) return;
			if ((asset.fileSize ?? 0) > MAX_UPLOAD_BYTES) {
				toast.show(t("biz.courier.vehiclePhoto.tooLarge"));
				return;
			}
			const mimeType =
				asset.mimeType &&
				(UPLOAD_MIME_TYPES as readonly string[]).includes(asset.mimeType)
					? (asset.mimeType as (typeof UPLOAD_MIME_TYPES)[number])
					: "image/jpeg";
			photoUpload.mutate({ mimeType, base64: asset.base64 });
		} catch {
			// The picker itself refused to open - no photos access on an older
			// Android, or the sheet was dismissed before it finished drawing.
			// Nothing to announce: the form keeps whatever photo it already
			// holds, and the next tap asks again.
		}
	};
	const failure = useApiFailure(save.error);

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone - RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android` - so the two live regions below
	 * are the whole of Android's announcement, and iOS, which ignores the prop, has to be
	 * told. One effect for the screen and not one per region: the upload failure and the
	 * save failure are two mutations, so this is the place that decides which sentence is
	 * the one to say now, and a screen with something newer to say has stopped saying the
	 * older thing. Guarded by the platform rather than announced on both - the pairing
	 * `./error-state`, `./rollback-notice` and `app/settings.tsx` all use, because a
	 * sentence a live region has already spoken is not read twice, it is read as two.
	 */
	const announcement = photoFailure.message || failure.message;
	useEffect(() => {
		if (Platform.OS !== "ios" || !announcement) return;
		AccessibilityInfo.announceForAccessibility(announcement);
	}, [announcement]);

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
	const baseline = initial.current;
	// No dirty check on `submitted`: a pristine form has nothing to write, so the
	// save stays dimmed until a field actually differs from the loaded profile.
	const dirty =
		baseline == null
			? false
			: displayName !== baseline.displayName ||
				serviceArea !== baseline.serviceArea ||
				bio !== baseline.bio ||
				vehicleName !== baseline.vehicleName ||
				vehiclePlate !== baseline.vehiclePlate ||
				vehiclePhotoUrl !== baseline.vehiclePhotoUrl ||
				isAvailable !== baseline.isAvailable;

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

			{/*
			    The directory preview, and only once the profile is actually in the
			    directory. Everything here is already on screen: `couriers.profile` for the
			    name, area, bio and availability, and `users.me` for the avatar — which is
			    the same `user.image` the pool entry reads, so this cannot drift from what a
			    shop sees. No request, no new shape.

			    `isMember` and `isInvited` are absent on purpose. They say whether *this*
			    courier is on *that* shop's roster, and there is no "that" here. The card takes
			    the identity half; the business screen supplies its own row as `action`.
			*/}
			{statusValue === "VERIFIED" && profile.data && me.data ? (
				<ScreenSection
					title={t("biz.courier.preview.title")}
					subtitle={t("biz.courier.preview.body")}
				>
					<CourierDirectoryCard
						courier={{
							profileId: profile.data.id,
							displayName: profile.data.displayName,
							image: me.data.image,
							serviceArea: profile.data.serviceArea,
							bio: profile.data.bio,
							isAvailable: profile.data.isAvailable,
						}}
					/>
				</ScreenSection>
			) : null}

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

			{/*
			    The vehicle a run happens in: name, plate, and a picture. It sits
			    between the profile and availability because a business reviews it
			    with the profile - a changed plate sends the row back to PENDING
			    (`services/couriers.ts`), so the two read as one unit.
			*/}
			<ScreenSection title={t("biz.courier.vehicle")}>
				<Field
					label={t("biz.courier.vehicleName")}
					value={vehicleName}
					onChangeText={setVehicleName}
					maxLength={80}
				/>
				<Field
					label={t("biz.courier.vehiclePlate")}
					value={vehiclePlate}
					onChangeText={setVehiclePlate}
					maxLength={20}
					autoCapitalize="characters"
				/>
				{vehiclePhotoUrl ? (
					<View style={styles.photoBlock}>
						<Image
							source={{ uri: absolutePhotoUrl(vehiclePhotoUrl) }}
							style={styles.photo}
							accessibilityLabel={t("biz.courier.vehiclePhoto")}
						/>
						<View style={styles.rows}>
							<Button
								label={t("biz.courier.vehiclePhoto.change")}
								variant="secondary"
								fullWidth
								loading={photoUpload.isPending}
								disabled={photoUpload.isPending}
								onPress={() => void pickVehiclePhoto()}
							/>
							<Button
								label={t("biz.courier.vehiclePhoto.remove")}
								variant="ghost"
								fullWidth
								disabled={photoUpload.isPending}
								onPress={() => setVehiclePhotoUrl(null)}
							/>
						</View>
					</View>
				) : (
					<Button
						label={t("biz.courier.vehiclePhoto.add")}
						variant="secondary"
						fullWidth
						loading={photoUpload.isPending}
						disabled={photoUpload.isPending}
						onPress={() => void pickVehiclePhoto()}
					/>
				)}
				{photoFailure.message ? (
					<Text
						tone="destructive"
						accessibilityRole="alert"
						accessibilityLiveRegion="assertive"
					>
						{photoFailure.message}
					</Text>
				) : null}
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

			{failure.message ? (
				<Text
					tone="destructive"
					accessibilityRole="alert"
					accessibilityLiveRegion="assertive"
				>
					{failure.message}
				</Text>
			) : null}

			{ready ? (
				<Button
					label={t("biz.courier.save")}
					loading={save.isPending}
					// Gated on the upload as well: a save racing a picture that is still
					// in flight would store the profile without the photo the reader just
					// picked, and the toast would say "saved" while losing it.
					disabled={save.isPending || photoUpload.isPending || !dirty}
					fullWidth
					onPress={() => {
						setSubmitted(true);
						if (!displayName.trim() || !serviceArea.trim()) return;
						save.mutate({
							displayName: displayName.trim(),
							serviceArea: serviceArea.trim(),
							bio: bio.trim() || undefined,
							vehicleName: vehicleName.trim() || undefined,
							vehiclePlate: vehiclePlate.trim() || undefined,
							// `undefined` clears: the server reads an absent key as "no
							// photo", so the state is handed over whole, never dropped
							// from the payload.
							vehiclePhotoUrl: vehiclePhotoUrl ?? undefined,
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
	photoBlock: { gap: space.sm },
	photo: {
		width: "100%",
		height: 200,
		borderRadius: radius.md,
	},
	skeleton: { gap: space.md },
	skeletonLine: { height: space.xl, width: "80%" },
});
