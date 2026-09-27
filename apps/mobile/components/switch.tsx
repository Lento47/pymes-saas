import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { radius, useTheme } from "@/theme";

import { Pressable } from "./pressable";

/**
 * A two-state control: the thing a phone calls a switch, drawn once.
 *
 * It was drawn twice — `components/business-product-row` had one, built inline beside the
 * product it toggled — and a shop's hours now need the same control for a day's `isClosed`.
 * Two copies of a switch is two copies of the track's 44×28, the thumb's 20, and the 16-point
 * travel between them, and the day one of them is fixed the other is a control that looks the
 * same and measures differently. This file is the one copy.
 *
 * ## `checked` is the label's own polarity, and that is the caller's decision
 *
 * The control does not know what "on" means. `components/business-product-row` passes
 * `checked={available}` under a label that names availability; `app/(business)/shop-hours`
 * passes `checked={entry.isClosed}` under `biz.settings.hours.closed`, so on *is* the shut
 * day. A switch that inverted one of them would be a control that lies about what it just
 * did, which is why the reading of the state lives with the sentence beside it and not here.
 *
 * ## The label is outside, and the a11y name is the caller's
 *
 * No word is drawn by this component: every caller has its own sentence already, and a switch
 * that printed its own would say the same thing twice at 200% text where there is least room
 * for it. `accessibilityLabel` is required rather than optional for the same reason — a switch
 * with no name is announced as "switch, off", which tells a reader nothing about what it
 * switches. `accessibilityRole="switch"` and `accessibilityState.checked` are this file's half
 * of that contract: the platform speaks "on"/"off" from the state, and the caller supplies the
 * noun.
 *
 * The 48-point target is the same one `components/business-product-row` gave its switch and it
 * clears `MIN_TOUCH_TARGET`'s 44 without borrowing the constant — the track is 28 tall and the
 * target is the box around it, so a thumb that lands near the track still lands on the control.
 */
export function Switch({
	checked,
	onChange,
	label,
	disabled = false,
	style,
}: {
	checked: boolean;
	/** The new state, not the event — a caller never needs which end of the track was tapped. */
	onChange: (next: boolean) => void;
	/** The control's name in the accessibility tree. Required: see above. */
	label: string;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();

	return (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={label}
			accessibilityState={{ checked, disabled }}
			disabled={disabled}
			onPress={() => onChange(!checked)}
			style={[styles.target, style]}
		>
			<View
				style={[
					styles.track,
					{
						backgroundColor: checked ? colors.primary : colors.muted,
						borderColor: checked ? colors.primary : colors.border,
					},
				]}
			>
				<View
					style={[
						styles.thumb,
						{
							backgroundColor: checked
								? colors.primaryForeground
								: colors.mutedForeground,
							transform: [{ translateX: checked ? THUMB_TRAVEL : 0 }],
						},
					]}
				/>
			</View>
		</Pressable>
	);
}

/**
 * The thumb's travel, written as the subtraction it is.
 *
 * The track is `border-box` at 44 wide with a 1-point border and 3 points of padding each
 * side, so its content is 36 and a 20-point thumb moves 16. Type the 16 on its own and the
 * day the track's padding moves, the thumb stops clearing the far edge and nothing in the file
 * would say so — the same argument `components/merchant-command-rail` makes for its fill.
 */
const THUMB_TRAVEL = 44 - 2 * 1 - 2 * 3 - 20;

const styles = StyleSheet.create({
	target: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	track: {
		width: 44,
		height: 28,
		borderRadius: radius.full,
		borderWidth: 1,
		padding: 3,
		justifyContent: "center",
	},
	thumb: {
		width: 20,
		height: 20,
		borderRadius: radius.full,
	},
});
