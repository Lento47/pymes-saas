import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Segmented } from "@/components/segmented";
import { SignOutSheet } from "@/components/sign-out-sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { requestSignOutNavigation } from "@/lib/sign-out-intent";
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
	const [reviewOpen, setReviewOpen] = useState(false);

	/**
	 * Where the review question's answer goes.
	 *
	 * `./sheet` has no portal, so a sheet rendered inside `Screen` scrolls away with the content
	 * — which is why both panels here are siblings of the frame rather than children of it. That
	 * puts them a level above the form, and the form owns the write. So the two halves meet at a
	 * ref: `./profile.tsx` already reaches past its own frame for `ActionBar` the same way, and a
	 * second copy of the payload in the panel would be a second answer to "what is being saved".
	 */
	const saveRef = useRef<(() => void) | null>(null);

	/**
	 * Signing out, in three parts, and the middle one is the whole of it.
	 *
	 * **The note goes in before the call does.** `signOut()` ends by setting `status:
	 * "signed-out"`, which makes `lib/role.ts` answer `customer`, which flips the root
	 * `Stack.Protected` guard and unmounts this screen in the same commit — so a note written
	 * after the call would be written by a component that is no longer on screen. See
	 * `lib/sign-out-intent.ts` and the three-part note in `(business)/account.tsx`.
	 *
	 * **The haptic is `light`, not `warning`.** This used to buzz the alarm on a session that
	 * ends and destroys nothing: the profile, the runs and the account are all still there, and
	 * the reader signs back in to the same board.
	 *
	 * **The promise is the panel's to handle.** `void signOut().finally(() => setSigningOut(false))`
	 * discarded a rejection: a failed sign-out left the reader on this screen with a spinner that
	 * had already stopped and no sentence anywhere. `SignOutSheet` takes the promise, and the
	 * `signingOut` state is gone with it — it lived on the button *behind* the panel, so its
	 * spinner was only ever visible after the sheet had closed.
	 */
	const confirmSignOut = () => {
		light();
		requestSignOutNavigation("authenticate");
		return signOut();
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
						saveRef={saveRef}
						onRequestReview={() => setReviewOpen(true)}
						onSignOut={() => setSignOutOpen(true)}
					/>
				</SignedIn>
			</Screen>

			{/*
			    The price of saving, asked before the write rather than explained after it.
			    `services/couriers.ts` returns any non-empty change to PENDING, so a verified
			    courier who fixes a typo loses the directory, the offers and their board — and
			    the toast still says "Perfil guardado". The gate is `VERIFIED` alone, decided in
			    the form: a REJECTED profile is already being asked for this save by its own
			    body copy, and a PENDING one has nothing to fall out of.

			    `primary` rather than this panel's `destructive` default: nothing is being
			    removed, the courier is choosing to accept a review — the same disclosure
			    `./delivery`'s location sheet draws.
			*/}
			<ConfirmSheet
				open={reviewOpen}
				onClose={() => setReviewOpen(false)}
				title={t("biz.courier.reviewReset.title")}
				body={t("biz.courier.reviewReset.body")}
				confirmLabel={t("biz.courier.reviewReset.confirm")}
				confirmVariant="primary"
				onConfirm={() => saveRef.current?.()}
			/>

			{/* Last in the screen's root and a sibling of the scroller: `./sheet` has no
		    portal, so inside the `Screen` it would scroll away with the content - the
		    placement `./account.tsx` documents for the identical sheet. And last of the two
		    panels, because `./sheet`'s own docblock says a later sibling paints over an
		    earlier overlay. */}
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
		</View>
	);
}

/** The stored profile, in the shape `dirty` compares against and availability sends. */
type StoredSnapshot = {
	displayName: string;
	serviceArea: string;
	bio: string;
	vehicleName: string;
	vehiclePlate: string;
	vehiclePhotoUrl: string | null;
	isAvailable: boolean;
};

function ProfileForm({
	saveRef,
	onRequestReview,
	onSignOut,
}: {
	/** Where `./confirm-sheet`'s answer lands. See the note on the ref above. */
	saveRef: React.RefObject<(() => void) | null>;
	onRequestReview: () => void;
	onSignOut: () => void;
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
	const initial = useRef<StoredSnapshot | null>(null);
	/**
	 * The values as they were *sent*, and the only thing `initial.current` is allowed to become
	 * after a save. The fields stay editable while the mutation is in flight, so re-reading
	 * them when the answer lands would move the baseline past a write the server has not
	 * finished — and the next real edit would then look like no edit at all. The same reason
	 * `./profile.tsx` captures `requestedEmail` before the mutate.
	 */
	const sentSnapshot = useRef<StoredSnapshot | null>(null);

	useEffect(() => {
		// **Both reads have to have settled; neither has to have succeeded.**
		//
		// The guard used to wait for `users.me` to be *present*, because `displayName` falls back
		// to the account's own name — and a failed account read was therefore allowed to take the
		// whole screen with it, including the three doors to `/profile`, `/change-password` and
		// sign out, which are the only way to reach any of them from this tree.
		//
		// Waiting for `couriers.profile` to be *present* is the mirror of that mistake and it
		// strands the main path onto this screen: `myProfile` answers `null` for a courier who has
		// never opened the form, which is who `/delivery`'s empty state sends here. No row means
		// no snapshot means `dirty` is permanently false means a permanently dimmed Guardar on a
		// courier who has just typed their first profile.
		if (initialized.current) return;
		if (profile.isPending || me.isPending) return;
		initialized.current = true;
		const snapshot = {
			displayName: profile.data?.displayName || me.data?.name || "",
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
	}, [me.data, me.isPending, profile.data, profile.isPending]);

	const save = useMutation(
		trpc.couriers.saveProfile.mutationOptions({
			onSuccess: async () => {
				toast.show(t("biz.courier.saved"));
				// The baseline moves with the write. It used to be written once by the effect
				// above and never again, so `dirty` was true for the rest of the session and every
				// press after the first wrote the same row again — and the second write is the one
				// that would have preserved the verification the first one cost.
				if (sentSnapshot.current) initial.current = sentSnapshot.current;
				await cache.invalidateQueries({
					queryKey: trpc.couriers.pathKey(),
				});
			},
		}),
	);

	/**
	 * Availability, written the moment it is chosen.
	 *
	 * `isAvailable` is the field every business filters the pool on — `services/deliveries.ts`
	 * asks for `VERIFIED AND isAvailable` in three places — so it is the one field on this screen
	 * a courier reaches for at the moment they stop working. As a row in the saved form it was a
	 * claim about the future: the control moved, and the courier went offline only if they then
	 * scrolled to a button and pressed it.
	 *
	 * **The payload is the stored snapshot, never the form's.** `displayName` and `serviceArea`
	 * are required by `courierProfileInput` and `shortText` is `.min(1)`, so the write has to
	 * carry them — and carrying the *form's* values would quietly publish a half-typed bio or a
	 * retyped plate the reader never asked to save. Every field but the flag is therefore the
	 * value the server already holds, which also makes the server's own `meaningfulChange` false:
	 * toggling availability can never cost a verified courier their verification.
	 */
	const availability = useMutation(
		trpc.couriers.saveProfile.mutationOptions({
			onSuccess: async () => {
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
	const availabilityFailure = useApiFailure(availability.error);

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
	 * `AccessibilityPropsAndroid` with `@platform android` - so the live regions below are
	 * the whole of Android's announcement, and iOS, which ignores the prop, has to be
	 * told. One effect for the screen and not one per region: the upload, the availability
	 * write and the save are three mutations, so this is the place that decides which
	 * sentence is the one to say now, and a screen with something newer to say has stopped
	 * saying the older thing. Guarded by the platform rather than announced on both - the
	 * pairing `./error-state`, `./rollback-notice` and `app/settings.tsx` all use, because a
	 * sentence a live region has already spoken is not read twice, it is read as two.
	 */
	const announcement =
		photoFailure.message || availabilityFailure.message || failure.message;
	useEffect(() => {
		if (Platform.OS !== "ios" || !announcement) return;
		AccessibilityInfo.announceForAccessibility(announcement);
	}, [announcement]);

	/**
	 * The write, in one function, because the button and the review panel both reach it and two
	 * copies of a payload are two answers to "what is being saved".
	 */
	const submit = useCallback(() => {
		const values = {
			displayName: displayName.trim(),
			serviceArea: serviceArea.trim(),
			bio: bio.trim(),
			vehicleName: vehicleName.trim(),
			vehiclePlate: vehiclePlate.trim(),
		};
		// The stored flag, never the control's: availability is written the moment it is chosen,
		// so a form save must not carry the value the toggle has optimistically put on screen but
		// not yet landed.
		const flag = initial.current?.isAvailable ?? isAvailable;

		sentSnapshot.current = { ...values, vehiclePhotoUrl, isAvailable: flag };
		save.mutate({
			...values,
			bio: values.bio || undefined,
			vehicleName: values.vehicleName || undefined,
			vehiclePlate: values.vehiclePlate || undefined,
			// `undefined` clears: the server reads an absent key as "no photo", so the state is
			// handed over whole, never dropped from the payload.
			vehiclePhotoUrl: vehiclePhotoUrl ?? undefined,
			isAvailable: flag,
		});
	}, [
		bio,
		displayName,
		isAvailable,
		save,
		serviceArea,
		vehicleName,
		vehiclePhotoUrl,
		vehiclePlate,
	]);

	/**
	 * A toggle's own write, and the two answers that make the optimistic flip honest: the control
	 * says what the reader chose the instant they chose it, and says what the server holds again
	 * if the server refuses. `./segmented` owns the haptic and the no-op on a re-tap, so there is
	 * no second one here.
	 *
	 * **The baseline moves on success, and that is not bookkeeping.** `dirty` compares
	 * `isAvailable` against `initial.current`, so leaving the old flag in the baseline would light
	 * Guardar up for a change that has already been written — and pressing it would then cost the
	 * courier the re-review the toggle itself was careful not to cause. The rollback target is the
	 * snapshot captured at the tap rather than the one read on the way out, because a form save
	 * that landed in between carries the same flag forward anyway.
	 */
	const setAvailability = useCallback(
		(next: boolean) => {
			const stored = initial.current;
			if (!stored) return;
			setIsAvailable(next);
			availability.mutate(
				{
					displayName: stored.displayName,
					serviceArea: stored.serviceArea,
					bio: stored.bio || undefined,
					vehicleName: stored.vehicleName || undefined,
					vehiclePlate: stored.vehiclePlate || undefined,
					vehiclePhotoUrl: stored.vehiclePhotoUrl ?? undefined,
					isAvailable: next,
				},
				{
					onSuccess: () => {
						initial.current = { ...stored, isAvailable: next };
					},
					onError: () => setIsAvailable(stored.isAvailable),
				},
			);
		},
		[availability],
	);

	useEffect(() => {
		saveRef.current = submit;
		return () => {
			saveRef.current = null;
		};
	}, [saveRef, submit]);

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
	// `me.isError` deliberately does not return. It used to, and a failed avatar read cost this
	// courier the whole screen: the form, the directory preview and the three doors at the foot —
	// the only way out of this tree to `/profile`, `/change-password` and sign out. The refusal is
	// drawn in its own slot further down instead, which is where `app/account.tsx` puts the same
	// failure.

	const nameError =
		submitted && !displayName.trim() ? t("form.required") : null;
	const areaError =
		submitted && !serviceArea.trim() ? t("form.required") : null;
	// The session alone, where this used to also want `me.data`: the write needs nothing from the
	// account read, and a courier creating their profile for the first time has no
	// `couriers.profile` row either, so requiring either one left a reader with no save button.
	const ready = status === "signed-in";
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

	// What a save is about to cost. `services/couriers.ts` returns any non-empty change to
	// PENDING, and a courier who is not VERIFIED has nothing to fall out of — a REJECTED profile
	// is being sent for review by `biz.courier.rejected.body`, and a PENDING one is already
	// waiting. So the question is asked in exactly the one case where the answer costs something.
	const reverify = statusValue === "VERIFIED" && dirty;

	/**
	 * Whether a toggle can write at all. `courierProfileInput` requires `displayName` and
	 * `serviceArea` and `shortText` is `.min(1)`, so a courier whose stored snapshot is missing
	 * either one has no legal payload — which is every courier who has never completed a first
	 * save. Disabled rather than hidden: the control is the answer to "how do I stop taking work",
	 * and it is still true that they cannot answer it yet.
	 */
	const canSetAvailability =
		baseline != null &&
		baseline.displayName.trim().length > 0 &&
		baseline.serviceArea.trim().length > 0;

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

			{/* The account read, refused in the slot where it would have drawn. The avatar, the
			    email and the `displayName` fallback are gone; the fields below are not, because
			    they come from `couriers.profile`. */}
			{me.isError ? (
				<ErrorState error={me.error} onRetry={() => me.refetch()} />
			) : null}

			{/*
			    Availability, first and above the form.

			    It is the one field here a courier reaches for at the moment they stop working,
			    and `services/deliveries.ts` asks for `VERIFIED AND isAvailable` to put somebody in
			    the offers pool — so as a row in the saved form it was a claim about the future: the
			    control moved and the courier went offline only if they then scrolled down and
			    pressed Guardar. `./segmented` rather than a `./field`-shaped control because it is
			    a closed set of two that changes a fact about you rather than a value you are
			    typing, and it announces itself as a radio group with `accessibilityState.checked`.
			*/}
			<ScreenSection
				title={t("biz.courier.availability")}
				subtitle={t("biz.courier.availability.help")}
			>
				<Segmented
					label={t("biz.courier.availability")}
					value={isAvailable ? "available" : "unavailable"}
					options={[
						{
							value: "available",
							label: t("biz.courier.available"),
						},
						{
							value: "unavailable",
							label: t("biz.courier.unavailable"),
						},
					]}
					disabled={!canSetAvailability || availability.isPending}
					onChange={(next) => setAvailability(next === "available")}
				/>
				{/* The refusal sits under the control the reader is looking at, not in the line at
				    the foot of the form that belongs to the save button. */}
				{availabilityFailure.message ? (
					<Text
						tone="destructive"
						accessibilityRole="alert"
						accessibilityLiveRegion="assertive"
					>
						{availabilityFailure.message}
					</Text>
				) : null}
			</ScreenSection>

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

			{/*
			    The identity a business reads, and what saving it costs. The subtitle is on both
			    this section and the vehicle one because `services/couriers.ts` treats all six of
			    these fields the same way — any non-empty change returns the row to PENDING, so a
			    verified courier leaves the directory and the offers pool — and a sentence under
			    one section and not the other would be a claim that editing the plate is free.
			*/}
			<ScreenSection
				title={t("biz.courier.profile")}
				subtitle={t("biz.courier.reviewReset.help")}
			>
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
			    The vehicle a run happens in: name, plate, and a picture.

			    It used to sit between the profile and availability because a business reviews it
			    with the profile — "a changed plate sends the row back to PENDING
			    (`services/couriers.ts`)" — and that sentence named one field of six and was the
			    reason the consequence went unmentioned for so long. `services/couriers.ts:116-126`
			    computes `meaningfulChange` over `displayName`, `serviceArea`, `bio`,
			    `vehicleName`, `vehiclePlate` and `vehiclePhotoUrl`: all six return the row to
			    PENDING, so adding the photo this section asks for costs a verified courier their
			    verification exactly as much as retyping the plate does. The two still read as one
			    unit; the comment now says the true thing about both.
			*/}
			<ScreenSection
				title={t("biz.courier.vehicle")}
				subtitle={t("biz.courier.reviewReset.help")}
			>
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
					// picked, and the toast would say "saved" while losing it. And on the
					// availability write, for the same reason one field over: two
					// `saveProfile` calls at once would resolve `meaningfulChange` against
					// whichever landed first.
					disabled={
						save.isPending ||
						photoUpload.isPending ||
						availability.isPending ||
						!dirty
					}
					fullWidth
					onPress={() => {
						setSubmitted(true);
						if (!displayName.trim() || !serviceArea.trim()) return;
						// The question first, where there is something to lose. `./confirm-sheet`
						// closes and then acts in the same tap, so the write it releases is the one
						// the reader answered "yes" to — and the panel is a sibling of the frame,
						// which is the only reason it can be asked at all.
						if (reverify) {
							onRequestReview();
							return;
						}
						submit();
					}}
				/>
			) : null}

			{/*
			    The courier tree has no account tab and no hub row: without these doors on
			    this screen a courier cannot reach the account fields (`/profile` owns name,
			    phone and email), the password, or the session itself - all three are shared
			    root routes the delivery stack simply never links to. Sign out sits last and
			    quiet, the same weight `./account.tsx` gives it: the destructive answer lives
			    in the panel, not on the row that asks. It no longer carries its own busy state
			    either - `./sign-out-sheet` owns that, along with the refusal, which the old
			    `void signOut().finally(...)` threw away.
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
