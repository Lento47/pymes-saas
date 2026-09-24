import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import {
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";

import { useT } from "@/lib/i18n";
import { icon, radius, space, useTheme } from "@/theme";

import { Image } from "./image";

/**
 * A product's photographs, as a pager.
 *
 * `productDetailSchema` carries two image fields and they are not the same field: `imageUrl`
 * is the product's cover — the column a card renders — and `images` is the shop's own array,
 * which `productCreateSchema` caps at eight. The product page drew one picture, `imageUrl ??
 * images[0]`, so a shop that uploaded eight photographs had seven of them unreachable. This
 * draws all of them, cover first, and it is `./image` on every page: the box is the right size
 * before the picture arrives, the placeholder is `muted`, and nothing spins inside it.
 *
 * ## One page is not a pager
 *
 * A dot row over a single photograph is chrome explaining a gesture that does not exist. One
 * image draws the image; two or more draw the dots. That is why `pages.length > 1` guards the
 * row rather than a prop.
 *
 * ## The dots say which page without colour
 *
 * The active dot is *wider* — a pill against a dot — so the position survives a greyscale
 * screenshot and a colour vision deficiency, which a tint alone does not. The row itself is
 * hidden from the accessibility tree, because every page already carries its own position in
 * its label and dots announced beside them would say the same thing twice. Nothing here
 * animates, so there is no motion for the reduced-motion setting to turn off.
 *
 * ## Sizing, and the one frame it costs
 *
 * `style` is required and it is the screen's: the same rule as `./image`, where a caller owns
 * the box and the primitive owns the colour, the corner and the clip. The pages are as wide as
 * the box, which is measured from `onLayout` rather than read from `Dimensions`, because the
 * box the screen draws is not the window — the product page insets this by `space.lg` on each
 * side. Until that measurement lands the pages are zero-width, so the first frame shows the
 * box's `muted` placeholder and the second shows the picture; there is no width this file could
 * assume in the meantime without being wrong on some screen.
 *
 * ## No image at all
 *
 * An empty page list — no `imageUrl` and no `images` — is `./image`'s own placeholder at the
 * same box and the same corner, with the stand-in glyph `./product-row` draws inside a media
 * box that has no photograph. A shop with no picture gets the composed surface the design doc
 * asks for, never a grey rectangle standing in for a photograph that does not exist.
 *
 * The pager is a `ScrollView` with `pagingEnabled`, which is the platform's own snap: no
 * gesture library, no dependency, and the native scroll physics the rest of the app has.
 */

type GalleryProps = {
	/** `productDetailSchema.imageUrl` — the cover, drawn first. */
	coverUrl?: string | null;
	/** `productDetailSchema.images` — the shop's order, after the cover. */
	images?: string[];
	/**
	 * The box one page is drawn in, from the screen. Required: a pager with no height is a
	 * pager that is not on screen.
	 */
	style: StyleProp<ViewStyle>;
};

export function Gallery({ coverUrl, images, style }: GalleryProps) {
	const { t } = useT();
	const { colors } = useTheme();
	const [pageWidth, setPageWidth] = useState(0);
	const [page, setPage] = useState(0);

	/**
	 * Cover first, then the shop's array, without duplicates.
	 *
	 * The two fields overlap in practice — a shop that sets a cover and also lists it among its
	 * photographs sends the same URL twice — and a duplicate page shows one picture twice while
	 * the dots claim two, which is the pager telling the reader there is more to see than there
	 * is. The set keeps the first occurrence, so the cover stays the first page.
	 */
	const pages = useMemo(() => {
		const seen = new Set<string>();
		for (const url of [coverUrl, ...(images ?? [])]) {
			if (url) seen.add(url);
		}
		return [...seen];
	}, [coverUrl, images]);

	if (pages.length === 0) {
		return (
			<Image
				uri={null}
				style={style}
				radiusToken="lg"
				accessibilityElementsHidden
			>
				<Ionicons
					name="image-outline"
					size={icon.action}
					color={colors.mutedForeground}
				/>
			</Image>
		);
	}

	const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		// Nothing to divide by until the box has been measured; the pages are laid out a frame
		// later and this runs on a scroll, which cannot precede that.
		if (pageWidth <= 0) return;
		const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		setPage(Math.min(Math.max(next, 0), pages.length - 1));
	};

	return (
		<>
			<View
				style={style}
				onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
			>
				<ScrollView
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onMomentumScrollEnd={onSettle}
					style={styles.pager}
				>
					{pages.map((uri, index) => (
						<Image
							key={uri}
							uri={uri}
							style={[styles.page, { width: pageWidth }]}
							radiusToken="lg"
							// The position is the one thing a static picture cannot say for itself, and
							// a reader who cannot see the dots has no other way to know how many of
							// these there are or where this one sits.
							accessibilityLabel={t("gallery.image.label", {
								index: index + 1,
								count: pages.length,
							})}
						/>
					))}
				</ScrollView>
			</View>

			{pages.length > 1 ? (
				<View
					style={styles.dots}
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					{pages.map((uri, index) => (
						<View
							key={uri}
							style={[
								styles.dot,
								index === page ? styles.dotActive : null,
								{
									backgroundColor:
										index === page ? colors.primary : colors.border,
								},
							]}
						/>
					))}
				</View>
			) : null}
		</>
	);
}

const styles = StyleSheet.create({
	// The pager fills the box the caller sized; `./image` inside each page fills the pager's
	// height, so the box's aspect ratio is the screen's and the pages cannot disagree with it.
	pager: { flex: 1 },
	page: { height: "100%" },
	// Under the picture, and inside the primitive: the gap belongs to this component the way a
	// button's own padding does, not to the screen that placed it.
	dots: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
		paddingTop: space.sm,
	},
	dot: {
		width: space.sm,
		height: space.sm,
		borderRadius: radius.full,
	},
	// A pill, not a brighter dot: the active page is a different shape as well as a different
	// colour, so the row still reads with both greys. See the docblock.
	dotActive: { width: space.xl },
});
