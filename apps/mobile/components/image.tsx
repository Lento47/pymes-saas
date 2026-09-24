import { useEffect, useState } from "react";
import {
	type AccessibilityProps,
	type ImageResizeMode,
	Image as RNImage,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { IMAGE_FADE } from "@/lib/motion";
import { radius, useTheme } from "@/theme";

/**
 * A picture, with the box it is going to be.
 *
 * The layout already knows how large the picture is — a thumbnail is 60 points because the
 * row says so — so the box is drawn first in `muted`, in the right size and the right
 * corner, and the picture fades in over it when it loads. There is **no spinner inside an
 * image, ever**: a spinner would be a second, smaller thing to look at in a space whose
 * size is already known, and the placeholder is that space.
 *
 * A picture that fails leaves the box exactly as it was. That is the honest failure here —
 * the row keeps its shape, and a broken thumbnail is not worth an error message.
 *
 * ## What the caller owns
 *
 * Size, and any border the surface wants, through `style`. The primitive owns the `muted`
 * placeholder, the corner, the clip and the fade. `children` renders inside the box for the
 * case where there is no `uri` at all: an icon, not a spinner.
 *
 * It also owns the accessibility props, and they are the **box's** rather than the
 * picture's. A caller that hides a decorative thumbnail, or names a picture, is talking about
 * this space — and the space is the only thing present when there is no `uri`, which is the
 * case `children` exists for. So they are spread on the wrapper and the image inside is
 * `accessible={false}`; see the render below.
 *
 * The fade survives reduced motion deliberately. It is opacity, not movement — the reader
 * is not being moved anywhere, and `docs/design-mobile.md` keeps opacity precisely because
 * a crossfade still answers "did it register" once every transform is gone.
 */

const AnimatedImage = Animated.createAnimatedComponent(RNImage);

type ImageProps = AccessibilityProps & {
	uri?: string | null;
	/** Layout and any border. Colour, corner and clipping are the primitive's. */
	style?: StyleProp<ViewStyle>;
	resizeMode?: ImageResizeMode;
	/** The corner, named by token. `sm` is the control radius a thumbnail uses. */
	radiusToken?: keyof typeof radius;
	/** Drawn instead of a picture when there is no `uri`. */
	children?: React.ReactNode;
};

export function Image({
	uri,
	style,
	resizeMode = "cover",
	radiusToken = "sm",
	children,
	...a11y
}: ImageProps) {
	const { colors } = useTheme();
	// The uri that finished loading, rather than a boolean. A recycled row hands this
	// component a second `uri`, and comparing the two is what makes the old picture leave:
	// a plain `loaded` flag would stay true and the new picture would appear as a jump.
	const [loadedUri, setLoadedUri] = useState<string | null>(null);
	const shown = uri !== null && uri !== undefined && loadedUri === uri;
	const fade = useSharedValue(0);

	useEffect(() => {
		fade.value = withTiming(shown ? 1 : 0, { duration: IMAGE_FADE });
	}, [fade, shown]);

	const animated = useAnimatedStyle(() => ({ opacity: fade.value }));

	return (
		<View
			// The a11y props belong to the **box**, not to the picture, and they used to sit on
			// the picture alone. The box is the element that exists on both paths: with no `uri`
			// there is no image to carry them, and `children` — the caller's icon — still
			// renders, so the props were silently dropped on exactly the path that has something
			// to hide. `./gallery` relies on this: it passes `accessibilityElementsHidden` for
			// the stand-in it draws inside a media box holding no photograph, and on Android
			// that prop never reached the node the icon was in.
			{...a11y}
			// Decoration by default and content only when it has been given a name: a thumbnail
			// beside the product's own title would otherwise be announced as an unlabelled image
			// on every row of a menu. On the wrapper this also *groups* — a labelled box is one
			// element, which is what a picture with a caption over it should be.
			accessible={a11y.accessibilityLabel !== undefined}
			style={[
				styles.box,
				{ backgroundColor: colors.muted, borderRadius: radius[radiusToken] },
				style,
			]}
		>
			{uri ? (
				<AnimatedImage
					source={{ uri }}
					resizeMode={resizeMode}
					onLoad={() => setLoadedUri(uri)}
					onError={() => setLoadedUri(null)}
					style={[styles.image, animated]}
					// The label, if there is one, is the box's — see above. Without this the
					// picture would be a second element inside the box that announced the same
					// thing, or, worse, an unlabelled one of its own on the decorative path.
					accessible={false}
				/>
			) : null}
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	box: {
		alignItems: "center",
		justifyContent: "center",
		// The picture is placed absolutely, so the box is sized by its `style` alone — which
		// is the point: the space exists before the picture does. This also clips a picture
		// to the corner rather than letting a square one flash past it.
		overflow: "hidden",
	},
	image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
