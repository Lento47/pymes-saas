import Ionicons from "@expo/vector-icons/Ionicons";
import type { Tabs } from "expo-router";
import type { ReactNode } from "react";
import {
	Platform,
	type StyleProp,
	StyleSheet,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/pressable";
import { CAPSULE_HEIGHT, CAPSULE_LIFT, radius, useTheme } from "@/theme";

/**
 * The floating capsule: one tab bar, used by both trees.
 *
 * It was inline in `app/(business)/_layout.tsx` and it is here now because the customer tree
 * needs the same bar. It was extracted rather than copied for the reason the merchant one was
 * written as a named helper in the first place: **two capsules are two capsules that drift**,
 * and the drift is invisible until a screen is narrower than the one either was measured on.
 *
 * ## The shape
 *
 * A 320pt pill floating 12pt above the home-indicator inset on a 390 viewport, icons only, no
 * labels. `position: "absolute"` takes it out of the navigator's flex flow, so it overlays the
 * last stretch of every screen in its tree and each one reserves `TAB_BAR_CLEARANCE` for it —
 * `useTabBarClearance` in `./tab-bar`. The bar floats; the layout does not move.
 *
 * No native blur: `expo-blur` is not in this stack, so the capsule is an opaque card at 94%
 * with the specified shadow rather than glass. Deliberate fallback, not a gap — blur would be
 * decoration on a bar whose edge the hairline already draws.
 */

/**
 * The bar's translucency.
 *
 * Applied here because the palette holds no alpha colours (`./merchant-pulse` records the same
 * constraint). The surface is read from `colors.card`, so the bar follows the palette; the one
 * number that is not a token is the 94%, and it is named beside the line that owns the decision
 * rather than spelled into a literal — a re-typed hex would stop following the palette the day
 * the card token moved.
 */
const BAR_OPACITY = 0.94;

/** 320 on a 390 viewport: the capsule's specified width. */
const CAPSULE_WIDTH = 320;

/**
 * The lift shadow, `0 4 12 rgba(0,0,0,.07)`, expressed the way each platform wants it — the
 * same split `theme/tokens.ts` draws for `shadow`, stated here because no shared step carries
 * this exact diffusion.
 *
 * Small and light on purpose: the edge itself is the hairline in `tabBarStyle`, so the shadow
 * only lifts. A 30-blur mass read as grey dirt on a white page, and Android's elevation
 * renders with no blur at all.
 */
const CAPSULE_SHADOW =
	Platform.OS === "web"
		? { boxShadow: "0px 4px 12px rgba(0,0,0,0.07)" }
		: {
				shadowColor: "#000000",
				shadowOpacity: 0.07,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 4 },
				elevation: 2,
			};

/** The selected disc, 52 square: 9 points of breathing room inside the 70 bar. */
const TAB_DISC = 52;

/** `#FFFFFF` + 0.94 → `rgba(255,255,255,0.94)`. Hex in — every `ThemeColors` value is. */
function withAlpha(hex: string, alpha: number): string {
	const value = hex.replace("#", "");
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * One tab's mark: a fixed disc in both states, with the selected dot arriving on focus.
 *
 * Exported because a caller's `tabBarIcon` has to build it, and a second copy of this disc is a
 * second copy of the 52, the dot's offset and the hairline — three numbers that decide how the
 * selected tab looks and none of which anything else would notice had they drifted apart.
 */
export function TabMark({
	focused,
	name,
	color,
}: {
	focused: boolean;
	name: React.ComponentProps<typeof Ionicons>["name"];
	color: React.ComponentProps<typeof Ionicons>["color"];
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.mark,
				// Hairline edge, no shadow: white on near-white separates with a crisp line,
				// and a second shadow inside the bar's own read as dirt.
				focused && {
					backgroundColor: colors.card,
					borderWidth: StyleSheet.hairlineWidth,
					borderColor: colors.border,
				},
			]}
		>
			<Ionicons
				name={name}
				// Explicit 24: the navigator hands 22-24 and the contract never named
				// one, so the two states would differ by whatever it happened to pass.
				size={24}
				color={color}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			{/* The dot is *pinned*, not stacked below the glyph, so landing on a tab
			    never shifts the icon by the dot's height. */}
			{focused ? (
				<View
					style={[styles.dot, { backgroundColor: colors.primary }]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : null}
		</View>
	);
}

/**
 * The plain-options form of `screenOptions`, which is the one this returns.
 *
 * `<Tabs>` accepts an object *or* a function of the route and navigation, and this is the
 * object. `Extract<…, object>` picks it out by shape rather than by subtracting `Function`,
 * which `noBannedTypes` rightly refuses and which would also throw away a future object-like
 * option type by accident.
 *
 * **Derived from `<Tabs>` itself rather than written out**, and that is the whole reason it
 * compiles. This object was inline in the merchant layout, where the JSX gave it its type
 * contextually — including `tabBarButton`, whose props the navigator types as a press handler
 * taking a gesture event. Hand-written, those props had to be spelled, and the honest spelling
 * is `() => void` (the app's `Pressable` wants no event), which is *narrower* than what the
 * navigator passes and is therefore rejected. A cast inside the body fixes the call; it does
 * not fix the signature. Deriving it means the next navigator option is checked here too,
 * with no second place to update.
 */
type CapsuleScreenOptions = Extract<
	NonNullable<React.ComponentProps<typeof Tabs>["screenOptions"]>,
	object
>;

/**
 * The `screenOptions` both trees pass to `<Tabs>`.
 *
 * A hook rather than a constant because three of these are measured against the device
 * (`windowWidth` for the capsule's centring) or the safe area (`insets.bottom` for its lift),
 * and a module-level object would freeze both at import time — correct on the phone it was
 * written on and wrong on every other one.
 *
 * The `use` prefix is load-bearing rather than decorative: it reads the theme and two device
 * measurements, and `rules-of-hooks` — which biome enforces here, correctly — only permits
 * that in something named `use*`. Called as a plain `capsuleScreenOptions()` from a layout
 * component it would be a hook call in a non-hook, and the lint would be right to say so.
 */
export function useCapsuleScreenOptions(): CapsuleScreenOptions {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const { width: windowWidth } = useWindowDimensions();

	return {
		headerShown: false,
		// The navigator's own tab button answers a press with a wide circular wash; ours
		// answers with the control's rounded frame, the same feedback every other control in
		// the app gives. Only the press, the a11y and the laid-out style cross over — the web
		// pointer handlers and the link props stay behind. The cast drops the event the
		// navigator's press carries (a web `MouseEvent` in a union that cannot occur on a
		// phone); navigation needs no event, and the primitive's contract stays the
		// `() => void` every other caller holds.
		tabBarButton: ({
			onPress,
			onLongPress,
			accessibilityState,
			accessibilityLabel,
			style,
			children,
		}) => (
			<Pressable
				onPress={onPress as (() => void) | undefined}
				onLongPress={(onLongPress ?? undefined) as (() => void) | undefined}
				// No Android ripple: a bounded ripple takes the button's rectangular frame
				// (this item is ~80x70), so every tap flashed a grey square. The press still
				// answers with the primitive's spring and dim — the same feedback iOS gets, on
				// both platforms.
				ripple={false}
				accessibilityState={accessibilityState}
				accessibilityLabel={accessibilityLabel}
				// Centred, because the primitive floors the box and aligns nothing — an
				// uncentred disc pins to the top of the 70pt button and the icons read high
				// with dead air beneath them.
				style={[
					{ alignItems: "center", justifyContent: "center" },
					style as StyleProp<ViewStyle>,
				]}
			>
				{children as ReactNode}
			</Pressable>
		),
		tabBarActiveTintColor: colors.foreground,
		tabBarInactiveTintColor: colors.mutedForeground,
		tabBarStyle: [
			{
				position: "absolute",
				left: 0,
				right: 0,
				marginHorizontal: Math.max(0, (windowWidth - CAPSULE_WIDTH) / 2),
				height: CAPSULE_HEIGHT,
				// Inset outside the bar, never inside it: paddingBottom here is the exact
				// bug — dead air under the icons. Both physical edges are zeroed explicitly
				// because a vertical shorthand does not reliably cancel an explicit bottom
				// edge the navigator sets itself.
				paddingTop: 0,
				paddingBottom: 0,
				paddingVertical: 0,
				alignItems: "center",
				justifyContent: "center",
				bottom: insets.bottom + CAPSULE_LIFT,
				borderRadius: radius.full,
				backgroundColor: withAlpha(colors.card, BAR_OPACITY),
				// Hairline, not shadow mass: the crisp edge, drawn in the palette's own
				// hairline so it survives theme and platform.
				borderWidth: StyleSheet.hairlineWidth,
				borderColor: colors.border,
			},
			CAPSULE_SHADOW,
		],
		// Each tab takes the capsule's full height and centres its own content: no label
		// slot, no inherited paddingBottom, no safe-area inset inside the bar — the inset
		// lives outside, in `bottom` above. Selected and unselected share the one
		// centerline; the dot is absolute and moves nothing.
		tabBarItemStyle: {
			flex: 1,
			height: "100%",
			alignItems: "center",
			justifyContent: "center",
			paddingVertical: 0,
			// Optical correction from the device screenshot: the row reads ~3pt high. 6pt
			// here moves the shared centerline down 3 with air to spare on both sides —
			// revisit, do not stack, if the underlying inset changes.
			paddingTop: 6,
		},
		// Neutralize any icon-wrapper offset the navigator brings: margins or padding here
		// would lift the glyph off the shared centerline the 52 discs are measured against.
		tabBarIconStyle: {
			marginTop: 0,
			marginBottom: 0,
			paddingTop: 0,
			paddingBottom: 0,
		},
		// Icon-only bar: the words live in each tab's `tabBarAccessibilityLabel`, so
		// nothing spoken is lost when nothing printed remains.
		tabBarShowLabel: false,
	};
}

const styles = StyleSheet.create({
	// Fixed 52 square in both states, so selection never reflows the bar: the disc is
	// always there, and only its fill, lift and dot arrive on focus. The glyph is centred
	// alone — the dot is pinned, not stacked, so landing on a tab never shifts the icon.
	mark: {
		position: "relative",
		width: TAB_DISC,
		height: TAB_DISC,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	dot: {
		position: "absolute",
		bottom: 10,
		alignSelf: "center",
		width: 4,
		height: 4,
		borderRadius: radius.full,
	},
});
