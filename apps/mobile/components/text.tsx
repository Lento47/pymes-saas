import {
	Text as RNText,
	type TextProps as RNTextProps,
	type TextStyle,
} from "react-native";

import { type ThemeColors, type, useTheme, weight as weights } from "@/theme";

/**
 * Every word on a screen goes through here.
 *
 * A bare `<Text>` with a `fontSize` at the call site is how a product ends up with eleven
 * sizes and four greys: each one is defensible alone, and together they are a screen that
 * looks slightly wrong without anybody being able to say why. The variant names are the
 * whole vocabulary — if something needs a size that is not one of these, the answer is
 * usually that it is one of these.
 *
 * `tone` is a name, not a colour. `tone="muted"` survives a theme change and a palette
 * revision; `color="#625b54"` is a decision that was made once and then copied.
 */

export type TextVariant = keyof typeof type;

export type TextTone =
	| "default"
	| "muted"
	| "primary"
	| "action"
	| "price"
	| "compare"
	| "discount"
	| "destructive"
	| "success"
	| "inverse";

const TONES: Record<TextTone, keyof ThemeColors> = {
	default: "foreground",
	muted: "mutedForeground",
	primary: "primary",
	// Ink that is read rather than a surface that is pressed: links, meaningful
	// glyphs. Consumer blue, merchant ink — see the `action` token, which is why
	// this tone exists rather than reusing `primary` and breaking the merchant tree.
	action: "action",
	price: "price",
	compare: "priceCompare",
	discount: "discount",
	destructive: "destructive",
	success: "success",
	// For text sitting on `primary` or `destructive`: the foreground pair exists for exactly
	// this, and picking `card` instead is how a button's label ends up unreadable in dark mode.
	inverse: "primaryForeground",
};

type TextProps = RNTextProps & {
	variant?: TextVariant;
	tone?: TextTone;
	/**
	 * Align digits in a column.
	 *
	 * Money and quantities, never prose — "₡1.500" and "₡11.500" in a list are two numbers a
	 * reader compares by scanning, and proportional digits make that scan miss.
	 */
	tabular?: boolean;
	bold?: boolean;
};

export function Text({
	variant = "body",
	tone = "default",
	tabular = false,
	bold = false,
	style,
	...rest
}: TextProps) {
	const { colors } = useTheme();

	const base: TextStyle = {
		...type[variant],
		color: colors[TONES[tone]],
		// Android reserves a line of its own around a word and iOS does not.
		// `includeFontPadding` defaults to `true` there, which adds the font's ascent and
		// descent on top of the line box — visible space above the cap height and below the
		// baseline. The default and the reader are both Android's, and the split is visible in
		// RN's own source in this repo's `node_modules/react-native@0.86.3`, where the Android
		// half of each pair mentions the key and the iOS half does not:
		//
		// - `ReactCommon/react/renderer/components/text/platform/android/.../text/
		//   HostPlatformParagraphProps.cpp:147-149` is the only place the field becomes part of
		//   the native update payload, and the sibling `text/platform/cxx/` never names it.
		// - `ReactCommon/.../textinput/platform/android/.../androidtextinput/AndroidTextInputProps.h:110`
		//   declares it, and the iOS TextInput implementation beside it
		//   (`textinput/platform/ios/.../iostextinput/`) never does.
		// - `ReactAndroid/.../views/text/TextAttributeProps.kt:95` is the default —
		//   `includeFontPadding: Boolean = true` — and `:463` reads it back out of the name in
		//   `ReactAndroid/.../uimanager/ViewProps.kt:108`.
		// - `grep -rI includeFontPadding` returns 0 lines over `react-native/React/` and
		//   `react-native/ReactApple/` (the iOS native side) against 15 under `ReactAndroid/`.
		//
		// So iOS ignores the value rather than disagreeing with it: the platform with padding to
		// remove is the only one that reads the line.
		//
		// What is *not* evidence of that is the type. `includeFontPadding` is declared on
		// `____TextStyle_InternalBase` (`types_generated/Libraries/StyleSheet/StyleSheetTypes.d.ts:786`,
		// the field itself at `:803`), which is what a caller may *write* — and a generated
		// `.d.ts` accepts the key on both platforms, since the value never has to be read to be
		// typed. The two citations are not interchangeable, and this comment previously offered
		// the type where the behaviour was meant.
		//
		// It is set here, in the object every variant shares, because here is the only place
		// that reaches every call site at once — and the reach is exactly `Text`. The text that
		// *shows* the padding is the text inside a box whose height is decided elsewhere —
		// `./button`'s `MIN_TOUCH_TARGET` floor, `./segmented`'s segment, a chip at
		// `radius.full` — and those are a minority of this app's words. Set at those call
		// sites, every other Text would keep the padding, and a screen would still draw two
		// different line boxes depending on which platform it was built for.
		//
		// A bare RN `TextInput` is not a `Text`: it never receives this object, so `./field`'s
		// `input` — the one in this app — inherits nothing from here and has to carry the key
		// in its own `style`. The key *is* accepted there, so the gap is inheritance and not
		// availability: `includeFontPadding` is declared on `TextStyleAndroid`
		// (`Libraries/StyleSheet/StyleSheetTypes.d.ts:579-583`), which `TextStyle` extends
		// (`:586`), which is the type a `TextInput`'s `style` prop takes
		// (`Libraries/Components/TextInput/TextInput.d.ts:972`), and Android reads it on that
		// path too (`ReactAndroid/.../views/textinput/ReactTextInputManager.kt:257`,
		// `setIncludeFontPadding`).
		// Whether an input carrying it lands where the `Text` variants do is not measured here.
		//
		// Nothing is clipped by removing it: every variant declares a line box taller than its
		// font size, so the padding that goes was the space *outside* the line box rather than
		// part of it. The six ratios are `display` 34/28 = 1.214 — the smallest — `title`
		// 28/22 = 1.273, `heading` 24/17 = 1.412 — the largest — `body` 21/15 = 1.400, `label`
		// 18/13 = 1.385 and `caption` 16/12 = 1.333 (`theme/tokens.ts:185-190`). The band is
		// not 1.33–1.4×: that excludes `display` and `title` at the bottom and `heading` at the
		// top. Whether a particular font's own ascent and descent fit inside that box is a
		// property of the font, and is not measured here.
		includeFontPadding: false,
		// `fontVariant` rather than a monospaced family: it keeps the font and takes the
		// widths, which is the entire request. Unsupported on a platform it silently does
		// nothing, which is the right failure for a typographic nicety.
		...(tabular ? { fontVariant: ["tabular-nums" as const] } : {}),
		...(bold ? { fontWeight: weights.semibold } : {}),
	};

	return <RNText {...rest} style={[base, style]} />;
}
