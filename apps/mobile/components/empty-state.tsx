import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { radius, space, type, useTheme } from "@/theme";

import { Button } from "./button";
import { MEASURE } from "./error-state";
import { Text } from "./text";

/**
 * Nothing here, and what to do about it.
 *
 * The action is a prop and not a default because "no results" has a different answer on
 * every screen — search offers to clear the query, the orders tab offers the home feed,
 * favourites has nothing useful to offer and passes none. A generic "Retry" on all three
 * would be a button that does the same wrong thing three times.
 *
 * The icon is decorative and hidden from the screen reader: the heading beside it already
 * says the same thing, and announcing both reads the state twice.
 *
 * The badge and the glyph are sizes rather than spacing, and `theme/tokens.ts` has no icon
 * scale — so the circle is built from the spacing steps it *does* have and the glyph rides
 * the type scale. Both would be a named token the day somebody adds one; neither is a bare
 * number here, because a number at a call site is how a design system acquires a second
 * opinion about how big a decorative circle is.
 *
 * ## The gutter is this component's, not the caller's
 *
 * A message block is never edge-to-edge, so this pays its own `paddingHorizontal` rather
 * than trusting whatever it was dropped into. Most of these states land on a screen
 * rendering `padded={false}` — the screens whose lists bleed — and each call site was
 * wrapping this in a local `paddingHorizontal`, which held until the one that forgot.
 * `./signed-in` is the one that forgot: it draws this and a `Spinner` with no wrapper at
 * all, so on the cart the signed-out state ran to both edges of the screen and the heading
 * centred itself against the bezel.
 *
 * `./skeletons` makes the same call for the same reason, and the cost is the same and is
 * close to nothing: on a screen whose body already pays `space.lg`, this narrows a centred
 * block by one more step, and `body`'s own measure below is the constraint that actually
 * binds on a phone. What it buys is that the guarantee cannot be forgotten at a call site.
 */

/** `space.huge + space.xxl` — the circle a 28-point glyph sits in. */
const BADGE = space.huge + space.xxl;

export function EmptyState({
	icon = "file-tray-outline",
	title,
	body,
	actionLabel,
	onAction,
}: {
	icon?: React.ComponentProps<typeof Ionicons>["name"];
	title: string;
	body?: string;
	actionLabel?: string;
	onAction?: () => void;
}) {
	const { colors } = useTheme();

	return (
		<View style={styles.wrap}>
			<View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
				<Ionicons
					name={icon}
					size={type.display.fontSize}
					color={colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
			<Text variant="heading" bold style={styles.title}>
				{title}
			</Text>
			{body ? (
				<Text variant="body" tone="muted" style={styles.body}>
					{body}
				</Text>
			) : null}
			{actionLabel && onAction ? (
				<Button
					label={actionLabel}
					onPress={onAction}
					variant="secondary"
					style={styles.action}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: space.huge,
		paddingHorizontal: space.lg,
		gap: space.sm,
	},
	iconWrap: {
		width: BADGE,
		height: BADGE,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		// No margin of its own: `wrap`'s gap already spaces the circle from the heading, and
		// a margin here compounded the two into an undocumented 16 — twice the stack's step.
	},
	title: { textAlign: "center", maxWidth: MEASURE },
	// A measure, so a centred sentence does not run the full width of a tablet and turn the
	// reader's head to follow the line. `./error-state`'s MEASURE, shared with the heading
	// above — one cap for every centred line in the block, stated once rather than spelled
	// a second time here.
	body: { textAlign: "center", maxWidth: MEASURE },
	action: { marginTop: space.md },
});
