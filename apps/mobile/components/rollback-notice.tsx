import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import {
	AccessibilityInfo,
	Platform,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";

import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { icon, radius, space, type, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text, type TextVariant } from "./text";

/**
 * The sentence that says what went wrong, in the two shapes this app draws it.
 *
 * `docs/design-mobile.md` asks for two things when a write is rolled back: the change is
 * undone, *and* the customer is told why in the API's own sentence. This is the second
 * half — and this file is now the only place in the app that draws it. `./field`'s
 * validation line and the sheets, the cart and the delivery form all render through here,
 * which is the point: an announced error has exactly two ways to be wrong, a role with no
 * announcement behind it and an announcement nobody can find in the tree, and a screen
 * that hand-rolls its own pair is a screen that can have one of them and not the other.
 * That is what the audit found — `app/(customer)/cart.tsx`, `app/(business)/team.tsx` and
 * `app/business-delivery.tsx` each drew a `destructive` sentence with
 * `accessibilityRole="alert"` and nothing else, which is silent on Android *and* on iOS.
 *
 * ## The two shapes
 *
 * The **block** stands on its own: `colors.card`, a `destructive` hairline, the alert
 * glyph, one sentence. `./rollback-surface` floats it over a screen whose layout has no
 * room for it; the cart and the order screens draw it *in* the layout, under the
 * transaction it is about.
 *
 * The **line** (`inline`) is a sentence in somebody else's layout — a cart row's caption,
 * a validation line under the toggles, the last field of a sheet. There is no fill and no
 * glyph, because the block's job here is the sentence and not the surface: a bordered
 * rectangle nested inside the card that already holds the row would be two error surfaces
 * saying one thing. It is drawn at the step its caller's layout uses (`variant`, `body` by
 * default), because the layout that owns the line is what decides how big its sentences
 * are — a cart row's other captions, or the form's own body text.
 *
 * ## The sentence comes from the throw, or from the caller
 *
 * `error` is the usual input: the raw throw, read through `useApiFailure` so the same
 * 4xx-versus-5xx rule below applies everywhere.
 *
 * `message` is for the callers that already hold a sentence this component could not have
 * built from a throw — the API's own reason on a cart row that became unbuyable
 * (`unavailableReason`, which rides along with the cart rather than arriving as a failure),
 * or a validation check the screen makes before it sends anything. Those are sentences, not
 * failures, and re-deriving them from nothing would put the *choice of wording* back at the
 * call site, which is the one thing this file exists to stop.
 *
 * `undefined` is "no sentence given, derive one from the throw", which is why the test is
 * for `undefined` rather than for falsy: `null` and `""` are the caller saying "nothing to
 * show", and that renders nothing.
 *
 * ## Which sentences are the API's, and which are ours
 *
 * A 4xx message is the API talking to the customer: it was written deliberately, it says
 * something they can act on, and it is the truthful account of what happened. A 5xx
 * message, or a failure with no status at all (a dropped connection, a rejected fetch),
 * is a log line — "Internal server error", "Failed to fetch" — and those are ours to
 * replace with `state.error.body`. The rule is the status code, because it is the one
 * field that tells the two apart without parsing prose.
 *
 * ## The haptic is not here
 *
 * `warning()` is fired by the mutation that failed, at the moment it fails. A component
 * that buzzes on mount would buzz again on every re-render that remounted it, and a
 * haptic that arrives from a render path is a haptic nobody can reason about.
 *
 * The announcement is here, though, for the same reason the sentence is: this is the
 * component that knows when the sentence reached the screen. `accessibilityRole="alert"`
 * covers Android's live region; iOS announces nothing for a role alone, so the sentence
 * is read out explicitly on the change that produced it.
 *
 * ## iOS is the only platform the explicit call is for, and `Platform.OS` is what says so
 *
 * The two mechanisms are alternatives, not layers. Android reads the live region and speaks
 * the sentence when the view appears; calling `announceForAccessibility` as well speaks the
 * same sentence a second time, because TalkBack has already announced it once. The gate below
 * is therefore part of the rule above rather than a platform tweak — the sentence must be
 * announced exactly once per appearance on each platform, and only one of the two mechanisms
 * exists on each.
 *
 * `components/toast.tsx:201` and `components/error-state.tsx` carry the identical gate for the
 * identical reason. `app/business-delivery.tsx` used to carry a fourth hand-rolled copy of
 * this effect for its own refusal line; it is gone, because the line it announced is this
 * component's now. Three files that each announce a transient sentence is exactly the set
 * where one of them drifts, so the pattern is worth naming here: **on Android, the live
 * region announces; on iOS, the explicit call does.** A comment that claims this and a
 * `useEffect` that does it unconditionally is the shape this defect had — the prose was
 * right and the code was not.
 *
 * ## Politeness is the sentence's, and the shape does not decide it
 *
 * `politeness` is the live region's half of the question the two mechanisms above answer:
 * `polite` waits for whatever the reader is already hearing, `assertive` interrupts it. It is
 * a prop rather than a rule read off `inline`, because the two are genuinely independent — the
 * cart's in-layout block is `polite` while the cart's in-layout *line* is `assertive`, and
 * both are deliberate. The default is `polite`, the same `./toast` and `./error-state` use for
 * their sentences: a thing the reader has to know, said when they
 * are ready for it. `assertive` is for the sentences that are news about the control under
 * the reader's thumb — a row that just became unbuyable, a save that was refused — and it is
 * stated at the call site for that reason.
 *
 * Note that this is Android's half only. `announceForAccessibility` takes no urgency, so on
 * iOS the explicit call above is the same call either way; the prop narrows the platform that
 * has the distinction rather than pretending both do.
 */
export function RollbackNotice({
	error,
	message,
	inline = false,
	variant = "body",
	politeness = "polite",
	onDismiss,
	style,
}: {
	/** The throw, when there is one. The sentence is derived from it — see the docblock. */
	error?: unknown;
	/**
	 * A sentence already in hand, for a caller that has one and no throw — a cart row's
	 * `unavailableReason`, a validation check made before anything was sent.
	 *
	 * `undefined` derives from `error`; `null` or `""` renders nothing.
	 */
	message?: string | null;
	/**
	 * Draw a sentence in the caller's own layout instead of standing the block on its own.
	 *
	 * See "## The two shapes": no fill, no glyph, no floor — one line, at `variant`'s step.
	 */
	inline?: boolean;
	/**
	 * The step the sentence is drawn at. `body` unless the layout the line sits in says
	 * otherwise — the cart row's `caption`, beside that row's other captions.
	 */
	variant?: TextVariant;
	/**
	 * How Android reads it out: `polite` waits, `assertive` interrupts. See the docblock;
	 * `polite` is the app's default for a sentence, and `assertive` is stated where the
	 * sentence is news about the control the reader just used.
	 */
	politeness?: "polite" | "assertive";
	/**
	 * Make the notice its own dismiss control, for a surface that floats it over a screen.
	 *
	 * Omitted by every in-layout caller: the cart and the order screens draw this *in* a
	 * screen, where the notice belongs to the transaction under it and leaves when that
	 * transaction does — a tap on a receipt is nothing. The floated surface has no such
	 * owner, so its notice is the control that ends it, which is the same tap-to-dismiss
	 * `./toast` gives its own sentence. Meaningless on `inline`, which is a line of text.
	 */
	onDismiss?: () => void;
	/** Placement, for the one caller that floats the block. The block's own skin stays here. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const { failure, message: fromError } = useApiFailure(error);

	const deliberate =
		failure.httpStatus !== null &&
		failure.httpStatus < 500 &&
		failure.serverMessage.length > 0;
	// The caller's sentence wins when it has one: it is a sentence this component could not
	// have derived. `undefined` alone means "derive it" — `null` and `""` are a caller saying
	// there is nothing to show, and the render below turns both into nothing.
	const sentence =
		message === undefined
			? deliberate
				? failure.serverMessage
				: fromError
			: (message ?? "");

	useEffect(() => {
		if (!sentence || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(sentence);
	}, [sentence]);

	if (!sentence) return null;

	if (inline) {
		return (
			<Text
				variant={variant}
				tone="destructive"
				// The role and the live region travel together, which is the whole reason the
				// inline shape is in this file rather than in each screen's own JSX.
				accessibilityRole="alert"
				accessibilityLiveRegion={politeness}
			>
				{sentence}
			</Text>
		);
	}

	const surface = [
		styles.notice,
		{ backgroundColor: colors.card, borderColor: colors.destructive },
		style,
	];
	const content = (
		<>
			<Ionicons
				name="alert-circle-outline"
				// `icon.inline` — "a mark on a line of text that is not itself a target", which is
				// what this glyph is: hidden from the tree, sitting on the first line of a `body`
				// sentence. It was `type.heading.fontSize`, a type step borrowed as an icon size,
				// and there is no heading in this block for it to match. `./toast` draws the
				// identical row — same flex, same `alignItems`, same one body sentence — at
				// `icon.inline`.
				size={icon.inline}
				color={colors.destructive}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant={variant} tone="destructive" style={styles.sentence}>
				{sentence}
			</Text>
		</>
	);

	// The dismissable build is a `Pressable` whose *own root* carries the alert — never a
	// tappable wrapper around an accessible child, which would swallow the role out of the
	// tree. That is the pairing `./toast` draws for its own sentence, and why this is a
	// second `return` rather than a `Pressable` around the `View` below.
	if (onDismiss) {
		return (
			<Pressable
				onPress={onDismiss}
				accessibilityRole="alert"
				accessibilityLiveRegion={politeness}
				accessibilityHint={t("a11y.dismissToast")}
				style={surface}
			>
				{content}
			</Pressable>
		);
	}

	return (
		<View
			style={surface}
			accessibilityRole="alert"
			accessibilityLiveRegion={politeness}
		>
			{content}
		</View>
	);
}

const styles = StyleSheet.create({
	notice: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
		borderWidth: 1,
		// `radius.md`, the step for a surface — `sm` is the control step, and nothing presses this
		// block. It is the same block as `./toast`: `colors.card`, a hairline, one sentence over
		// the page. The corner was the only place the two disagreed.
		borderRadius: radius.md,
		padding: space.md,
		// A message that wraps to three lines at 200% Dynamic Type pushes the icon to the
		// top of the block; the icon's own line height keeps it beside the first one. The
		// floor is `body`'s because `body` is the step every block caller draws at — a
		// caller that takes the smaller step is `inline`, and an inline line has no floor
		// to disagree with.
		minHeight: type.body.lineHeight,
	},
	sentence: { flex: 1 },
});
