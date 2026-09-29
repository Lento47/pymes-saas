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
 * The affix chip, and its two numbers.
 *
 * `AFFIX_SIZE` is the chip's own square and `AFFIX_INSET` the air between it and the box's
 * edge. They are named rather than written twice because they are also the arithmetic in
 * `inputAffixed` — the box's leading padding is the chip plus *two* insets plus a gap, and
 * three of those four numbers appearing in two places is a chip that drifts out of its field
 * the first time one of them moves.
 */
const AFFIX_SIZE = 36;
const AFFIX_INSET = 12;

/**
 * The soft field's own height, exported because a skeleton has to draw the box it stands in
 * for and a hand-typed `52` in that skeleton is a number that drifts the first time the field
 * moves. `./action-bar`'s `ACTION_BAR_CLEARANCE` and `./tab-bar`'s
 * `MERCHANT_BARLESS_ROUTES` are the same arrangement.
 */
export const SOFT_FIELD_HEIGHT = 52;

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
	/**
	 * The box's surface. `"outline"` is this file's original field and stays the default:
	 * nineteen screens and roughly seventy-five call sites draw it, including the sign-in and
	 * sign-up forms, so changing the default would redesign every one of them from a request
	 * about a product form. `"soft"` is the commerce system's field — a filled surface with no
	 * resting outline — and a screen opts in by naming it.
	 */
	variant = "outline",
	/**
	 * A mark at the box's leading edge, on the same filled chip: a glyph, or a short piece of
	 * text such as a currency. It is decoration for the eye only; the field's name in the
	 * accessibility tree is still `label`, and a currency prefix on a price box is not a label
	 * — the label above already is. Absent on `"outline"` by default and available to both,
	 * because an outline field with a chip inside it is a legitimate thing to want.
	 */
	affix,
	/**
	 * `length / maxLength` at the box's trailing foot, for a field with room to run out. Drawn
	 * from the `maxLength` the input already enforces, so the two cannot disagree about what
	 * the ceiling is, and suppressed when the reveal toggle is showing because that control
	 * owns the same corner.
	 */
	counter = false,
	/**
	 * Keep the message row even when it is empty, so a validation sentence never pushes the
	 * fields below it. On by default and the reason the wrapper view exists at all; off only
	 * for a field that has neither an `error` nor a `help` to put in it, where the row is dead
	 * space by construction and removing it costs nothing that was being protected.
	 */
	reserveMessage = true,
	/**
	 * The caller's own overrides, merged **first** in the array below so this file's box,
	 * its affix clearance and its focus ring are the last word.
	 *
	 * Destructured rather than left in `rest`, and that is a fix: `rest` is spread as the
	 * last prop expression so a caller's `onFocus` cannot displace this one's, which means a
	 * caller who passed `style` replaced the whole computed array rather than adding to it.
	 * a `style` that silently discards `minHeight` is how a soft field asked for 104 and
	 * drew 44, which is exactly what it did until this prop existed.
	 *
	 * Last also matches `./card.tsx`, which spreads a caller's `style` after the surface for
	 * the same reason: a caller composing `[a, b]` expects `b` to be the word.
	 */
	style: inputStyle,
	ref,
	onFocus,
	onBlur,
	...rest
}: {
	label: string;
	error?: string | null;
	help?: string;
	secureToggle?: boolean;
	variant?: "outline" | "soft";
	affix?: React.ReactNode;
	counter?: boolean;
	reserveMessage?: boolean;
	ref?: Ref<TextInput>;
} & TextInputProps) {
	const { t } = useT();
	const { colors } = useTheme();
	const [focused, setFocused] = useState(false);
	// Masked until asked: the reveal is opt-in per attempt, never remembered.
	const [revealed, setRevealed] = useState(false);
	const showToggle = secureToggle && secureTextEntry;
	const soft = variant === "soft";
	const showCounter =
		counter && !showToggle && typeof rest.maxLength === "number";

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
						soft && styles.inputSoft,
						rest.multiline === true && styles.inputMultiline,
						affix ? styles.inputAffixed : null,
						showCounter && styles.inputCounted,
						{
							backgroundColor: soft
								? focused
									? colors.card
									: colors.muted
								: colors.card,
							color: colors.foreground,
							borderColor: error
								? colors.destructive
								: focused
									? colors.ring
									: soft
										? "transparent"
										: colors.input,
						},
						// The focus ring, and it is more than the border's hue: a 1px
						// colour swap is the whole of what a reader gets on a box whose
						// edge they are already looking at (WCAG 2.4.7). Web draws the
						// 2px outer band the design system means by a ring; native
						// thickens the edge itself, with the margin holding the box's
						// outer size so focusing never reflows the form.
						//
						// A soft field has no resting edge to thicken *into*, so its
						// resting `borderWidth` is 0 and the thickening is what first gives
						// it one. An error thickens it the same way, because on a filled
						// surface a 1px coloured line is the only edge the field has and
						// the state cannot be carried by hue alone.
						focused && !error
							? Platform.OS === "web"
								? { boxShadow: `0 0 0 2px ${colors.ring}` }
								: { borderWidth: 2, marginVertical: -1 }
							: error && soft
								? { borderWidth: 2, marginVertical: -1 }
								: null,
						// The last word, and last on purpose — see the prop's own note.
						inputStyle,
					]}
					// The field's name in the accessibility tree, and the reason it is not just
					// the visible `<Text>` above: on iOS the two are separate elements, and a
					// focused text box with no label announces only its current contents.
					accessibilityLabel={label}
					accessibilityHint={error ?? help}
					{...rest}
				/>
				{showCounter ? (
					<Text variant="caption" tone="muted" tabular style={styles.counter}>
						{(value ?? "").length}/{rest.maxLength}
					</Text>
				) : null}
				{affix ? (
					<View
						style={[styles.affix, { backgroundColor: colors.accent }]}
						// Decorative: the label above already names the field, and a chip
						// holding a currency announced before every price is noise on top of
						// a name the screen reader has already read.
						accessibilityElementsHidden
						importantForAccessibility="no"
					>
						{affix}
					</View>
				) : null}
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
			{reserveMessage ? (
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
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: space.sm },
	// Positioning context for the reveal control, the affix and the counter, and nothing
	// else: it adds no size of its own, so a field without any of them draws exactly as
	// before. `overflow: "hidden"` clips an affix or a counter to the box's corner radius,
	// which is the only reason they are drawn here rather than beside the input.
	inputWrap: { position: "relative", overflow: "hidden" },
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
	/**
	 * The commerce system's box: a filled surface, no resting outline, and the radius the
	 * interface spec's field step names — `radius.md`, 12. A taller floor than the outline
	 * field's 44 because the affordance this replaces was a row of stacked labels and boxes
	 * and the complaint was that it read as a default form; 52 is the height the spec measures
	 * and the one the other soft controls on the same screen use.
	 */
	inputSoft: {
		minHeight: SOFT_FIELD_HEIGHT,
		borderWidth: 0,
		borderRadius: radius.md,
		paddingHorizontal: 14,
	},
	// Clear the affix chip and its own inset, so no text can start under the mark. The
	// chip's left edge is one inset in and it is `AFFIX_SIZE` wide, so the text starts a
	// further `space.md` past that — not two insets, which would leave a second inset of
	// air between the chip and the first letter.
	inputAffixed: { paddingLeft: AFFIX_INSET + AFFIX_SIZE + space.md },
	// Clear the counter at the foot, for the same reason on the other side.
	inputCounted: { paddingBottom: space.lg + space.xs },
	/**
	 * A `multiline` box is a paragraph, not a line: Android centres a multiline input's text
	 * in its own height by default, which puts the first line halfway down a 104-point field
	 * and reads as an empty box with something lost in it. `top` is Android-only and iOS
	 * ignores the value rather than disagreeing, the same one-way property
	 * `includeFontPadding` below is.
	 */
	inputMultiline: { textAlignVertical: "top", paddingTop: space.md },
	/**
	 * The affix, pinned over the box's leading edge, and the third thing that shares this
	 * corner with the text — the reveal control owns the trailing one and the counter the foot.
	 * `overflow: "hidden"` is what keeps a multiline box's first line from painting over the
	 * chip, and it is also why the chip is a child of the input's own positioning context
	 * rather than a sibling above it.
	 */
	affix: {
		position: "absolute",
		left: AFFIX_INSET,
		top: AFFIX_INSET,
		minWidth: AFFIX_SIZE,
		minHeight: AFFIX_SIZE,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: space.xs,
	},
	// The ceiling, told not felt: it is the `maxLength` the input already enforces, so the two
	// cannot disagree, and it is right-aligned inside the box rather than below it, where it
	// would cost the field another reserved line.
	counter: { position: "absolute", right: space.md, bottom: space.sm },
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
