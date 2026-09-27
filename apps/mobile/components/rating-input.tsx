import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { selection } from "@/lib/haptics";
import { icon, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";

export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5;
export type SelectedRating = Exclude<RatingValue, 0>;

type RatingInputProps = {
	/** Zero means the reader has not chosen a rating yet. */
	value: RatingValue;
	onChange: (value: SelectedRating) => void;
	/** The radio group's accessible name, such as “Calificación de la entrega”. */
	label: string;
	/** The accessible name for one choice, such as “3 de 5 estrellas”. */
	optionLabel: (value: SelectedRating) => string;
	disabled?: boolean;
};

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Five touch targets that behave as one radio group. */
export function RatingInput({
	value,
	onChange,
	label,
	optionLabel,
	disabled = false,
}: RatingInputProps) {
	const { colors } = useTheme();

	return (
		<View
			style={styles.group}
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
		>
			{RATINGS.map((rating) => {
				const checked = value === rating;
				const filled = value >= rating;

				return (
					<Pressable
						key={rating}
						onPress={() => {
							if (checked) return;
							selection();
							onChange(rating);
						}}
						disabled={disabled}
						disabledOpacity={1}
						accessibilityRole="radio"
						accessibilityLabel={optionLabel(rating)}
						accessibilityState={{ checked, disabled }}
						style={styles.option}
					>
						<Ionicons
							name={filled ? "star" : "star-outline"}
							size={icon.action}
							color={filled ? colors.rating : colors.mutedForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	group: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.xs,
	},
	option: {
		alignItems: "center",
		justifyContent: "center",
	},
});
