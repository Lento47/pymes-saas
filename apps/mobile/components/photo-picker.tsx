import Ionicons from "@expo/vector-icons/Ionicons";
import {
	MAX_UPLOAD_BYTES,
	UPLOAD_MIME_TYPES,
	type UploadMimeType,
	type UploadPurpose,
} from "@pymeshub/shared";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
	Modal,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";

import { useApiFailure } from "@/lib/api-error";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/reduced-motion";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	radius,
	space,
	type,
	useTheme,
} from "@/theme";

import { Button } from "./button";
import { Image } from "./image";
import { Pressable } from "./pressable";
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
	 * How the control is arranged: a column of preview and buttons, one wide media
	 * surface, or the picture alone with the two acts behind a tap.
	 *
	 * `"compact"` is the default and is the column — a preview box, a label and the two
	 * controls stacked under it, which is right where the picture is a small part of a longer
	 * form (`app/profile`'s avatar, `app/(business)/product-form`'s photo). `"module"` is the
	 * commerce system's version: the media surface itself is the control, sized for the
	 * photograph rather than for a thumbnail, with its own empty state, its own sentence and
	 * the two acts side by side inside it.
	 *
	 * **`"tap"` is for a block that is already a composition.** A shop's brand is one thing
	 * made of a portada and a logo, drawn as a card; giving each half its own two stacked
	 * buttons put four buttons and four labels under two pictures, and the buttons were the
	 * loudest thing in a block whose whole job is to show a photograph. So the picture is the
	 * control: press it, and the two acts arrive in a sheet. The picture still grows and the
	 * message row still exists — what `"tap"` removes is only the duplicated chrome.
	 *
	 * The two acts stay two acts in every layout, and that is the reason this is a layout
	 * prop rather than a redesign — see the note at the top of this file. A single "Add photo"
	 * that does not say which picker it opens is the failure the two controls exist to prevent.
	 */
	layout?: "compact" | "module" | "tap";
	/**
	 * The two acts' own labels, for `"module"`, where the buttons sit inside the surface and
	 * a generic "Upload photo" reads as the name of the whole block. Omitted they fall back to
	 * the shared `action.*` pair, so a caller that wants only the arrangement does not have to
	 * supply copy to get it.
	 */
	uploadLabel?: string;
	cameraLabel?: string;
	/**
	 * Crop ratio for the system editor. Product thumbnails are square; a
	 * promotion banner is 16:9.
	 */
	aspect?: [number, number];
	/**
	 * The tenant this picture counts against, when it belongs to one. Omitted for
	 * avatars and courier vehicle photos, which no plan counts — the upload then
	 * behaves exactly as it always did.
	 */
	businessId?: string;
	/** What the picture is for. Stored, so the bytes stay attributable. */
	purpose?: UploadPurpose;
	/**
	 * This control is on a screen the caller cannot edit — a MANAGER's read-only
	 * view of an OWNER's settings, say.
	 *
	 * A separate prop rather than "pass no `onChange`", because a picker with no
	 * callback still shows three live buttons, and a reader who taps "Take photo"
	 * and gets no picker at all has been told something false. It locks all three:
	 * both picks and the remove, since removing a logo is as much a write as
	 * choosing one.
	 *
	 * Distinct from `busy`, which is this component's own upload in flight — the
	 * two are added together internally, so a caller only ever states one.
	 */
	disabled?: boolean;
};

/**
 * The media surface's height, exported for the same reason `./field`'s `SOFT_FIELD_HEIGHT`
 * is: a skeleton has to draw the box it stands in for, and a hand-typed number in that
 * skeleton is a number that drifts the first time the module is retuned.
 */
export const PHOTO_MODULE_HEIGHT = 190;

/**
 * `"tap"`'s badge glyph.
 *
 * `icon.action` and not a number typed here: this badge *is* the affordance on a
 * block that has no other one, so it is sized like the app's other action glyphs
 * rather than like a decoration. A badge smaller than the `moduleMark` it replaces
 * reads as a demotion from a control to a hint.
 */
/**
 * `"tap"`'s empty-state glyph: 36, the same mark `module`'s `moduleMark` uses.
 *
 * Named rather than the badge's size, and *different* on purpose: the mark that
 * stands for "there is no picture yet" is the empty state's whole content and can
 * be large, while the pencil that labels "there is a picture, press to change it"
 * is an annotation and has to stay small enough not to cover the photograph.
 */
const TAP_EMPTY_MARK = 36;

/**
 * The acts dialog's two measures.
 *
 * `ACTS_DISC` is `merchant-shortcut-rail`'s own 64 rather than a new number: these
 * tiles are that component's tile, at the size it already uses, and a dialog with
 * slightly smaller discs would read as a different control than the destination
 * tiles two screens away.
 *
 * `ACTS_MAX_WIDTH` is 340 — roughly a form's own measure. Without a ceiling this
 * card is a pair of discs at opposite ends of a landscape phone, which is a dialog
 * asking to be looked at rather than one being got out of the way.
 */
const ACTS_DISC = 64;
const ACTS_MAX_WIDTH = 340;

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
	aspect = [1, 1],
	businessId,
	purpose,
	disabled = false,
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
	/**
	 * `"tap"`'s sheet. Local rather than lifted, for the reason the two-act sheet in
	 * `business-hours` keeps its own: the sheet is a property of *this* control, and two
	 * pickers on one screen must be able to have their sheet open independently — which
	 * is also why the parent's state is not involved. Held open by `locked` never: a
	 * lock that arrives mid-tap is the upload's own, and the sheet is already closing.
	 */
	const [actsOpen, setActsOpen] = useState(false);

	const create = useMutation(trpc.uploads.create.mutationOptions());
	const failure = useApiFailure(create.error);
	const busy = create.isPending;
	/**
	 * One flag for every control here. `busy` is this component's own write in
	 * flight and `disabled` is the caller's read-only screen, and the buttons want
	 * the same answer to both — so they are added once rather than at each of the
	 * three buttons, which is how one of them ends up live during a lock.
	 */
	const locked = busy || disabled;

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
		if (locked) return;
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
				...(businessId ? { businessId } : {}),
				...(purpose ? { purpose } : {}),
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
		if (locked) return;
		selection();
		setPendingUri(null);
		setLocalError(null);
		onChange(null);
	};

	const pickerOptions: ImagePicker.ImagePickerOptions = {
		...PICKER_OPTIONS,
		aspect,
	};

	const fromGallery = (
		<Button
			label={uploadLabel ?? t("action.uploadPhoto")}
			onPress={() =>
				void pick("gallery", () =>
					ImagePicker.launchImageLibraryAsync(pickerOptions),
				)
			}
			variant="secondary"
			size="sm"
			fullWidth
			loading={busy && source === "gallery"}
			disabled={locked}
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
				void pick("camera", () => ImagePicker.launchCameraAsync(pickerOptions))
			}
			variant="secondary"
			size="sm"
			fullWidth
			loading={busy && source === "camera"}
			disabled={locked}
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
			disabled={locked}
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

	if (layout === "tap") {
		const uri = pendingUri ?? value;
		return (
			<View style={styles.wrap}>
				<Pressable
					onPress={() => setActsOpen(true)}
					disabled={locked}
					accessibilityRole="button"
					accessibilityLabel={
						uri ? `${label}: ${t("action.changePhoto")}` : label
					}
					accessibilityHint={t("action.uploadPhotoHelp")}
					style={styles.tapTarget}
				>
					<Image
						uri={uri}
						radiusToken={radiusToken}
						style={[
							styles.preview,
							previewStyle,
							// The pressed wash, so the tap has an answer before the sheet
							// arrives. `colors.muted` is the app's own pressed surface rather
							// than a new token for one control.
							{ backgroundColor: colors.muted },
						]}
					>
						{children}
					</Image>
					{/* **What is drawn over the picture is chosen by whether
					    there is a picture**, and both halves earn it. With one,
					    the mark is a small pencil in the *corner*: it labels
					    something that is already showing, so it stays out of the
					    middle where it would cover the photograph it annotates.
					    Without one, the centred glyph *is* the empty state —
					    the same mark and the same 36 points `module`'s
					    `moduleMark` uses, because an empty box with a caption
					    under it reads as a form field, and this is a picture
					    waiting for one.

					    `children` beats the empty glyph when a caller supplies
					    it: the logo passes the shop's initial, and an initial
					    with an image-placeholder printed on top of it is
					    neither. */}
					{uri ? (
						<View style={styles.tapCorner} pointerEvents="none">
							<Ionicons
								name="pencil-outline"
								size={icon.control}
								color={colors.mutedForeground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
					) : children ? null : (
						<View style={styles.tapBadge} pointerEvents="none">
							<Ionicons
								name="image-outline"
								size={TAP_EMPTY_MARK}
								color={colors.mutedForeground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
					)}
				</Pressable>

				<PhotoActs
					open={actsOpen}
					label={label}
					canRemove={!!value}
					busy={busy}
					onClose={() => setActsOpen(false)}
					onGallery={() =>
						pick("gallery", () =>
							ImagePicker.launchImageLibraryAsync(pickerOptions),
						)
					}
					onCamera={() =>
						pick("camera", () => ImagePicker.launchCameraAsync(pickerOptions))
					}
					onRemove={removePhoto}
				/>

				{message}
			</View>
		);
	}

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
							style={[
								styles.moduleImage,
								{ aspectRatio: aspect[0] / aspect[1] },
							]}
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
 * The two acts, as a centred dialog rather than a bottom sheet.
 *
 * ## Why not a sheet
 *
 * The first version of `"tap"` put these in `./sheet`, and it was wrong for the
 * block this layout exists for. A sheet is a surface for a *list*, and two choices
 * are not a list — what it produced was a panel with a title, a chevron on each
 * row, and a gap, dragging the eye up from the photograph the reader was looking
 * at when they tapped it. A sheet also says "there is more below", and there is
 * not: there are exactly two ways to get a photograph, and both fit in one glance.
 *
 * So the two acts are the surface. Two tiles side by side, glyph above word, the
 * same disc-and-word shape `merchant-shortcut-rail` uses for a destination — which
 * is what these are, two destinations, and reusing that shape is cheaper than
 * inventing a fourth one. The tiles are `flex: 1` so the pair is one object at any
 * phone width.
 *
 * ## What it costs to be this small
 *
 * The scrim is the palette's own `scrim`, not a black at some opacity: the token's
 * note is that a scrim's job is to make the page behind it recede, and in the dark
 * scheme `foreground` is near-white, so a dimmed `foreground` backdrop would be the
 * *bright* object in the frame. Remove is the only row that takes something away,
 * so it is last, it is quiet, and it only exists when there is something to remove —
 * a dialog offering "Remove photo" for a picture that is not there is a control
 * that cannot do its job.
 */
function PhotoActs({
	open,
	label,
	canRemove,
	busy,
	onClose,
	onGallery,
	onCamera,
	onRemove,
}: {
	open: boolean;
	/** Names the thing being changed, announced as the dialog's label. */
	label: string;
	canRemove: boolean;
	busy: boolean;
	onClose: () => void;
	onGallery: () => void;
	onCamera: () => void;
	onRemove: () => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const reducedMotion = useReducedMotion();

	return (
		<Modal
			visible={open}
			transparent
			animationType={reducedMotion ? "none" : "fade"}
			onRequestClose={onClose}
		>
			<Pressable
				style={[styles.scrim, { backgroundColor: scrimColor(colors.scrim) }]}
				onPress={onClose}
				accessibilityRole="button"
				accessibilityLabel={t("action.close")}
			/>
			<View style={styles.acts} pointerEvents="box-none">
				<View
					style={[
						styles.actsCard,
						{ backgroundColor: colors.card, borderColor: colors.border },
					]}
					accessible
					accessibilityRole="text"
					accessibilityLabel={label}
				>
					<View style={styles.actsRow}>
						<Pressable
							onPress={onGallery}
							disabled={busy}
							accessibilityRole="button"
							accessibilityLabel={t("action.uploadPhoto")}
							style={styles.actsTile}
						>
							<View
								style={[
									styles.actsDisc,
									{ backgroundColor: colors.muted, borderColor: colors.border },
								]}
							>
								<Ionicons
									name="image-outline"
									size={icon.back}
									color={colors.foreground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
							</View>
							<Text variant="caption" tone="muted" numberOfLines={1}>
								{t("action.uploadPhoto")}
							</Text>
						</Pressable>
						<Pressable
							onPress={onCamera}
							disabled={busy}
							accessibilityRole="button"
							accessibilityLabel={t("action.takePhoto")}
							style={styles.actsTile}
						>
							<View
								style={[
									styles.actsDisc,
									{ backgroundColor: colors.muted, borderColor: colors.border },
								]}
							>
								<Ionicons
									name="camera-outline"
									size={icon.back}
									color={colors.foreground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
							</View>
							<Text variant="caption" tone="muted" numberOfLines={1}>
								{t("action.takePhoto")}
							</Text>
						</Pressable>
					</View>

					{/* Cancel is always there, and it is the only always-there escape.
					    The scrim above is the second one, which is why it carries no
					    label of its own and why this row exists rather than relying on a
					    reader finding the dimmed page behind the card. */}
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel={t("action.cancel")}
						style={styles.actsCancel}
					>
						<Text variant="label" bold>
							{t("action.cancel")}
						</Text>
					</Pressable>

					{canRemove ? (
						<Pressable
							onPress={onRemove}
							disabled={busy}
							accessibilityRole="button"
							accessibilityLabel={t("action.removePhoto")}
							style={styles.actsCancel}
						>
							<Text variant="label" tone="destructive" bold>
								{t("action.removePhoto")}
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
		</Modal>
	);
}

/**
 * The scrim as an alpha over the palette's own `scrim` hex.
 *
 * `colors.scrim` is a *solid* colour — `#1f1915` in light, `#000000` in dark — and the
 * token's own note is that a scrim exists to make the page behind it recede. Painting
 * that hex across the window at full opacity does the opposite: it deletes the page,
 * and a dialog floating on nothing reads as a launch error rather than as a question
 * asked of the screen it covers.
 *
 * So the hex is kept and the *opacity* is applied. `SCrim_ALPHA` is 0.6 rather than
 * something heavier: the card has to be unmistakably the nearest object (it is the only
 * thing at full contrast), while the page behind it stays legible enough that the reader
 * can tell what they tapped. A heavier scrim hides the photograph they tapped, which is
 * the one thing this dialog is about.
 *
 * `rgba` is built from the token's own channels rather than typed as a literal, so a
 * palette change moves the scrim with it instead of leaving a `#00000059` behind.
 */
const SCRIM_ALPHA = 0.6;

function scrimColor(hex: string): string {
	const value = hex.replace("#", "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((one) => one + one)
					.join("")
			: value;
	if (full.length !== 6) return `${hex}59`;
	const red = Number.parseInt(full.slice(0, 2), 16);
	const green = Number.parseInt(full.slice(2, 4), 16);
	const blue = Number.parseInt(full.slice(4, 6), 16);
	if (!Number.isFinite(red + green + blue)) return `${hex}59`;
	return `rgba(${red}, ${green}, ${blue}, ${SCRIM_ALPHA})`;
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
 * after `atob`, and this is only the pre-flight that saves a 5 MiB upload from being sent
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
	/**
	 * `"tap"`'s target, and the box the badge is centred inside.
	 *
	 * No `minHeight` here: the picture inside it already carries the block's height,
	 * and a floor on the pressable would only matter when a caller passes an empty
	 * `previewStyle` — at which point the layout is wrong for a different reason and
	 * this would hide it. `overflow: "hidden"` is *not* set, so the badge escapes the
	 * circle's bounds rather than being clipped by it.
	 */
	tapTarget: { alignSelf: "flex-start" },
	tapBadge: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	/**
	 * The corner position for the "press to change" pencil.
	 *
	 * A separate style rather than the same absolute box with alignment switched,
	 * because the two marks are different objects at different scales in different
	 * places, and a `styles.tapBadge` that meant "centred" in one branch and
	 * "top-right" in the other would be a prop wearing a name.
	 */
	tapCorner: {
		position: "absolute",
		top: space.xs,
		right: space.xs,
	},
	/**
	 * The dialog's scrim, filling the window behind the card.
	 *
	 * `StyleSheet.absoluteFill` rather than a `flex: 1` sibling, because the card's own
	 * container is a centred overlay *on top* of this and neither can be a flex child of
	 * the other — the scrim is the page, the card floats on it. `flex: 1` on both in a
	 * row would put them side by side.
	 *
	 * The colour is **not** set here. It is `scrimColor()`, below, because `colors.scrim`
	 * is a solid hex and a solid hex over the whole window *erases* the page behind the
	 * dialog — the opposite of what a scrim is for. See that function for the alpha.
	 */
	scrim: { ...StyleSheet.absoluteFill },
	/**
	 * The card's centred container. `pointerEvents: "box-none"` is on the element in the
	 * JSX, not here: it has to be, because it is the difference between "taps on the
	 * dimmed page reach the scrim's close" and "they reach nothing".
	 */
	acts: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		padding: space.xl,
	},
	/**
	 * The card itself. `maxWidth` rather than a width, so on a tablet or a landscape
	 * phone the two tiles do not stretch into two enormous discs — this is a dialog
	 * about two choices, and its size should not depend on how much screen there is.
	 */
	actsCard: {
		width: "100%",
		maxWidth: ACTS_MAX_WIDTH,
		borderRadius: radius.xl,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
		padding: space.lg,
		gap: space.sm,
	},
	/** The two tiles, as one object. `flex: 1` each so the pair is symmetrical. */
	actsRow: { flexDirection: "row", gap: space.sm },
	/**
	 * A tile's column. `alignItems: "center"` because the word sits under the disc
	 * rather than beside it, which is `merchant-shortcut-rail`'s tile shape and the
	 * reason this reads as two destinations instead of two buttons.
	 */
	actsTile: {
		flex: 1,
		alignItems: "center",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	/** The disc, at `merchant-shortcut-rail`'s own 64. */
	actsDisc: {
		width: ACTS_DISC,
		height: ACTS_DISC,
		borderRadius: radius.lg,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	/**
	 * Cancel and remove share one row shape: a bare word, centred, no box.
	 *
	 * They are quiet on purpose. The two discs are the answer to the question the
	 * reader tapped with, and a filled button underneath them would compete with
	 * both for the same glance. Remove is `destructive` ink and cancel is plain,
	 * which is the whole difference between the two rows.
	 */
	actsCancel: {
		minHeight: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
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
	moduleImage: { width: "100%" },
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
