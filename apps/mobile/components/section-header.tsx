import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { space } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The line above a group: what the group is, and the way out of it.
 *
 * `ScreenSection` already exists for a block *inside* a screen's own scroll, but it is a
 * box — it carries its own top margin and a heading sized for a section of a page. A rail
 * that scrolls sideways and a two-line teaser grid both want the same thing this has and
 * that does not: a title and a "see all" that sit *above* a block which owns its own
 * horizontal padding, so the rail can bleed to the screen edge while the title stays
 * inset. Two call sites with the same shape is what makes it a component rather than two
 * screens agreeing by accident.
 *
 * The action is a `Pressable` and not a `Button`: a link out of a section is not an
 * action of the screen, and a bordered 44pt button beside a 17pt heading reads as the
 * page's primary control. The 44pt target is already drawn, not grown: `./pressable`'s
 * base floors the control at `minHeight`/`minWidth: MIN_TOUCH_TARGET`, so the link-shaped
 * action is a 44pt box without a border and without any `hitSlop` — an older draft grew
 * the target with vertical slop on top of that floor, a dozen points of invisible target
 * reaching past the header's own margin for a control that did not need it.
 */
export function SectionHeader({
	title,
	action,
	accessibilityHint,
	style,
}: {
	title: string;
	/** The "see all" out of this section. Omitted, the header is only a title. */
	action?: { label: string; onPress: () => void; accessibilityHint?: string };
	accessibilityHint?: string;
	/**
	 * The caller's step under this header — the gap between a section title and its own
	 * content. The default `space.md` is the storefront's rhythm; a denser surface (the
	 * merchant console's analytics plot) passes its own so tightening one section is one
	 * prop rather than a second component that differs by four points.
	 */
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.row, style]}>
			<Text variant="heading" bold style={styles.title}>
				{title}
			</Text>
			{action ? (
				<Pressable
					onPress={action.onPress}
					accessibilityRole="button"
					accessibilityLabel={action.label}
					accessibilityHint={action.accessibilityHint ?? accessibilityHint}
					style={styles.action}
				>
					{/* `action` and not `primary`: the merchant palette spends `primary`
				    on the lime fill, where this ink would be unreadable — the tone
				    exists for exactly this, ink that is read. */}
					<Text variant="label" tone="action" bold>
						{action.label}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: space.md,
	},
	title: { flexShrink: 1 },
	// Centre alignment alone: the label's line is centred inside the 44pt box `./pressable`'s
	// base floors, so the ink sits level with the title beside it. The header is that box
	// tall — 44, not the label's line — which is the height `./skeletons` has to stand in for.
	action: { justifyContent: "center" },
});
