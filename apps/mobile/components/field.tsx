import { useEffect, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	TextInput,
	type TextInputProps,
	View,
} from "react-native";

import { MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * A labelled input.
 *
 * The label is a `<Text>` above the field and not a `placeholder`, because a placeholder
 * disappears the moment somebody types and is not announced as a name by every screen
 * reader. It is also not `accessibilityLabel` alone: a label that only exists in the
 * accessibility tree is invisible to the person who cannot see the field and needs to know
 * what it wants.
 *
 * `error` is a translated sentence, not a boolean — the field has no idea what was wrong
 * with the value, and a generic "invalid" under a box is a message that tells nobody
 * anything. When there is an error the border becomes `destructive` **and** the sentence
 * appears, so the state is not carried by a red outline on its own.
 *
 * ## The message row is reserved, and that is the whole reason for the wrapper view
 *
 * The sentence under the box lives in a slot that exists whether or not it has anything in
 * it, with `minHeight` of one `caption` line. Without that, an error appearing pushes every
 * field below it down — and the field below it is usually the one a thumb is already
 * travelling towards, so the target moves as it is being aimed at. Reserving the row costs
 * one line of caption under every field and buys the guarantee that validation never
 * reflows the form.
 *
 * `minHeight` is a floor and not a height: at 200% Dynamic Type the sentence wraps to two
 * lines and the slot grows with it, exactly as the button's `MIN_TOUCH_TARGET` floor does.
 * A fixed `height` here would clip the very case it is meant to protect.
 *
 * The slot is unconditional rather than created on the first error, because creating it on
 * the first error is the jump. `help` fills the same slot when there is no error, so a
 * field that documents itself and a field that is complaining occupy the same line and
 * never both.
 *
 * ## The caller's handlers run, and `rest` is spread last
 *
 * `onFocus` and `onBlur` are destructured out of the props so the internal handlers can call
 * them, and `{...rest}` is spread as the **last** prop expression so that nothing left in
 * `rest` can displace a prop written above it.
 *
 * Both halves are needed and neither is enough alone, which is how this broke. Spreading
 * `{...rest}` last is deliberate for `style`, `autoCapitalize` and the rest of `TextInputProps`
 * — a caller may narrow this field — but with `onBlur` left inside it, the five call sites
 * that pass one (`(auth)/sign-in` three, `app/profile` two, each using it to mark its field
 * touched) replaced this component's handler outright. `setFocused(false)` then never ran,
 * and the box kept `colors.ring` — the *focus* border — for the rest of the form's life,
 * because `error` only takes the colour when there is in fact an error. A ring on a field
 * nobody is in reads as a stuck control, not as a focus.
 *
 * The caller's handler runs first and this component's second. That order is fixed here
 * rather than left to the caller: whatever a caller does on blur, the border clears.
 */
export function Field({
	label,
	value,
	onChangeText,
	error,
	help,
	onFocus,
	onBlur,
	...rest
}: { label: string; error?: string | null; help?: string } & TextInputProps) {
	const { colors } = useTheme();
	const [focused, setFocused] = useState(false);

	// Android reads the sentence through the live region below. iOS announces nothing for a
	// role alone, so this explicit call is the only thing that reaches VoiceOver there — the
	// same gate, for the same reason, as `./rollback-notice` and `./toast`. The two mechanisms
	// are alternatives rather than layers: calling this on Android as well would speak a
	// sentence TalkBack has already read.
	//
	// Keyed on `error`, so a field that fails, is corrected and fails the same way again is
	// announced twice. That is right — the second failure is news.
	useEffect(() => {
		if (!error || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(error);
	}, [error]);

	return (
		<View style={styles.wrap}>
			<Text variant="label" bold>
				{label}
			</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				// The caller's handler first, this component's second — see the precedence
				// note above. Neither can displace the other: `onFocus`/`onBlur` are out of
				// `rest` precisely so the last-spread `{...rest}` cannot shadow them.
				onFocus={(event) => {
					onFocus?.(event);
					setFocused(true);
				}}
				onBlur={(event) => {
					onBlur?.(event);
					setFocused(false);
				}}
				placeholderTextColor={colors.mutedForeground}
				style={[
					styles.input,
					{
						backgroundColor: colors.card,
						color: colors.foreground,
						borderColor: error
							? colors.destructive
							: focused
								? colors.ring
								: colors.input,
					},
				]}
				// The field's name in the accessibility tree, and the reason it is not just
				// the visible `<Text>` above: on iOS the two are separate elements, and a
				// focused text box with no label announces only its current contents.
				accessibilityLabel={label}
				accessibilityHint={error ?? help}
				{...rest}
			/>
			<View style={styles.message}>
				{/* The sentence wins over the help text — two lines of small print under one box
				    is a stack nobody reads, and the error is the one that matters right now.
				    The live region is Android's mechanism and the only one that exists there;
				    `alert` is not a second one on iOS, where a role alone announces nothing.
				    The effect above is what iOS hears. A validation message nobody hears is a
				    form that silently refuses to submit. */}
				{error ? (
					<Text
						variant="caption"
						tone="destructive"
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						{error}
					</Text>
				) : help ? (
					<Text variant="caption" tone="muted">
						{help}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: space.sm },
	input: {
		minHeight: MIN_TOUCH_TARGET,
		borderWidth: 1,
		borderRadius: radius.sm,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		fontSize: type.body.fontSize,
		// Carried here because `./text`'s base style cannot reach this view.
		//
		// `includeFontPadding: false` is set in the object every `Text` variant shares
		// (`text.tsx:130`, `includeFontPadding: false`), which is what makes it reach every
		// string drawn through `Text` —
		// and a bare RN `TextInput` is not a `Text`. It renders its own text stack, so the
		// reset never arrives, and Android goes on reserving the font's ascent and descent
		// around the value on top of the line box. Inside a box this file gives a
		// `MIN_TOUCH_TARGET` floor and equal vertical padding, that reads as the typed value
		// sitting low in the box rather than centred in it. The property is an Android-only
		// text style — RN 0.86 declares it on `____TextStyle_InternalBase`
		// (`types_generated/Libraries/StyleSheet/StyleSheetTypes.d.ts:803`), the same
		// declaration `text.tsx` cites — so iOS ignores the value rather than disagreeing
		// with it.
		includeFontPadding: false,
	},
	// Empty most of the time and reserved always — see the note above on why this is not
	// created on demand.
	message: { minHeight: type.caption.lineHeight },
});
