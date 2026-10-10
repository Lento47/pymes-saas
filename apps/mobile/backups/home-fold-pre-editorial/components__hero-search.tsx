import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { icon, radius, shadow, space, useTheme } from "@/theme";

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
 * ## A link standing in for a field, sitting on the band
 *
 * `role` is `search` and not `button`, matching what this has always announced: a reader
 * who lands on it should hear "search", not "button, search".
 *
 * The box is a capsule of `card` on the theme band, not a grey-ringed rectangle on the page.
 * White (or the dark card) on chroma *is* the fill; a 1px `input` ring was the boundary a
 * field on `background` owed, and it is the wrong edge here — it turned the home search into
 * a form control sitting on lime. The magnifier and the placeholder are `mutedForeground`,
 * which already holds 4.7:1 on `card`, so the control is identifiable as a glyph plus words
 * rather than as a hairline. `shadow.card` is the lift that separates the pill from the
 * band; `./field` still draws its own ring, because a field on a form is not this object.
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
					shadow.card,
					{
						// The tint is the press signal: the field lifts to the muted surface
						// under the finger. It is a *second* signal — `./pressable` also
						// springs the box to 0.97, which is the default and correct: the field
						// pays `space.lg` of gutter on both sides, so its edges are not the
						// screen's.
						backgroundColor: pressed ? colors.muted : colors.card,
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
		// A capsule on the band, not a sheet corner: `full` is the pill the home fold uses
		// for the one loud control, and a chip is a filter — this is a way in, sized at the
		// heading line, so it cannot be mistaken for one.
		borderRadius: radius.full,
	},
	flex: { flex: 1 },
});
