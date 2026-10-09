import Ionicons from "@expo/vector-icons/Ionicons";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Image,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
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
import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

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
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [reviewOpen, setReviewOpen] = useState(false);

	/**
	 * What "Guardar" does, wherever it is pressed from.
	 *
	 * Two surfaces now commit this form — the pinned bar at the foot of the screen and the
	 * review panel that can stand between the two — and they must be the *same* press. Two
	 * handlers would be two answers to "what does saving do", and the second is the one that
	 * goes stale. `./profile.tsx` reaches past its own frame for `ActionBar` the same way, by
	 * hoisting its whole form into a hook; this file does not, because its state carries the
	 * `sentSnapshot` ref and the availability rollback the re-review work depends on, and
	 * moving those is a far larger change than pinning a button.
	 */
	const saveRef = useRef<(() => void) | null>(null);

	/**
	 * What the pinned bar needs to draw itself: three booleans, published by the form.
	 *
	 * **Published, not pulled, and deliberately only booleans.** The alternative is hoisting
	 * fourteen pieces of form state up here for three flags' sake. A published *boolean* pair
	 * fires its effect only when a boolean crosses, so a courier typing does not re-render the
	 * frame once per keystroke — which a published string or object would.
	 */
	const [bar, setBar] = useState({ ready: false, dirty: false, saving: false });
	const publishBar = useCallback(
		(next: { ready: boolean; dirty: boolean; saving: boolean }) =>
			setBar((current) =>
				current.ready === next.ready &&
				current.dirty === next.dirty &&
				current.saving === next.saving
					? current
					: next,
			),
		[],
	);

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
				// **Not decoration.** This screen is on `DELIVERY_BARLESS_ROUTES`, so the courier
				// capsule does not draw here and this is the only visible way out of it. That is
				// the reason `tab-bar.ts` keeps the cart off its barless list — "a barless cart is
				// a screen with no way out" — and the reason `delivery/[id].tsx` pairs its own
				// `BackButton` with the same treatment. `./screen`'s `leading` slot is where a
				// back control belongs: a leading control is part of the heading, not the first
				// thing in the body.
				leading={<BackButton to="/delivery" />}
				scroll
				keyboardInsets
				/**
				 * **No `contentStyle`, and the doubled gap it used to declare is gone with it.**
				 *
				 * `Screen`'s body wrapper takes this as a `View` style, and its only child here is
				 * `<SignedIn>` — one child, so `gap: space.lg` had nothing to separate and was
				 * inert. The gap that actually spaces this form is on `ProfileForm`'s own root
				 * `View`, which is where the sections are. Declaring it in both places read as
				 * "twice the spacing" and was neither twice the spacing nor a bug anyone could
				 * see; it was two declarations of one gutter with the outer one unreachable.
				 */
				/**
				 * Pull to refresh, and only `couriers.profile`.
				 *
				 * **The status on this screen is decided by somebody else.** A courier's
				 * verification moves when the platform reviews it, and until now the only way to
				 * see that had changed was to leave the screen and come back — so an approved
				 * courier kept reading "Revisión pendiente" until they navigated away.
				 *
				 * `users.me` is deliberately not invalidated: nothing here changed on the account,
				 * and the avatar is the one thing a refresh cannot improve without a round trip.
				 */
				onRefresh={() => {
					void cache.invalidateQueries({
						queryKey: trpc.couriers.pathKey(),
					});
				}}
			>
				<SignedIn>
					<ProfileForm
						saveRef={saveRef}
						publishBar={publishBar}
						onRequestReview={() => setReviewOpen(true)}
					/>
				</SignedIn>
			</Screen>

			{/*
			    The save, pinned.

			    It was the last block inside the scroller, which made it the first thing to leave
			    the screen: a courier edits their bio, scrolls, and the control that commits the
			    edit is below the fold on a phone with the keyboard up. `./profile.tsx` moved its
			    identical action here for exactly that reason, and quotes the cost: "a floating
			    card would cover the field being typed in".

			    **Docked, and a sibling of `Screen`.** Sibling because `ActionBar` draws edge to
			    edge and pays its own bottom inset while `Screen` pads its body by `space.lg` — a
			    bar inside that body would be sixteen points in from each edge with a hairline
			    that stops short of both.

			    **No `useActionBarClearance`, and no `bottomInset` on `Screen`.** Both belong to a
			    *floating* bar. `action-bar.tsx:91`: "`docked` bars need none of this: it is the
			    footer of a form, and nothing scrolls under it" — and the four callers of that
			    hook are all floating screens. Adding one here would reserve `ACTION_BAR_CLEARANCE`,
			    ninety points, of dead air under the form. Paying the home indicator in both
			    places is the 34-point gap `./action-bar`'s docblock names.

			    **Drawn only when the form has entered.** A "Guardar" over a skeleton, over a
			    failure or over the signed-out sentence is a control for something that is not
			    there, and it is the one control on this screen that cannot be walked past. `ready`
			    is published by the form rather than read from the session here, because "the form
			    is on screen" and "someone is signed in" are different claims and only the first
			    one is the question.
			*/}
			{bar.ready ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.courier.save"),
						onPress: () => saveRef.current?.(),
						loading: bar.saving,
						// Dimmed on a pristine form: a save with nothing to write would only tell
						// the courier their profile is what it already was. The same gate the
						// inline button carried.
						disabled: bar.saving || !bar.dirty,
					}}
				/>
			) : null}

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
	publishBar,
	onRequestReview,
}: {
	/** Where the pinned bar and `./confirm-sheet`'s answer land. See the note on the ref. */
	saveRef: React.RefObject<(() => void) | null>;
	/**
	 * The three flags the pinned bar draws itself from.
	 *
	 * Published rather than pulled, and only booleans, so the effect fires when one *crosses*
	 * rather than on every keystroke. `ready` is deliberately here and not derived from the
	 * session above: "the form is on screen" is a stronger claim than "someone is signed in",
	 * and the bar must not draw over the skeleton or a failure.
	 */
	publishBar: (next: {
		ready: boolean;
		dirty: boolean;
		saving: boolean;
	}) => void;
	onRequestReview: () => void;
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

	const waiting = useSkeletonHold(
		status === "loading" || profile.isPending || me.isPending,
	);

	/**
	 * Everything the bar and the review question need, derived **above** the early returns.
	 *
	 * It has to be here. `pressSave` reads `dirty` and `reverify`, and it is a `useCallback`
	 * that the `saveRef` effect below installs — and a hook below a conditional `return` is the
	 * crash `rules-of-hooks` is named after. None of these values needs a settled read:
	 * `baseline` is a ref, `statusValue` is `undefined` until the profile lands, and every
	 * expression below already answers honestly for a form that is not on screen yet.
	 */
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

	/**
	 * One press, three outcomes: the fields are incomplete, the write would cost a review, or
	 * the write happens. Both surfaces that can commit this form go through here.
	 */
	const pressSave = useCallback(() => {
		setSubmitted(true);
		if (!displayName.trim() || !serviceArea.trim()) return;
		if (reverify) {
			onRequestReview();
			return;
		}
		submit();
	}, [displayName, onRequestReview, reverify, serviceArea, submit]);

	useEffect(() => {
		saveRef.current = pressSave;
		return () => {
			saveRef.current = null;
		};
	}, [saveRef, pressSave]);

	/**
	 * The bar's three flags, and what "busy" means here.
	 *
	 * **All three writes, not just the save.** A save racing a picture still in flight would
	 * store the profile without the photo the reader just picked; a save racing the
	 * availability toggle would resolve the server's `meaningfulChange` against whichever
	 * landed first. The bar is the screen's one commit control, so it waits for all three.
	 */
	const saving =
		save.isPending || photoUpload.isPending || availability.isPending;
	useEffect(() => {
		publishBar({
			ready: ready && !waiting && !profile.isError,
			dirty,
			saving,
		});
	}, [dirty, profile.isError, publishBar, ready, saving, waiting]);

	if (waiting) {
		return <CourierProfileSkeleton loadingLabel={t("state.loading")} />;
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

	return (
		<View style={styles.content}>
			<CourierStatusCard status={statusValue} />

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
			    The directory preview, and the gate on it moved.

			    It used to draw only once the profile was `VERIFIED`, which meant the courier who
			    most wanted to check it saw nothing: someone who has just filled the form is
			    `PENDING`, and "does this look right to a shop?" is the question they are actually
			    holding. The gate is now `profile.data` at all — a courier with no profile has
			    nothing to preview — and the card's `verified` prop carries the real status.

			    **`verified` is what makes that safe.** `./courier-directory-card` used to print
			    "Verificado por PymesHub" unconditionally, so lifting this gate without the prop
			    would have shown that sentence to a courier the platform has not approved.

			    Everything here is already on screen: `couriers.profile` for the name, area, bio
			    and availability, and `users.me` for the avatar — which is the same `user.image`
			    the pool entry reads, so this cannot drift from what a shop sees. No request, no
			    new shape.

			    `isMember` and `isInvited` are absent on purpose. They say whether *this* courier is
			    on *that* shop's roster, and there is no "that" here. The card takes the identity
			    half; the business screen supplies its own row as `action`.
			*/}
			{profile.data ? (
				<ScreenSection
					title={t("biz.courier.preview.title")}
					subtitle={
						statusValue === "VERIFIED"
							? t("biz.courier.preview.body")
							: t("biz.courier.preview.pending")
					}
				>
					<CourierDirectoryCard
						courier={{
							profileId: profile.data.id,
							displayName: profile.data.displayName,
							image: me.data?.image ?? null,
							serviceArea: profile.data.serviceArea,
							bio: profile.data.bio,
							isAvailable: profile.data.isAvailable,
						}}
						verified={statusValue === "VERIFIED"}
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

			{/*
			    The save used to live here, as the last block inside the scroller.

			    It cannot any more: the pinned bar is a sibling of `Screen` at the foot of the
			    screen, and a bar pinned over a scroller is a bar the reader has to scroll out
			    from under. `./profile.tsx` made the same move and quotes the cost — "a customer
			    edits their name, scrolls, and the control that commits the edit is below the fold
			    on a phone with the keyboard up". Its own note on `docked` is why the bar is flat
			    rather than a lifted card: a floating card covers the field being typed in.

			    The three guards this button carried are not lost, they moved. `dirty` is the bar's
			    `disabled`; the photo-upload and availability races are `saving` in
			    `publishBar`, so the bar waits for all three writes rather than one; and the
			    review question is `pressSave`, which the bar and `./confirm-sheet` share.
			*/}

			{/*
			    The three account doors are gone from here too, and `./_layout.tsx` is why both
			    removals could happen in one commit.

			    They moved to `(delivery)/account.tsx` — the second tab — as `ListRow`s with
			    chevrons and subtitles rather than `Button`s, under a name the courier can see
			    before tapping it. That hub also carries what this screen was the *only* way to
			    reach: Ajustes, Ayuda, Seguridad and the Bandeja, none of which the delivery tree
			    linked at all.

			    The password door is the one worth naming. Neither other hub has it — it lived
			    here alone, on a form, as the middle of three stacked buttons — so moving the
			    account without carrying it would have been a silent capability drop rather than a
			    visible one. It is a row in the hub now.
			*/}
		</View>
	);
}

/**
 * The courier's verification state, and the one thing this screen says first.
 *
 * ## Why it was rebuilt rather than restyled
 *
 * It drew all three states with identical chrome — a `Card`, a heading, a muted line — so
 * "Perfil no aprobado" was laid out exactly like "Perfil verificado". That matters more here than
 * anywhere else in the app: a `REJECTED` courier is the one state that degrades their whole role
 * (`lib/role.ts` resolves them as `customer` and unmounts the delivery tree), and it used to look
 * like the good news.
 *
 * ## A word and a glyph, not a colour
 *
 * `./list-row.tsx:52-58` states the rule the whole app works to: "colour is never the only signal,
 * and the cheapest way to obey it is to make the signal a word; a reader with a colour vision
 * deficiency, a greyscale screenshot and a screen reader all get the same answer from one string."
 * So each state carries an **icon** and a **word**, and the tint is a third signal on top rather
 * than the only one — a greyscale screenshot loses the tint and keeps the other two.
 *
 * The icons are `./status-badge`'s, reused deliberately: `time-outline` for a review in progress
 * and `checkmark-circle-outline` for an accepted one are the same two the order board already
 * draws for the same two meanings, and a courier learning this screen has already learned those.
 *
 * ## The `REJECTED` case names a next step
 *
 * `biz.courier.rejected.body` says "Actualiza tus datos y envíalos a revisión de nuevo" — an
 * instruction, and an instruction on a card is nowhere to press. This one says what to change and
 * points at the button that does it, because a rejection with no route out of it is the one state
 * that can strand a courier who has already lost their board.
 */
function CourierStatusCard({
	status,
}: {
	status: "VERIFIED" | "PENDING" | "REJECTED" | undefined;
}) {
	const { t } = useT();
	const { colors } = useTheme();

	const style =
		status === "VERIFIED"
			? VERIFIED_STATUS
			: status === "REJECTED"
				? REJECTED_STATUS
				: PENDING_STATUS;

	return (
		<Card style={styles.statusCard}>
			<View style={styles.statusHead}>
				<Ionicons
					name={style.icon}
					size={icon.control}
					color={colors[style.tint]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<Text variant="heading" bold>
					{status === "VERIFIED"
						? t("biz.courier.verified")
						: status === "REJECTED"
							? t("biz.courier.rejected")
							: t("biz.courier.reviewPending")}
				</Text>
			</View>
			<Text tone="muted">
				{status === "REJECTED"
					? t("biz.courier.rejected.next")
					: status === "VERIFIED"
						? t("biz.courier.directoryVerified")
						: t("biz.courier.reviewPending.body")}
			</Text>
			{/*
			    No action button here, and the reason is that there is nowhere for it to go.

			    `biz.courier.rejected.body` says "actualiza tus datos y envíalos a revisión de
			    nuevo", which is an instruction with no destination — the fields it means are the
			    ones four sections below this card, and the save that submits them is the pinned
			    bar. A "Editar" on a card whose edit targets are already on screen is a control
			    that scrolls, which is worse than the sentence: it looks like a step and is
			    really a nudge. So `rejected.next` names the step in words and the form carries it
			    out.
			*/}
		</Card>
	);
}

/**
 * What each state looks like, in one place so a fourth cannot half-arrive.
 *
 * **`PENDING` is the default rather than a third branch**, because it is what a courier with no
 * profile row at all reads: `couriers.profile` answers `null` for someone who has never opened
 * the form, and `statusValue` is `undefined` there. An undefined status is a courier waiting, not
 * a courier broken, and a card that said "error" for it would be the first wrong thing on the
 * screen they see.
 */
const PENDING_STATUS = {
	icon: "time-outline",
	tint: "statusPendingForeground",
} as const;

const VERIFIED_STATUS = {
	icon: "checkmark-circle-outline",
	tint: "success",
} as const;

const REJECTED_STATUS = {
	icon: "close-circle-outline",
	tint: "statusRejected",
} as const;

/**
 * The wait, in the shape the screen will actually have.
 *
 * ## What it used to be
 *
 * Three identical grey lines with no label and no role — against a screen that is a status card,
 * an availability control, five labelled inputs, a photo block two hundred points tall, a
 * two-segment control and a pinned bar. Two failures at once: **the layout jumped** because the
 * skeleton was not the layout standing in for itself, and **the load was silent** to a screen
 * reader, because nothing in those three lines was announced and nothing claimed to be a progress
 * indicator.
 *
 * ## How it is built
 *
 * **Text lines are composed with the reader's font scale.** `./profile.tsx`'s note on its own
 * skeleton is the reasoning: "a skeleton frozen at 100% metrics is eight points short of a real
 * row at 200%", so the wait reserves less than the content and the form grows under the reader's
 * fingers. `./skeletons`'s `line()` is the shared composition, not a copy of the arithmetic.
 *
 * **Control blocks are not composed**, and that is the same file's other half: they stand in for
 * inputs and buttons, so they keep the floor a control owns — `MIN_TOUCH_TARGET`. Scaling a
 * control would make the skeleton's own layout jump when the reader's text size changes.
 *
 * **Wrapped in a labelled `progressbar`**, as `(business)/account.tsx:219-241` does. One
 * announcement for the whole wait, and it says what is happening.
 */
function CourierProfileSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	const label = (variant: keyof typeof type) =>
		Math.round(type[variant].lineHeight * fontScale);

	return (
		<View
			style={styles.content}
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={loadingLabel}
		>
			{/* The status card: a heading's line and the sentence under it. */}
			<Card style={styles.statusCard}>
				<Skeleton style={{ width: "45%", height: label("heading") }} />
				<Skeleton style={{ width: "80%", height: label("body") }} />
			</Card>

			{/* Availability: the segment group's own height, so the control below does not move. */}
			<Skeleton style={{ height: MIN_TOUCH_TARGET + space.lg }} />

			{/* Three labelled inputs with their section headings. */}
			<Skeleton style={{ width: "35%", height: label("heading") }} />
			{[0, 1, 2].map((index) => (
				<View key={index} style={styles.skeletonField}>
					<Skeleton style={{ width: "30%", height: label("label") }} />
					<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
				</View>
			))}

			{/* The vehicle block: two inputs and the photo, at the height the photo draws. */}
			<Skeleton style={{ width: "35%", height: label("heading") }} />
			{[0, 1].map((index) => (
				<View key={index} style={styles.skeletonField}>
					<Skeleton style={{ width: "30%", height: label("label") }} />
					<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
				</View>
			))}
			<Skeleton style={styles.skeletonPhoto} />
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	statusCard: { gap: space.sm },
	statusHead: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	rows: { gap: space.sm },
	skeletonField: { gap: space.sm },
	// The photo's own box: `media`-less because `styles.photo` here is a full-width block whose
	// height is fixed at 200, and a skeleton at any other height is a second layout jump when the
	// real picture arrives.
	skeletonPhoto: { width: "100%", height: 200, borderRadius: radius.md },
	photoBlock: { gap: space.sm },
	photo: {
		width: "100%",
		height: 200,
		borderRadius: radius.md,
	},
});
