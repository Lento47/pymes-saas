import { usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import {
	type AccessibilityProps,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";

import { usePurchaseAccent } from "@/lib/purchase-accent";
import { purchaseBand, statusBarStyleForInk } from "@/lib/purchase-colors";
import type { PurchaseStage } from "@/lib/purchase-state";
import { space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { HomeGradient } from "./home-gradient";
import { useRefreshControl } from "./pull-refresh";
import { useTabBarClearance } from "./tab-bar";
import { Text } from "./text";
import type { FluidMotion } from "./top-fluid-gradient";

/**
 * The frame every screen sits in.
 *
 * Safe-area insets are handled here and nowhere else, which is the point of having this
 * component at all: an inset applied per screen is an inset applied on nine screens and
 * forgotten on the tenth, and the tenth is the one with a button under the home indicator.
 * `top` is on for every screen; `bottom` is on only for a screen with nothing pinned to
 * the floor of its own — a form's action bar pays the home indicator itself
 * (`./action-bar`'s docblock), and paying it in both places leaves a 34-point gap above
 * the bar on every phone that has one.
 *
 * **`bottomInset` is also what `./tab-bar` needs to be told.** The floating merchant
 * capsule is `position: "absolute"`, so React Navigation takes it out of the flow that
 * sizes this screen and reserves nothing for it, and the scroll has to reserve the
 * capsule's own footprint or the last row sits under it with no way to scroll out. That
 * number is added to the scroll's own `space.huge` below, and it is `0` on every screen
 * outside `(business)` — where there is no bar at all — so this is one line that changes
 * eighteen screens and leaves the other thirty-odd exactly as they were.
 *
 * `scroll` is a prop rather than two components because the difference between a static
 * screen and a scrolling one is one word at the call site, and two components means the
 * padding drifts between them.
 */

type ScreenProps = AccessibilityProps & {
	title?: string;
	subtitle?: string;
	/**
	 * Chrome that belongs beside the title — a back control, and in this app nothing else so
	 * far. Rendered *above* the title inside the same strip, which is the whole point of the
	 * slot: a leading control is part of the heading, not the first thing in the body.
	 *
	 * It exists because the alternative was a control that renders below the title. The eight
	 * screens that hide the stack header pass their back control as a `child` and that is
	 * correct for them — they draw their own heading inside the scroller, so the control is
	 * already above it. A screen that hands its title to `title` is the other shape: the strip
	 * is drawn outside the scroller and *before* the body, so a child lands under the heading
	 * and a fixed control that should never scroll away ends up in the middle of the column.
	 * Passing the same control through this slot is what makes both shapes place it the same.
	 */
	leading?: React.ReactNode;
	/** Wrap the body in a `ScrollView`. Off for a screen that is a list of its own. */
	scroll?: boolean;
	/** Add the bottom inset. On for a screen whose content ends at the screen's edge. */
	bottomInset?: boolean;
	/** Horizontal padding. Off for a screen that renders edge-to-edge rows. */
	padded?: boolean;
	/**
	 * iOS: let the scroll view pay the keyboard's height as its own content inset, so the
	 * field a customer is typing in stays above the keyboard instead of under it. Off by
	 * default, and only meaningful with `scroll`.
	 *
	 * `automaticallyAdjustKeyboardInsets` is an iOS-only prop — RN 0.86 declares it on
	 * `ScrollViewPropsIOS` and documents it `@platform ios`
	 * (`types_generated/Libraries/Components/ScrollView/ScrollView.d.ts:60-65`), where it
	 * defaults to false. Android has no counterpart and needs none: its window is resized
	 * by the keyboard rather than covered by it, which this app inherits from
	 * `android:windowSoftInputMode="adjustResize"` in the manifest prebuild writes
	 * (`android/app/src/main/AndroidManifest.xml:21`), so the whole screen — this scroll
	 * view included — is already shorter than the keyboard.
	 *
	 * The prop is therefore given a value only on iOS, and `undefined` elsewhere rather than
	 * `false`: React drops an undefined prop, so the Android scroll view never receives the
	 * key at all, which is what "this platform does not implement it" should look like.
	 * A `false` would be a value the platform had to interpret for no reason.
	 *
	 * This is not the same path as `./sheet`'s `KeyboardAvoidingView`
	 * (`sheet.tsx:548`, `behavior={Platform.OS === "ios" ? "padding" : undefined}`), and
	 * the two do not contradict each other: a sheet's panel is not a scroll container and has
	 * no content inset to adjust, so it has to be lifted. A screen that scrolls has one.
	 *
	 * Opt-in rather than always-on, because the inset is a keyboard-shaped change to a
	 * layout that only a screen with a field in it can trigger — a screen that never opens a
	 * keyboard should not carry the branch that assumes one will.
	 */
	keyboardInsets?: boolean;
	/**
	 * Pull to refresh, for a screen whose body is a list that can change while it is on
	 * screen. `docs/design-mobile.md`'s Rule 6 gives the gesture to the customer; this prop is
	 * where a `scroll` screen gets it without building the control itself.
	 *
	 * The control itself is `./pull-refresh`'s, and this prop is a pass-through to it: both
	 * tints, the busy flag owned by the pull rather than by the query, and `undefined` rather
	 * than a control that never refreshes. That file holds the reasoning for all three, which
	 * it can now do once — the eight lines that used to be written out here were also written
	 * out in `./paginated-list`, and each of them had to remember the same three rules.
	 *
	 * Like `keyboardInsets`, this reaches the scroller `Screen` owns and **only** that one:
	 * with `scroll` off the prop is read by nobody. A screen that brings its own scroller calls
	 * `useRefreshControl` itself — `./paginated-list` does, and so does `app/addresses.tsx`.
	 */
	onRefresh?: () => unknown;
	children?: React.ReactNode;
	contentStyle?: ViewStyle;
	background?: React.ReactNode;
	purchaseStage?: PurchaseStage | null;
	fluidMotion?: FluidMotion;
};

export function Screen({
	title,
	subtitle,
	leading,
	scroll = false,
	bottomInset = false,
	padded = true,
	keyboardInsets = false,
	onRefresh,
	children,
	contentStyle,
	background,
	purchaseStage,
	fluidMotion,
	...a11y
}: ScreenProps) {
	const { colors, scheme } = useTheme();
	const pathname = usePathname();
	const inheritedStage = usePurchaseAccent();
	const activeStage =
		purchaseStage === undefined ? inheritedStage : purchaseStage;
	const band = activeStage ? purchaseBand(activeStage, colors, scheme) : null;
	const ambientBackground = activeStage ? (
		<HomeGradient
			scheme={scheme}
			color={colors.primary}
			stage={activeStage}
			bandColor={band?.color}
			backgroundColor={colors.background}
			fluidMotion={fluidMotion}
			compact={pathname !== "/"}
		/>
	) : null;
	const backdrop = background ?? ambientBackground;
	const edges: Edge[] = bottomInset ? ["top", "bottom"] : ["top"];
	// The pull: the control, both tints, its own busy flag, and `undefined` when
	// this screen did not ask for one — all of it in `./pull-refresh`, which is
	// where those three decisions live so that a screen bringing its own scroller
	// gets the same three. See that file for why it is a hook returning an element.
	const refreshControl = useRefreshControl(onRefresh);
	// The capsule floating over this scroll, if there is one. Measured from the bar's own
	// tokens rather than the navigator's reported height, and aware that `bottomInset`
	// above has already spent the home-indicator inset on this screen's behalf.
	const tabClearance = useTabBarClearance({ bottomInsetPaid: bottomInset });
	/**
	 * The scroll's own foot: `space.huge` of page, plus whatever the floating bar over
	 * this screen is covering.
	 *
	 * **Memoised, and it used to be a `StyleSheet` entry.** The number is a runtime value
	 * — it carries the device's bottom inset — so it cannot live in a module-scope object
	 * the way the old `styles.scrollContent` did, and leaving that entry in place as well
	 * would have been two declarations of one gutter with the second always winning.
	 * `useMemo` then buys back the one thing the constant object had: a stable identity
	 * across renders, so React Native is not handed a new `contentContainerStyle` on
	 * every frame of a screen that re-renders on a 5-second poll. `app/(customer)/index`
	 * builds the same expression inline and is the precedent for the shape.
	 */
	const scrollPadding = useMemo(
		() => ({ paddingBottom: space.huge + tabClearance }),
		[tabClearance],
	);

	/**
	 * `contentStyle` comes second, so it wins — and that is deliberate rather than an
	 * accident of array order.
	 *
	 * `padded={false}` is the honest way to ask for edge-to-edge, and it strips the body's
	 * gutter and nothing else. The title strip above pays its own `space.lg` either way —
	 * see `styles.header` — because a title is a heading rather than a row, and a heading
	 * has nothing to gain from reaching the screen's edge.
	 *
	 * `app/orders` is the case that made this a rule rather than a preference: its
	 * rows run edge to edge, so it asks for `padded={false}`, and its title used to follow
	 * the body out to the left edge and sit half a gutter out of line with the segment
	 * control directly under it. A titled screen with a bleeding body is now a shape the
	 * component supports instead of a trap it sets.
	 *
	 * A screen whose *bar* has to reach both edges is a different problem and still cannot
	 * use `padded={false}` naively — `app/cart` says so in as many words, because a bar
	 * reaches the edges or it is not a bar. Putting `padded` last would take that away.
	 *
	 * What a screen must not do is strip the gutter and then forget that the messages it
	 * renders were relying on it. It does not have to: `./empty-state`, `./error-state`, a
	 * labelled `./spinner` and every block in `./skeletons` pay their own
	 * `paddingHorizontal`, so they are inset whoever they are dropped into. A screen that
	 * adds a wrapper around one of them is only narrowing a centred block.
	 */
	const body = (
		<View style={[padded && { paddingHorizontal: space.lg }, contentStyle]}>
			{children}
		</View>
	);

	return (
		<SafeAreaView
			edges={edges}
			style={[styles.root, { backgroundColor: colors.background }]}
			{...a11y}
		>
			{backdrop ? (
				<View style={StyleSheet.absoluteFill} pointerEvents="none">
					{backdrop}
				</View>
			) : null}
			{band ? <StatusBar style={statusBarStyleForInk(band.ink)} /> : null}
			{title ? (
				<View style={styles.header}>
					{leading}
					<Text
						variant="display"
						bold
						style={band ? { color: band.ink } : undefined}
					>
						{title}
					</Text>
					{subtitle ? (
						<Text
							variant="label"
							tone="muted"
							style={[styles.subtitle, band ? { color: band.ink } : null]}
						>
							{subtitle}
						</Text>
					) : null}
				</View>
			) : null}
			{scroll ? (
				<ScrollView
					contentContainerStyle={scrollPadding}
					keyboardShouldPersistTaps="handled"
					// Dragging the form away is how a thumb puts a keyboard down, and the value
					// is a different one on each platform because the platforms are.
					//
					// iOS gets `interactive`: the keyboard follows the finger down and comes
					// back if the drag reverses — `UIScrollViewKeyboardDismissModeInteractive`,
					// mapped in `React/Views/ScrollView/RCTScrollViewManager.m:24`.
					//
					// Android gets `on-drag`, which dismisses as the drag begins and does not
					// track the touch. That is the whole of what Android implements here: RN
					// runs it in JavaScript — `ScrollView.js:1285-1291` calls `dismissKeyboard()`
					// from `onScrollBeginDrag` when the mode is `on-drag` — and the prop's own
					// doc says `interactive` "is not supported [on Android] and it will have the
					// same behavior as 'none'" (`ScrollView.js:470-487`), i.e. a keyboard that
					// only a back key could put away. Neither platform is handed a value it does
					// not implement.
					keyboardDismissMode={
						Platform.OS === "ios" ? "interactive" : "on-drag"
					}
					// iOS only, and `undefined` rather than `false` off it — the prop's own
					// docblock says why. The platform check lives here so that no screen has to
					// know which platform it is on to ask for the inset.
					automaticallyAdjustKeyboardInsets={
						Platform.OS === "ios" ? keyboardInsets : undefined
					}
					// Zero, and deliberately: the merchant capsule is a *floating* bar, so an
					// indicator that runs under it is the bar doing what a floating bar does
					// rather than a rendering bug. The old docked bar sat inside the bottom
					// inset, which is the only case where the indicator had to stop short.
					scrollIndicatorInsets={{ bottom: 0 }}
					refreshControl={refreshControl}
				>
					{body}
				</ScrollView>
			) : (
				body
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	// The gutter is unconditional, and `padded` deliberately does not reach it: a title is a
	// heading, and `padded={false}` exists for rows that bleed. See the docblock above.
	header: {
		paddingTop: space.md,
		paddingBottom: space.sm,
		paddingHorizontal: space.lg,
	},
	subtitle: { marginTop: space.xs },
});

/**
 * The line a screen renders when it has nothing to show and that is fine.
 *
 * Not a `<Text>` — it is a small composition (a heading, a sentence, an optional button)
 * and it appears on five screens with the same spacing every time.
 */
export function ScreenSection({
	title,
	subtitle,
	action,
	children,
}: {
	title: string;
	/**
	 * The line under the heading that says what the section is for.
	 *
	 * A caption, muted, and one line deep by preference rather than by constraint — it wraps
	 * at the reader's text size like everything else. It exists because a heading that names a
	 * group of fields ("Basic information", "Pricing") asks a question the group itself
	 * answers only by being filled in, and one sentence beside it is cheaper than leaving the
	 * reader to infer it.
	 */
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<View style={sectionStyles.wrap}>
			<View style={sectionStyles.head}>
				<View style={sectionStyles.headings}>
					<Text variant="heading" bold>
						{title}
					</Text>
					{subtitle ? (
						<Text variant="caption" tone="muted">
							{subtitle}
						</Text>
					) : null}
				</View>
				{action}
			</View>
			{children}
		</View>
	);
}

const sectionStyles = StyleSheet.create({
	wrap: { marginTop: space.xxl },
	head: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: space.md,
		/**
		 * The second of this component's two spacings, and it is load-bearing for the
		 * fifty-odd call sites that pass no `subtitle` — dropping it once took 12 points
		 * out of every section heading in the app, and `app/(business)/menu.tsx:563`
		 * still names both of these in a comment because its skeleton restates them.
		 * `minHeight` went with it and is not missed: a heading with no help line is one
		 * text row tall, so the row is the text and the margin is the only air there was.
		 */
		marginBottom: space.md,
	},
	// The heading and its line as one column, so `action` beside them stays aligned to the
	// heading's own first line rather than to the middle of both.
	headings: { flex: 1, gap: TEXT_STACK_GAP },
});
