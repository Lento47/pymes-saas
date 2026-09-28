import Ionicons from "@expo/vector-icons/Ionicons";
import {
	type StyleProp,
	StyleSheet,
	TextInput,
	type TextInputProps,
	View,
	type ViewStyle,
} from "react-native";

import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

import { Pressable } from "./pressable";

/**
 * The app's one search box: magnifier, bare `TextInput`, clear button.
 *
 * It exists because three screens drew this by hand and each copy carried the same
 * three arguments in its own comment — `app/(customer)/search.tsx`,
 * `app/(customer)/store/[slug].tsx` and `app/(business)/products.tsx`. The arguments
 * are the whole component; the screens were paying for them three times.
 *
 * ## `colors.input` and not `colors.border`
 *
 * This field is `card` on `background`, so its outline is the only boundary a customer
 * can find, and a control's boundary owes 3:1 (WCAG 1.4.11). `input` is 3.24:1 on
 * `card` in the light theme and 3.10:1 in the dark one. `border` is the decorative
 * hairline at about 1.3:1, which is what `./card` and `./list-row` want and what a
 * field does not. `./field` draws its resting border in this same token.
 *
 * ## Both glyphs are hidden from the accessibility tree
 *
 * The magnifier is decorative and the field announces itself through
 * `accessibilityLabel`. The clear button's `close-circle` is hidden for the same
 * reason its own target already names the action — a mark beside a labelled button is
 * a second thing a reader lands on to hear the same word twice.
 *
 * ## The clear button is conditional, and it takes no hit slop
 *
 * The box is already the target: `./pressable` floors every control at
 * `MIN_TOUCH_TARGET`, and this one is the field's own height besides. A slop on top of
 * that floor would grow an already-floored control past the field's edge — the 13 points
 * `hitSlopFor(icon.control)` would add reach into the row's own `gap` and take the last
 * of the typed query with it. Android's ripple is off because a circle rippling inside a
 * rounded field reads as the field itself being pressed.
 *
 * ## `includeFontPadding: false` is this component's job
 *
 * A bare RN `TextInput` never receives `./text`'s base style, so it carries the reset
 * itself. Without it Android reserves the font's ascent and descent on top of the line
 * box and the typed query sits low inside a box that centres on iOS. The contract is
 * `docs/design-mobile.md`'s; `./field`'s own `input` keeps it too.
 *
 * ## No debounce, and no search button
 *
 * Controlled, `value` / `onChangeText`, timer-free — the query layer owns pacing, as
 * `app/(customer)/search.tsx` already does with its own settle. There is no submit
 * button because there is nothing to submit to: the results are the screen, and
 * `returnKeyType="search"` is what the keyboard offers instead.
 */
export interface SearchInputProps
	extends Omit<TextInputProps, "value" | "onChangeText" | "style"> {
	value: string;
	onChangeText: (value: string) => void;
	/** Visible hint. Also the accessible name unless `accessibilityLabel` overrides it. */
	placeholder: string;
	/** Sits on the outer box — margins and `flex: 1`, not the field's own skin. */
	style?: StyleProp<ViewStyle>;
	clearLabel?: string;
}

export function SearchInput({
	value,
	onChangeText,
	placeholder,
	accessibilityLabel,
	style,
	clearLabel,
	...rest
}: SearchInputProps) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.field,
				{ backgroundColor: colors.card, borderColor: colors.input },
				style,
			]}
		>
			<Ionicons
				name="search-outline"
				size={icon.control}
				color={colors.mutedForeground}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<TextInput
				{...rest}
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.mutedForeground}
				style={[styles.input, { color: colors.foreground }]}
				accessibilityLabel={accessibilityLabel ?? placeholder}
				returnKeyType="search"
				autoCorrect={false}
				autoCapitalize="none"
				clearButtonMode="while-editing"
			/>
			{value.length > 0 ? (
				<Pressable
					onPress={() => onChangeText("")}
					ripple={false}
					accessibilityRole="button"
					accessibilityLabel={clearLabel}
					style={styles.iconButton}
				>
					<Ionicons
						name="close-circle"
						size={icon.control}
						color={colors.mutedForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.md,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.md,
		borderWidth: 1,
	},
	// `./pressable`'s base floors the box at `MIN_TOUCH_TARGET` and aligns nothing, so its
	// child draws at the top of it — which is off the line the input beside it is set on.
	iconButton: { alignItems: "center", justifyContent: "center" },
	input: {
		flex: 1,
		fontSize: type.body.fontSize,
		minHeight: MIN_TOUCH_TARGET,
		includeFontPadding: false,
	},
});
