import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { icon, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The home screen's search field — the one loud thing on it.
 *
 * Tapping it does not push `/search`: the field activates where it sits and the feed below
 * gives way to results, with the hardware back key standing the feed back up
 * (`app/index.tsx` owns that). The full `/search` screen stays for deep links and the
 * feed's own exit; this is the same procedure behind a nearer door.
 *
 * ## What used to live here, and where it went
 *
 * This component drew the **location line** above the field for as long as it existed, and
 * the whole of its earlier argument — that a screen states its coordinate exactly once, in
 * words, and never twice — moves to `./home-header`, which draws it now as the meta line
 * under the greeting. The short version of why it moved is composition: the header is one
 * row whose left column stacks the customer's title over the role-labelled coordinate
 * (who it is for, then where this order goes) and the field under it is the screen's one
 * loud thing, which is `docs/design-mobile.md`'s Rule 1 arranged so nothing in the header
 * competes with it. The reasoning is in that file's docblock; it did not change owner so
 * much as file.
 *
 * ## A link standing in for a field, and why it is not lifted
 *
 * `role` is `search` and not `button`, matching what this has always announced: a reader
 * who lands on it should hear "search", not "button, search".
 *
 * The box is `card` on `background` — a fill nobody can see — so the outline is the *only*
 * thing saying where the control is, and WCAG 1.4.11 asks a control's boundary for 3:1.
 * `border` is the decorative hairline at about 1.3:1 and is wrong here; `colors.input` is
 * 3.24:1 on `card` and 3.22:1 on `background` in the light theme, 3.10:1 in the dark one,
 * and it is what `./field` draws at rest. This control is a link rather than a text input,
 * but it is the same affordance and owes the same boundary.
 *
 * No `shadow.card`: `./field` and `./pressable`'s rows draw this fill with this hairline and
 * **no** lift, and a field is not a card. Lifting it would make the stand-in the only search
 * box in the app that floats, which is a difference a reader sees on the first tap.
 *
 * ## There is no filter button at the field's end
 *
 * There is nowhere honest for it to go. `catalog.search` takes `{q, lat?, lng?}` and no
 * filters at all, so a filters control over search results could only print a filter that
 * was not applied — which is exactly the lie `app/search.tsx` refuses in its own docblock,
 * and the reason that screen sends the reader to a category page or to `/nearby`, the one
 * surface that mounts `./filter-sheet` and has the parameters to honour it. A filter button
 * here would be a picker in front of a field nobody can write.
 */
export function HeroSearch({
	onPress,
	accessibilityHint,
}: {
	onPress: () => void;
	/** What search means here; the caller owns it because the route is the screen's. */
	accessibilityHint?: string;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<View style={styles.wrap}>
			<Pressable
				onPress={onPress}
				accessibilityRole="search"
				accessibilityLabel={t("home.search.placeholder")}
				accessibilityHint={accessibilityHint}
				style={({ pressed }) => [
					styles.hero,
					{
						// The tint is the press signal: the field lifts to the muted surface
						// under the finger. It is a *second* signal — `./pressable` also
						// springs the box to 0.97, which is the default and correct: the field
						// pays `space.lg` of gutter on both sides, so its edges are not the
						// screen's.
						backgroundColor: pressed ? colors.muted : colors.card,
						borderColor: colors.input,
					},
				]}
			>
				<Ionicons
					name="search-outline"
					size={icon.action}
					color={colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<Text variant="heading" tone="muted" style={styles.flex}>
					{t("home.search.placeholder")}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { paddingHorizontal: space.lg, gap: space.sm },
	hero: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.lg,
		// `heading` (17/24) plus 2×`space.md` is 48 tall — past `MIN_TOUCH_TARGET`'s floor
		// without a `minHeight` fighting the type, and still short enough that a 200% reader
		// gets one line rather than a box that swallowed the fold. It grows with the text
		// because the padding is fixed and the line box is not.
		paddingVertical: space.md,
		// `lg` is the token for sheets and heroes, and this is the hero. It is deliberately not
		// a pill: `full` reads as a chip, and a chip is a filter, not a way in.
		borderRadius: radius.lg,
		borderWidth: 1,
	},
	flex: { flex: 1 },
});
