import Ionicons from "@expo/vector-icons/Ionicons";
import {
	MAX_UPLOAD_BYTES,
	UPLOAD_MIME_TYPES,
	type UploadMimeType,
} from "@pymeshub/shared";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { useApiFailure } from "@/lib/api-error";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, media, radius, space, type, useTheme } from "@/theme";

import { Button } from "./button";
import { Image } from "./image";
import { Text } from "./text";

/**
 * A picture for a row: one from the gallery, or one taken with the camera.
 *
 * The two buttons are two buttons because they are two acts. "Agregar foto" as a single
 * control leaves the owner to discover which one the tap opened — and the discovery is the
 * moment they put the phone down. `action.uploadPhoto` and `action.takePhoto` say which,
 * before the tap.
 *
 * ## Where the bytes go
 *
 * `uploads.create` (`packages/trpc-api/src/services/uploads.ts`) is the only writer. It
 * takes base64 and a mime type, refuses anything that is not JPEG/PNG/WebP under
 * `MAX_UPLOAD_BYTES`, and answers with a root-relative `/files/:id` that `imageUrlSchema`
 * already accepts — so the caller stores that string on `imageUrl` (or `image`) and
 * `./image` draws it through `GET /files/:id` without knowing any of this happened.
 *
 * The pick is therefore two steps and the UI shows both: the picker's own `file://` cache
 * path is the preview while the mutation is in flight, and the path that lands in the
 * parent's state is the stored one. A preview that swapped to a blank box the moment the
 * network started would read as the picture having been lost.
 *
 * ## What is refused, and where the sentence is
 *
 * Type and size are checked *before* the round trip, on the base64 the picker just handed
 * back, because the API's refusal is a `ValidationError` carrying `biz.products.photo.rule`
 * and the same sentence can be said without paying for the upload. The button's own
 * `loading` is the progress; the reserved message row under the controls is where a refusal
 * lands, in the same slot `./field` reserves so validation never reflows the form.
 *
 * Camera permission is asked here and a refusal is `state.error.cameraDenied`, not
 * `state.error.inline`: the phone said no, we did not break, and the fix is in the phone's
 * settings. `warning()` fires on that refusal and on a failed write — the two cases where
 * the thumb was answered with nothing.
 */

type PhotoPickerProps = {
	label: string;
	/** The stored `/files/:id` (or a remote `https://…`). `null` is "no picture yet". */
	value: string | null;
	/** Receives the stored path, or `null` when the picture is removed. */
	onChange: (next: string | null) => void;
	/** A caller's own refusal (form validation). Wins over this component's. */
	error?: string | null;
	help?: string;
	/**
	 * The preview's corner, named by token. `md` is a product thumbnail; a profile
	 * picture is `full`, because the account card draws it as a circle and a preview
	 * that was a rounded square would be a picture of a different thing.
	 */
	radiusToken?: keyof typeof radius;
	/**
	 * The preview's box, when the thing being pictured is not a square thumbnail.
	 *
	 * `styles.preview` is `media.row` square because a product thumbnail is, and
	 * `./image` keeps that box whatever it is handed — so a shop's cover, which
	 * `components/business-card` draws as a 16:9 band across the top of the card,
	 * would be previewed as a square crop of a wide photograph. That is the same
	 * failure `radiusToken` names one line up: a preview of a different thing. The
	 * caller passes the box the picture will actually be drawn in, and nothing else
	 * about this control changes.
	 */
	previewStyle?: StyleProp<ViewStyle>;
	/** Drawn inside the preview when there is no picture — a letter, an icon. */
	children?: React.ReactNode;
	/**
	 * How the control is arranged: the column it has always been, or one wide media surface.
	 *
	 * `"compact"` is the default and is the column — a preview box, a label and the two
	 * controls stacked under it, which is right where the picture is a small part of a longer
	 * form (`app/profile`'s avatar, `app/(business)/shop-settings`'s logo). `"module"` is the
	 * commerce system's version: the media surface itself is the control, sized for the
	 * photograph rather than for a thumbnail, with its own empty state, its own sentence and
	 * the two acts side by side inside it.
	 *
	 * The two acts stay two acts in both layouts, and that is the reason this is a layout
	 * prop rather than a redesign — see the note at the top of this file. A single "Add photo"
	 * that does not say which picker it opens is the failure the two controls exist to prevent.
	 */
	layout?: "compact" | "module";
	/**
	 * The two acts' own labels, for `"module"`, where the buttons sit inside the surface and
	 * a generic "Upload photo" reads as the name of the whole block. Omitted they fall back to
	 * the shared `action.*` pair, so a caller that wants only the arrangement does not have to
	 * supply copy to get it.
	 */
	uploadLabel?: string;
	cameraLabel?: string;
};

/**
 * The media surface's height, exported for the same reason `./field`'s `SOFT_FIELD_HEIGHT`
 * is: a skeleton has to draw the box it stands in for, and a hand-typed number in that
 * skeleton is a number that drifts the first time the module is retuned.
 */
export const PHOTO_MODULE_HEIGHT = 190;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
	mediaTypes: ["images"],
	// A phone camera roll is a 12-megabyte PNG away from the ceiling on a good day.
	// 0.7 is the same quality `apps/web`'s avatar picker compresses to, and the size is
	// still checked below: a compression hint is not a guarantee and the row's
	// `sizeBytes` is measured from the decoded bytes, not from this number.
	quality: 0.7,
	base64: true,
	// One picture, and a square one: a product's photo is drawn as a thumbnail and a
	// storefront hero from the same file, and a landscape crop is the case where the two
	// disagree. Cropping is the owner's decision rather than ours — `allowsEditing` is the
	// system cropper and it is where that decision is made.
	allowsEditing: true,
	aspect: [1, 1],
};

export function PhotoPicker({
	label,
	value,
	onChange,
	error,
	help,
	radiusToken = "md",
	previewStyle,
	children,
	layout = "compact",
	uploadLabel,
	cameraLabel,
}: PhotoPickerProps) {
	const { t } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();

	// The picker's own cache path, shown while the mutation is in flight. Cleared the
	// moment the stored path lands, so the two never draw at once.
	const [pendingUri, setPendingUri] = useState<string | null>(null);
	// Which button is in flight, so only that one shows the spinner. Two `loading`
	// buttons beside each other is two things to look at for one write.
	const [source, setSource] = useState<"gallery" | "camera" | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);

	const create = useMutation(trpc.uploads.create.mutationOptions());
	const failure = useApiFailure(create.error);
	const busy = create.isPending;

	// Four sources, in order, and each one is the right sentence for what it knows.
	// The caller's form validation wins: if the form says the picture is wrong, that is
	// the sentence under the box — a second one from this component would be a stack.
	// `localError` is this component's own refusals (type, size, camera permission).
	// `failure.message` is what the API resolved out of a domain error's key. The last
	// is for a write that produced no sentence at all — a dropped connection — and it is
	// last so it can never cover one that did.
	const shownError =
		error ??
		localError ??
		(failure.message || null) ??
		(create.isError ? t("state.error.inline") : null);

	const pick = async (
		kind: "gallery" | "camera",
		launch: () => Promise<ImagePicker.ImagePickerResult>,
	) => {
		if (busy) return;
		setLocalError(null);
		const needsCamera = kind === "camera";

		if (needsCamera) {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				warning();
				setLocalError(t("state.error.cameraDenied"));
				return;
			}
		}

		const result = await launch();
		if (result.canceled) return;
		const asset = result.assets[0];
		if (!asset?.base64) {
			warning();
			setLocalError(t("biz.products.photo.rule"));
			return;
		}

		const mimeType = acceptedMime(asset.mimeType);
		if (base64Bytes(asset.base64) > MAX_UPLOAD_BYTES) {
			warning();
			setLocalError(t("biz.products.photo.rule"));
			return;
		}

		// The picker settling on a picture: `selection()` answers the tap that chose it,
		// the same rule as a category row stepping to a value.
		selection();
		setSource(kind);
		setPendingUri(asset.uri);

		try {
			const created = await create.mutateAsync({
				mimeType,
				base64: asset.base64,
			});
			setPendingUri(null);
			onChange(created.path);
		} catch {
			// `create.error` is set by the mutation and `useApiFailure` resolves its
			// sentence on the next render. Nothing is written to `localError` here so a
			// domain refusal's own key can win — only a write with no sentence at all
			// falls through to `state.error.inline` above.
			warning();
			setPendingUri(null);
		} finally {
			setSource(null);
		}
	};

	const removePhoto = () => {
		selection();
		setPendingUri(null);
		setLocalError(null);
		onChange(null);
	};

	const fromGallery = (
		<Button
			label={uploadLabel ?? t("action.uploadPhoto")}
			onPress={() =>
				void pick("gallery", () =>
					ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS),
				)
			}
			variant="secondary"
			size="sm"
			fullWidth
			loading={busy && source === "gallery"}
			disabled={busy}
			icon={
				<Ionicons
					name="image-outline"
					size={icon.control}
					color={colors.secondaryForeground}
				/>
			}
		/>
	);
	const fromCamera = (
		<Button
			label={cameraLabel ?? t("action.takePhoto")}
			onPress={() =>
				void pick("camera", () => ImagePicker.launchCameraAsync(PICKER_OPTIONS))
			}
			variant="secondary"
			size="sm"
			fullWidth
			loading={busy && source === "camera"}
			disabled={busy}
			icon={
				<Ionicons
					name="camera-outline"
					size={icon.control}
					color={colors.secondaryForeground}
				/>
			}
		/>
	);
	const remove = value ? (
		<Button
			label={t("action.removePhoto")}
			onPress={removePhoto}
			variant="ghost"
			size="sm"
			fullWidth
			disabled={busy}
			icon={
				<Ionicons
					name="close-outline"
					size={icon.control}
					color={colors.foreground}
				/>
			}
		/>
	) : null;

	// Reserved exactly as `./field` reserves its message row: one `caption` line whether or
	// not anything is in it, so a refusal never reflows the form. Error wins over help, for
	// the same reason.
	//
	// `module` suppresses the help here, because in that layout the surface already draws
	// it inside itself and printing it again underneath is the same sentence twice. The
	// reserved row stays in both layouts — the *error* still needs a slot that exists before
	// it is needed, or a refused upload reflows the form under the thumb.
	const message = (
		<View style={styles.message}>
			{shownError ? (
				<Text
					variant="caption"
					tone="destructive"
					accessibilityRole="alert"
					accessibilityLiveRegion="polite"
				>
					{shownError}
				</Text>
			) : help && layout !== "module" ? (
				<Text variant="caption" tone="muted">
					{help}
				</Text>
			) : null}
		</View>
	);

	if (layout === "module") {
		const uri = pendingUri ?? value;
		return (
			<View style={styles.wrap}>
				<View
					style={[
						styles.module,
						{ backgroundColor: colors.muted, borderColor: colors.border },
					]}
				>
					{uri ? (
						<Image
							uri={uri}
							radiusToken="lg"
							style={styles.moduleImage}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					) : (
						<View style={styles.moduleEmpty}>
							{/* The mark and the badge, and the badge is the only lime on this
							    control: it is the one thing here that is an affordance rather
							    than a label, and `./theme` reserves the brand fill for the
							    moment's one action. */}
							<View style={styles.moduleMark}>
								<Ionicons
									name="image-outline"
									size={36}
									color={colors.foreground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
								<View
									style={[
										styles.moduleBadge,
										{ backgroundColor: colors.primary },
									]}
								>
									<Ionicons
										name="add"
										size={14}
										color={colors.primaryForeground}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								</View>
							</View>
							<Text bold style={styles.moduleTitle}>
								{label}
							</Text>
							{help ? (
								<Text variant="caption" tone="muted" style={styles.moduleHelp}>
									{help}
								</Text>
							) : null}
						</View>
					)}
					<View style={styles.moduleActions}>
						{fromGallery}
						{fromCamera}
					</View>
					{remove ? <View style={styles.moduleRemove}>{remove}</View> : null}
				</View>
				{message}
			</View>
		);
	}

	return (
		<View style={styles.wrap}>
			<Image
				uri={pendingUri ?? value}
				radiusToken={radiusToken}
				style={[styles.preview, previewStyle]}
				accessibilityElementsHidden
				importantForAccessibility="no"
			>
				{children}
			</Image>

			<View style={styles.controls}>
				<Text variant="label" bold>
					{label}
				</Text>
				{fromGallery}
				{fromCamera}
				{remove}
			</View>

			{message}
		</View>
	);
}

/**
 * The mime type to store.
 *
 * The picker's `mimeType` is best-effort and iOS is happy to report `image/heic` for a
 * photo it is about to hand back as JPEG base64 — the type docs say the `base64` field is
 * "the selected image's JPEG data" — so anything outside the allow-list is stored as
 * `image/jpeg` rather than refused for a label the bytes do not carry. A reported type that
 * *is* in the list is kept as-is: a PNG selected from the library is PNG data.
 */
function acceptedMime(reported: string | undefined): UploadMimeType {
	const match = UPLOAD_MIME_TYPES.find((one) => one === reported);
	// iOS HEIC and anything else unlabelled becomes the JPEG the base64 actually is.
	return match ?? "image/jpeg";
}

/**
 * The decoded size of a base64 string, from its length.
 *
 * Close enough to refuse on and deliberately not a decode: the API measures the real bytes
 * after `atob`, and this is only the pre-flight that saves a 2 MiB upload from being sent
 * to be refused. Padding is subtracted so a file that is exactly at the ceiling is not
 * rejected by rounding.
 */
function base64Bytes(value: string): number {
	const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
	return Math.floor((value.length * 3) / 4) - padding;
}

const styles = StyleSheet.create({
	// The same three-row shape `./field` has (label, box, message) and the same reason:
	// the message slot exists whether or not it has anything in it.
	wrap: { gap: space.sm },
	// A column, not `product-form`'s old thumb-beside-a-URL-box row. A picker has three
	// controls, and two full-width `sm` buttons read better stacked under the picture they
	// change than crammed beside it — the thumb is `media.row` because that is the size
	// the menu row will draw, which is the number worth previewing at.
	//
	// The height is an `aspectRatio` rather than a second number, so `previewStyle` can
	// change the *shape* by changing one ratio and one width: a caller that overrode a
	// hard-coded `height` would have to know to write `height: undefined` to let the
	// ratio compute it, and a style that has to be cancelled to be used is not a prop.
	preview: {
		width: media.row,
		aspectRatio: 1,
	},
	controls: { gap: space.sm },
	message: { minHeight: type.caption.lineHeight },
	/**
	 * The media surface, at the height the interface spec measures for it. `overflow: "hidden"`
	 * is load-bearing rather than tidy: it is what lets a chosen photograph fill the whole
	 * surface and still be clipped by the surface's own corner, instead of needing its radius
	 * recomputed every time the module's is.
	 */
	module: {
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	moduleImage: { width: "100%", aspectRatio: 4 / 3 },
	moduleEmpty: {
		height: PHOTO_MODULE_HEIGHT,
		alignItems: "center",
		gap: space.xs,
		paddingHorizontal: space.lg,
		paddingTop: space.xxl,
		paddingBottom: space.lg,
	},
	// The mark, with the badge hung off its own trailing foot rather than centred beside it,
	// so the two read as one object instead of two.
	moduleMark: { marginBottom: space.sm },
	moduleBadge: {
		position: "absolute",
		right: -10,
		bottom: -6,
		width: 24,
		height: 24,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	moduleTitle: { textAlign: "center" },
	moduleHelp: { textAlign: "center" },
	// The two acts share the module's width rather than stacking, which is the only reason
	// `layout` is a prop and not a second component: same two controls, same two states, a
	// different arrangement of them.
	moduleActions: {
		flexDirection: "row",
		gap: space.sm,
		paddingHorizontal: space.lg,
		paddingBottom: space.lg,
	},
	moduleRemove: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
