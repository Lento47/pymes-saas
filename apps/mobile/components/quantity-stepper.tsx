import Ionicons from "@expo/vector-icons/Ionicons";
import { MAX_LINE_QUANTITY } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * A quantity, and the two taps that change it.
 *
 * This is a primitive rather than a block inside the cart because the number is the same
 * control everywhere it appears — a cart line today, a product page tomorrow — and the
 * parts that are easy to get wrong are exactly the parts a shared component owns: two
 * 44-point targets either side of the number, a value that does not jump when it goes from
 * one digit to two, and a screen-reader story that says *which* number is being changed.
 *
 * ## The three labels
 *
 * The web's `QuantityStepper` composes its labels from a translated noun and two Spanish
 * fragments hardcoded in `packages/ui`. This app may not hardcode a user-facing string, so
 * all three arrive translated: the noun the value is read as ("Cantidad: 3", the same
 * shape the web gives its value) and a name for each direction. That also lets the cart
 * call the minus what it actually is there — "Quitar", because at one the API removes the
 * line rather than counting down to nothing.
 *
 * ## No haptic here
 *
 * The buzz belongs to the commit, and the commit is the cart's optimistic write, in
 * `lib/cart-mutations.ts`. A stepper that fired its own would be a second answer to a
 * question the hook already answers — and would fire it on a screen whose write may then
 * be refused.
 *
 * ## The number is the layout's, the rest is the primitive's
 *
 * The value carries `tabular` so the digits line up column-wise when a list has several
 * rows, and the box it sits in is a *minimum* width rather than a fixed one: at 200%
 * Dynamic Type the label grows, and a fixed box would clip the very case it was drawn for.
 */
export function QuantityStepper({
	value,
	onChange,
	/** The spoken name of the count: "Cantidad". */
	label,
	/** The spoken name of the decrease control: "Quitar", "Agregar". */
	decreaseLabel,
	increaseLabel,
	/** The lowest value `onChange` will be given. `0` for a line where zero removes it. */
	min = 1,
	max = MAX_LINE_QUANTITY,
	disabled = false,
}: {
	value: number;
	onChange: (next: number) => void;
	label: string;
	decreaseLabel: string;
	increaseLabel: string;
	min?: number;
	max?: number;
	disabled?: boolean;
}) {
	const { colors } = useTheme();
	const atFloor = value <= min;
	const atCeiling = value >= max;

	return (
		<View style={styles.row}>
			<Pressable
				onPress={() => onChange(value - 1)}
				disabled={disabled || atFloor}
				// A control at its floor is drawn as a surface that is not taking input rather
				// than faded into the page. The glyph is the whole control, so a 0.5 multiplier
				// put it at 2.42:1 in the dark theme — a minus sign a customer has to hunt for on
				// the button whose entire job is to say the count cannot go lower. `muted` with
				// `mutedForeground` on it is **5.86:1** there and **6.03:1** in the light one.
				disabledOpacity={1}
				accessibilityRole="button"
				accessibilityLabel={decreaseLabel}
				accessibilityState={{ disabled: disabled || atFloor }}
				style={[
					styles.button,
					{
						backgroundColor:
							disabled || atFloor ? colors.muted : colors.secondary,
					},
				]}
			>
				<Ionicons
					name="remove"
					size={MIN_TOUCH_TARGET / 2}
					color={
						disabled || atFloor
							? colors.mutedForeground
							: colors.secondaryForeground
					}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>

			{/* The value is its own node rather than part of a group: a reader who lands on it
			    hears "Cantidad: 3" instead of a bare "3" with no idea which number it is. */}
			<Text
				variant="body"
				bold
				tabular
				style={styles.value}
				accessibilityLabel={`${label}: ${value}`}
			>
				{value}
			</Text>

			<Pressable
				onPress={() => onChange(value + 1)}
				disabled={disabled || atCeiling}
				// The same pair, for the same reason as the decrease control above.
				disabledOpacity={1}
				accessibilityRole="button"
				accessibilityLabel={increaseLabel}
				accessibilityState={{ disabled: disabled || atCeiling }}
				style={[
					styles.button,
					{
						backgroundColor:
							disabled || atCeiling ? colors.muted : colors.secondary,
					},
				]}
			>
				<Ionicons
					name="add"
					size={MIN_TOUCH_TARGET / 2}
					color={
						disabled || atCeiling
							? colors.mutedForeground
							: colors.secondaryForeground
					}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", gap: space.md },
	button: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	// A floor, not a width: two digits and a larger font stay inside it, and the number
	// stops the row's other contents sliding sideways as it changes.
	value: { minWidth: MIN_TOUCH_TARGET, textAlign: "center" },
});
