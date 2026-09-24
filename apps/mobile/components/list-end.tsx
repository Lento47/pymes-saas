import { StyleSheet, View, type ViewStyle } from "react-native";

import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";

/**
 * The foot of a paginated list: the next page, or the end of them.
 *
 * Six lists in this app paginate — `app/featured`, `app/nearby`, `app/category/[slug]`,
 * `app/store/[slug]` twice (the menu and the reviews under it) and `app/orders` — and
 * all six used to end the same way:
 *
 * ```tsx
 * {items.hasNextPage ? <Button label={…} loading={…} onPress={…} /> : null}
 * ```
 *
 * The `null` is the defect. A customer who has read to the bottom of a filtered list sees the
 * button disappear, and nothing distinguishes *"that was everything"* from *"the next page
 * failed and the footer went quiet"* — the same blank space, from two different situations,
 * one of which they should retry. The cursor already knows which; it was the only thing that
 * did, and it was being thrown away.
 *
 * ## It owns the row count as well as the cursor, and that is not a convenience
 *
 * `rows` is the number of items the caller has actually rendered. At zero this returns `null`
 * rather than the end statement, because an empty list is not a list that ended: the screens
 * that can be empty all render `./empty-state` for that case, and a "nothing more to show"
 * line underneath it would be a second, contradictory answer to the same question. Without
 * this the guard is a thing every call site has to remember, and one of the six would not.
 *
 * ## Both labels come from one place, and that is also a fix
 *
 * The button reads `action.loadMore` and the end reads `state.listEnd`. Before this component
 * the same control was drawn with two different labels — `order.loadMore` ("Ver más") on three
 * browse lists and `action.loadMore` ("Cargar más") on the storefront and its reviews, so the
 * menu and the reviews directly beneath it disagreed about what the identical button was
 * called. Holding the label here is what makes that class of drift impossible rather than
 * merely fixed.
 *
 * ## Not a live region, deliberately
 *
 * The swap from button to end statement happens because the reader tapped the button, and the
 * button's own `loading` state is what covers the wait — so there is no unreported change
 * here. Making the statement a live region would mean adding `accessibilityLiveRegion` for
 * Android *and* an `AccessibilityInfo.announceForAccessibility` call gated on
 * `Platform.OS === "ios"` for iOS, because the two are alternatives and not layers: on Android
 * the live region announces, on iOS the explicit call does (`./toast`, `./rollback-notice` and
 * `./error-state` each state the rule). That pair buys an announcement of a fact the reader
 * just caused, at the price of the same sentence read twice the day somebody adds the other
 * half without reading this. Nothing here needs saying out loud, so nothing here says it.
 */
export function ListEnd({
	rows,
	hasNextPage,
	loading,
	onPress,
	style,
}: {
	/** How many items the caller rendered. Zero means the list is empty, not finished. */
	rows: number;
	hasNextPage: boolean;
	loading: boolean;
	onPress: () => void;
	/** Placement only — the gutter below belongs to this component, like `./empty-state`'s. */
	style?: ViewStyle;
}) {
	const { t } = useT();

	if (rows === 0) return null;

	return (
		<View style={[styles.pad, style]}>
			{hasNextPage ? (
				<Button
					label={t("action.loadMore")}
					loading={loading}
					onPress={onPress}
				/>
			) : (
				<Text variant="caption" tone="muted" style={styles.end}>
					{t("state.listEnd")}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	pad: {
		paddingHorizontal: space.lg,
		paddingTop: space.md,
		paddingBottom: space.lg,
	},
	// Centred, because it is a statement about the list rather than a row in it — and the
	// button above it is full width, so a left-aligned line underneath would read as a
	// fragment of the previous row.
	end: { textAlign: "center" },
});
