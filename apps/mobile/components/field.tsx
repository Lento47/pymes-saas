import Ionicons from "@expo/vector-icons/Ionicons";
import { type Ref, useEffect, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	TextInput,
	type TextInputProps,
	View,
} from "react-native";

import { useT } from "@/lib/i18n";
import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

import { Pressable } from "./pressable";
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
	/**
	 * Offer the show/hide control inside the box. The caller still owns
	 * `secureTextEntry` — this only decides whether the reader may lift it.
	 * No confirm-password field exists anywhere in this app by decision
	 * (unmask instead of retype), and this is the control that makes that true.
	 */
	secureToggle = false,
	secureTextEntry,
	/**
	 * The keyboard flow's handle on this box. Declared and forwarded
	 * explicitly: React 19 passes `ref` as an ordinary prop, but the type
	 * only accepts what is named — `TextInputProps` does not name it, so an
	 * undeclared `ref` is a type error that reads as if refs were unsupported.
	 */
	ref,
	onFocus,
	onBlur,
	...rest
}: {
	label: string;
	error?: string | null;
	help?: string;
	secureToggle?: boolean;
	ref?: Ref<TextInput>;
} & TextInputProps) {
	const { t } = useT();
	const { colors } = useTheme();
	const [focused, setFocused] = useState(false);
	// Masked until asked: the reveal is opt-in per attempt, never remembered.
	const [revealed, setRevealed] = useState(false);
	const showToggle = secureToggle && secureTextEntry;

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
			<View style={styles.inputWrap}>
				<TextInput
					ref={ref}
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
					// `secureTextEntry` is destructured above so this resolution wins:
					// left inside `rest`, the caller's `true` would shadow it on every render.
					secureTextEntry={secureToggle ? !revealed : secureTextEntry}
					placeholderTextColor={colors.mutedForeground}
					style={[
						styles.input,
						showToggle && styles.inputWithToggle,
						{
							backgroundColor: colors.card,
							color: colors.foreground,
							borderColor: error
								? colors.destructive
								: focused
									? colors.ring
									: colors.input,
						},
						// The focus ring, and it is more than the border's hue: a 1px
						// colour swap is the whole of what a reader gets on a box whose
						// edge they are already looking at (WCAG 2.4.7). Web draws the
						// 2px outer band the design system means by a ring; native
						// thickens the edge itself, with the margin holding the box's
						// outer size so focusing never reflows the form.
						focused && !error
							? Platform.OS === "web"
								? { boxShadow: `0 0 0 2px ${colors.ring}` }
								: { borderWidth: 2, marginVertical: -1 }
							: null,
					]}
					// The field's name in the accessibility tree, and the reason it is not just
					// the visible `<Text>` above: on iOS the two are separate elements, and a
					// focused text box with no label announces only its current contents.
					accessibilityLabel={label}
					accessibilityHint={error ?? help}
					{...rest}
				/>
				{showToggle ? (
					<Pressable
						onPress={() => setRevealed((was) => !was)}
						accessibilityRole="button"
						accessibilityLabel={t(
							revealed ? "auth.password.hide" : "auth.password.show",
						)}
						// The box is already the 44pt floor, so no `hitSlop`: anything
						// more would reach into the field's own text.
						hitSlop={0}
						ripple={false}
						style={styles.reveal}
					>
						<Ionicons
							name={revealed ? "eye-off-outline" : "eye-outline"}
							size={icon.action}
							color={colors.mutedForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</Pressable>
				) : null}
			</View>
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
	// Positioning context for the reveal control, and nothing else: it adds no
	// size of its own, so a field without the toggle draws exactly as before.
	inputWrap: { position: "relative" },
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
	// Room for the reveal control, so typed text never slides under it.
	inputWithToggle: { paddingRight: MIN_TOUCH_TARGET + space.sm },
	// The reveal, pinned over the box's trailing edge: a 44pt target whose ink
	// is the 20pt glyph centred in it, the same centring `./product-tile`'s
	// quick-add pin gives its disc in an identical square.
	reveal: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 0,
		width: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
	},
	// Empty most of the time and reserved always — see the note above on why this is not
	// created on demand.
	message: { minHeight: type.caption.lineHeight },
});
