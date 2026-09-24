import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";

import { space } from "@/theme";

/**
 * A row of surfaces that scrolls sideways, and the width each one gets.
 *
 * The shell `./product-rail` and `app/index`'s offer banner are both made of: a horizontal
 * `ScrollView` with no indicator, the screen's own gutter on both ends, and a gap between
 * items. It is a component rather than a copy because the two rails differ in exactly two
 * things — which card they map and how wide it is — and everything else about them has to
 * agree or the two bands on one screen stop lining up.
 *
 * ## The gutter is the rail's, not the screen's
 *
 * `./category-rail` pays its own horizontal padding so the first card starts at the screen's
 * gutter and the last one can still be scrolled clear of the bezel. A rail that trusted its
 * caller would be flush to the left edge on the one screen that forgot — and on the feed it
 * would be the *second* rail that forgot, because the two are separate call sites.
 *
 * The space *above* a rail stays the caller's, for `./category-rail`'s reason: the feed puts
 * a section heading there and a storefront puts something else, so a rail carrying its own
 * top margin would be right in one place and wrong in the other.
 *
 * ## The width is a ratio of the window, and the peek is the point
 *
 * A fixed width would be two cards on a small phone and six on a tablet. A ratio under 1
 * keeps the next card partly visible, which is the only thing telling the reader the row
 * scrolls — a rail whose last visible card ends exactly at the bezel reads as a row that has
 * finished. Each rail passes its own ratio and says why: a tile's width is set by its
 * photograph and a coupon's by the longest of its three sentences.
 *
 * The width is **not** floor-clamped against the type scale, deliberately: a card's height
 * grows with its text and its box grows sideways with the device, so the two never have to
 * agree. What a wider device gets is more cards per screen, which is what a wider device is
 * for.
 */
export function Rail({
	ratio,
	children,
}: {
	/** Item width as a fraction of the window, under 1 so the next one peeks. */
	ratio: number;
	/** The items, already mapped — each is expected to take the width this hands back. */
	children: (width: number) => React.ReactNode;
}) {
	const { width } = useWindowDimensions();

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.rail}
		>
			{children(width * ratio)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	rail: { paddingHorizontal: space.lg, gap: space.md },
});
