import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BackHandler,
	KeyboardAvoidingView,
	type LayoutChangeEvent,
	Platform,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	cancelAnimation,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { duration, exitDuration, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * A panel that comes up from the bottom of the screen and can be dragged.
 *
 * This is the phone's answer to a page that would otherwise be pushed: a product's options,
 * a set of filters, the cart. It keeps the screen behind it visible — which matters here,
 * because the thing being chosen is usually *on* that screen — and it is the one place a
 * gesture is the interaction rather than a shortcut, so it is the one component that has to
 * get a gesture right.
 *
 * ## Snap points, and why they are fractions
 *
 * `snapPoints` are fractions of the screen's height, ascending: `[0.5, 1]` is half then
 * full. They are ratios of the *device* and not of the app's rhythm, which is why they are
 * not `space` steps — 50% of an iPhone SE and 50% of a Pro Max are the same decision about
 * the layout, and a point value would be two. The heights are resolved on every render from
 * `useWindowDimensions`, so a rotation or a split view re-snaps instead of leaving the sheet
 * hanging at a height the screen no longer has.
 *
 * A fraction is a fraction of the *screen*, and this panel is not the size of the screen: it
 * is content-sized (`bottom: 0`, no height), so at rest it occupies `panelHeight` and its top
 * edge sits at `height - panelHeight`. A fraction asks for that top edge at
 * `height * (1 - fraction)`, so the offset is what closes the gap between where the panel's
 * top edge *is* and where the fraction says it should be:
 *
 *     Math.max(0, height * (1 - fraction) - (height - panelHeight))
 *
 * The `max(0, …)` is the full snap: `1` would otherwise ask for a negative offset, and a
 * panel cannot be pushed above the top of the screen. The form this file used before —
 * `height * (1 - fraction)` on its own — is the same number only when the panel happens to be
 * as tall as the screen, which is the one case `snapPoints={[1]}` ever reaches. For
 * `[0.5, 1]` on a 300pt panel it put the sheet's top edge 300pt below where the fraction
 * named it, so the sheet never rested where the prop said it would.
 *
 * `panelHeight` is the panel's own `onLayout`. The panel stays offscreen until it has one:
 * before the first layout pass there is no offset that means anything, and settling on the
 * unmeasured number would place the sheet wrong for a frame and then slide it to the right
 * place. The cost is that the entrance starts one layout pass later than it used to — the
 * panel is offscreen for that pass, so nothing is ever seen in the wrong place, but the
 * first frame of the spring is a frame later than before.
 *
 * ## The body scrolls, and the drag belongs to the handle
 *
 * `maxHeight` is the screen minus the top inset — a panel taller than that would run its
 * handle under the status bar — so content past it is clipped. It used to be clipped with no
 * way to reach it: the pan wrapped the whole panel and the body did not scroll. Dynamic Type
 * is the case that finds this. Reported from use: the category filter sheet fits a 667pt SE
 * at 1× and clips at the larger text scales, and `docs/design-mobile.md`'s "a layout survives
 * 200% text on the smallest supported device" is not a rule that stops applying because the
 * surface is a sheet. The 44pt floor is in the same arithmetic: a control that grows to keep
 * its target at 200% makes a panel that much taller.
 *
 * Of the two standard fixes this takes **the body gets a scroll view**, and pays for it by
 * confining the drag to the handle. The alternative — a pan on the panel that also contains a
 * scroll — is gesture composition, and composition is the half of this that cannot be
 * reasoned about from a desk: whether the panel moves or the list does turns on which gesture
 * won, on the platform, and on whether the list was already at its top. The file's own note
 * said as much before either fix existed. Two regions with one gesture each has no such
 * question: the handle's strip is 44pt across the top of the panel and never scrolls, and
 * every point below it belongs to the scroll view.
 *
 * The trade-off accepted, and it is real: **a swipe down that starts on the body no longer
 * dismisses the sheet** — only one that starts on the handle does. That is the platform's own
 * arrangement for a sheet whose content scrolls, the backdrop is still a full-screen target
 * announced as `closeLabel`, and the footer's action is untouched, but the gesture
 * vocabulary did change and it changed here rather than by accident.
 *
 * ## The gesture
 *
 * Dragging is a spring from `lib/motion` and not a duration, because a finger can reverse
 * mid-flight and a duration cannot. Three things end a drag: released near a lower snap
 * point, released past the lowest one, or thrown down hard — the last is what makes the
 * gesture feel like it agreed with the reader rather than with a threshold.
 *
 * ## Reduced motion
 *
 * With it on, the sheet does not travel: it is placed at its snap point and the backdrop
 * crossfades over `instant`. *Placed* is the load-bearing word — every branch of this file
 * that writes `translateY` under the setting assigns a value and none of them animates one:
 * `settle`, which is both the open and a drag released onto a snap point, and **both** exits.
 * The exits are the pair this file used to get wrong: the effect that runs when `open` goes
 * false ignored the setting outright and played `exitDuration(duration.sheet)` — 224ms — and
 * the drag's throw-down played the same 224ms, over `height`, which is the panel's own full
 * travel and the largest single movement in the app. A shorter curve is not a smaller
 * distance, so a `withTiming` at any duration was the wrong answer; the panel now leaves in
 * the frame it was dismissed in, and the backdrop's `instant` opacity is what still answers
 * the reader.
 *
 * The drag still *works* — a gesture that silently stopped responding would be a worse
 * accessibility failure than the movement it avoided — it simply settles without a spring.
 * Nothing about the sheet is conveyed only by movement: it is visible, it is on top, and
 * `accessibilityViewIsModal` says so.
 *
 * ## No portal: it renders exactly where it is mounted
 *
 * This is not rendered into a root-level host. It is an absolutely-positioned view inside
 * whatever its screen put it in, so it inherits that parent's coordinate space, its clipping
 * and its paint order. Four consequences, roughly in the order a screen hits them:
 *
 * - **Inside a scroll container, it scrolls.** `StyleSheet.absoluteFill` resolves against the
 *   nearest parent view, so a sheet mounted inside a `ScrollView`'s content is laid out *in*
 *   the content and scrolls away from the screen it is covering. Mount it as a sibling of the
 *   scroll — which is what `app/category/[slug]` and `app/cart` do, and why `PromoInput` and
 *   `PromoSheet` are two components rather than one.
 * - **Under a transformed or animated ancestor, it moves with it.** A screen-level entrance
 *   that rises, scales or fades its children takes the panel with it, and the scrim then
 *   covers that ancestor's box instead of the screen. Anything that animates a screen wraps
 *   the screen's *content* and leaves the sheet outside it.
 * - **A parent that clips, clips the panel.** `overflow: "hidden"` on an ancestor — or a
 *   parent without `flex: 1`, whose height is then a row's rather than the screen's — cuts the
 *   sheet off, and nothing in here can detect that it happened.
 * - **A later sibling paints over it.** There is no z-index contract and no portal to escape
 *   one, so a sheet mounted *before* a pinned bar, a floating button or another overlay is
 *   drawn underneath it. The sheet belongs last in the screen's root.
 *
 * What it does not inherit is the tab bar or a navigator header: those are siblings of the
 * whole screen, so a sheet cannot cover them however it is mounted.
 *
 * ## What it does not do
 *
 * No nested sheets, no `onDismiss`-only presentation, and no scroll synchronisation between
 * the body and the panel — the body scrolls and the panel does not follow it, which is the
 * choice made above rather than an omission. A body *shorter* than its snap point is still a
 * snap point that should be smaller: the scroll view makes a longer body usable, it does not
 * make a short one right.
 *
 * The drag is not announced to a screen reader. What it reaches is reached another way — the
 * body scrolls, the backdrop closes, the footer acts — so nothing is available *only* by
 * dragging, which is the condition for leaving it out of the accessibility tree.
 */

/** The drag handle: 36 by 4, the platform's own affordance size, not a layout decision. */
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;

/** How far a release must be past the lowest snap, in points, before it means "close". */
const CLOSE_DISTANCE = 72;

/** Downward velocity, in points per second, that counts as a throw rather than a release. */
const CLOSE_VELOCITY = 800;

type SheetProps = {
	open: boolean;
	onClose: () => void;
	/** A heading for the sheet. Announced as the modal's label when there is no `label`. */
	title?: string;
	/** Required: a customer-visible string. This app never defaults one in a language. */
	closeLabel: string;
	/**
	 * Fractions of screen height, ascending. `[0.5, 1]` — half, then full. One value makes
	 * the sheet fixed; the default is a single half-height snap. Each fraction is resolved
	 * against the panel's own height, so `1` is "the whole panel" rather than "the whole
	 * screen".
	 */
	snapPoints?: number[];
	/**
	 * Which resolved snap point to open at. Defaults to `0`.
	 *
	 * The index is into the *resolved* offsets, which are sorted by position — so `0` is the
	 * highest snap (the most of the panel on screen), not the first fraction written. With
	 * the one-element default the two readings agree, and nothing passes this yet; it is
	 * noted rather than changed, because re-pointing `0` is a silent behaviour change for a
	 * caller that does not exist yet.
	 */
	initialSnapIndex?: number;
	/**
	 * A node pinned under the body, inside the sheet's own surface — an `ActionBar` or a
	 * single `Button`. It is inside the sheet so it moves with it, which is the whole point
	 * of putting the decision in the panel rather than behind it. It does not scroll, and it
	 * pays its own bottom inset; the body pays one only when there is no footer.
	 */
	footer?: React.ReactNode;
	/** Lift the body when the keyboard opens. On for a sheet with a text field in it. */
	avoidKeyboard?: boolean;
	children: React.ReactNode;
};

export function Sheet({
	open,
	onClose,
	title,
	closeLabel,
	snapPoints = [0.5],
	initialSnapIndex = 0,
	footer,
	avoidKeyboard = false,
	children,
}: SheetProps) {
	const { colors } = useTheme();
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReducedMotion();

	/**
	 * Mounted separately from `open`, so the exit can run before the sheet leaves the tree.
	 *
	 * `open` going false starts the animation; the sheet unmounts when it finishes. Without
	 * the split, closing is a `null` return and the panel disappears between two frames —
	 * an exit slower than the entrance is what makes an app feel sticky, and there is no
	 * exit at all if the component is gone.
	 */
	const [mounted, setMounted] = useState(open);

	/**
	 * The panel's own height, and `null` until it has been laid out once.
	 *
	 * It is what turns a fraction of the screen into an offset — see the docblock — so it is
	 * measured rather than assumed, and it is re-measured whenever the body's content changes
	 * height, which is what keeps a sheet whose content grew (a filter that adds a "clear"
	 * row) resting where its fraction says.
	 */
	const [panelHeight, setPanelHeight] = useState<number | null>(null);

	const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
		const measured = event.nativeEvent.layout.height;
		// Unchanged height, unchanged state: returning `current` is what keeps React from
		// scheduling a render for every layout pass, of which a scroll view generates plenty.
		setPanelHeight((current) => (current === measured ? current : measured));
	}, []);

	/** Offsets from the top of the screen, ascending is lower. Sorted high-to-low. */
	const offsets = useMemo(
		() =>
			snapPoints
				.map((fraction) => {
					const fromTop = height * (1 - fraction);
					// Unmeasured: the panel is not on screen yet and nothing settles to this,
					// so the screen-height reading is only a placeholder for the first pass.
					if (panelHeight === null) return Math.max(0, fromTop);
					return Math.max(0, fromTop - (height - panelHeight));
				})
				.sort((a, b) => a - b),
		[height, panelHeight, snapPoints],
	);

	const lowest = offsets[offsets.length - 1] ?? height;
	const highest = offsets[0] ?? 0;

	const translateY = useSharedValue(height);
	const dragStart = useSharedValue(0);
	const snapTarget = useSharedValue(height);
	const dismissing = useSharedValue(false);
	const previousMotion = useRef(reduceMotion);
	const closeFromEffect = useEffectEvent(onClose);

	const settle = useCallback(
		(to: number) => {
			"worklet";
			snapTarget.value = to;
			// Reduced motion *places* the panel: the assignment is the whole animation, so the
			// sheet is at its snap point on the next frame. The 120ms `withTiming` this used to
			// be was still travel — it shortened the curve, not the distance, and the distance
			// here is the panel's full height, which is the largest single movement in the app.
			translateY.value = reduceMotion ? to : withSpring(to, spring.sheet);
		},
		[reduceMotion, snapTarget, translateY],
	);

	useEffect(() => {
		const motionChanged = previousMotion.current !== reduceMotion;
		previousMotion.current = reduceMotion;
		if (motionChanged && open && panelHeight !== null) {
			// Keep the chosen snap; a preference change must not reopen the panel.
			cancelAnimation(translateY);
			if (dismissing.value) {
				dismissing.value = false;
				translateY.value = height;
				closeFromEffect();
				return;
			}
			translateY.value = Math.max(highest, Math.min(snapTarget.value, lowest));
			return;
		}
		if (open) {
			setMounted(true);
			// Nothing to settle to before the panel has been laid out: a fraction of the
			// screen only becomes an offset once the panel's own height is known. The panel
			// waits offscreen for that one layout pass, and this effect runs again the moment
			// `panelHeight` arrives.
			if (panelHeight === null) return;
			settle(offsets[initialSnapIndex] ?? highest);
		} else if (reduceMotion) {
			// The close, placed rather than played. This is the site that ignored the setting
			// outright: `withTiming` at `exitDuration(duration.sheet)` is 224ms, and the value
			// it animates to is `height` — the panel's own full travel, the largest movement
			// in the app, which is precisely the thing `useReducedMotion()` is asked to stop.
			// The panel is offscreen and out of the tree in the same frame instead; the
			// backdrop's own `instant` opacity is what still answers the tap.
			translateY.value = height;
			setMounted(false);
		} else {
			translateY.value = withTiming(
				height,
				{ duration: exitDuration(duration.sheet) },
				(finished) => {
					if (finished) runOnJS(setMounted)(false);
				},
			);
		}
	}, [
		dismissing,
		open,
		height,
		highest,
		lowest,
		initialSnapIndex,
		offsets,
		panelHeight,
		reduceMotion,
		settle,
		snapTarget,
		translateY,
	]);

	const dismiss = useCallback(() => {
		dismissing.value = false;
		onClose();
	}, [dismissing, onClose]);

	/**
	 * Android's back press closes the panel, and the `true` is the whole fix.
	 *
	 * `BackHandler`'s own source is the contract: the subscriptions are consulted in reverse
	 * registration order — most recent first — and the first one to return a truthy value ends
	 * the dispatch, so nothing registered before it runs
	 * (`Libraries/Utilities/BackHandler.android.js:30-36`). When none of them does, RN calls
	 * `exitApp()`, which invokes the *default* back handler rather than doing nothing — and on
	 * a screen in a navigator the default back handler is the navigator's own, which pops the
	 * screen underneath. So a sheet with no handler at all closes nothing *and* changes the
	 * screen behind it: the panel stays up over a different screen. Returning `true` is what
	 * stops that, and a handler that falls through is the defect with extra steps.
	 *
	 * Registered only while the panel is open, so the press goes back to the navigator the
	 * moment the sheet is gone, and only on Android: on iOS `addEventListener` returns a
	 * subscription that never fires (`Libraries/Utilities/BackHandler.ios.js:28-31`), and iOS's
	 * own way out of a modal is the gesture the navigator already owns.
	 *
	 * It sits above the `if (!mounted) return null` below rather than beside the markup it
	 * concerns, because a hook cannot follow a conditional return.
	 */
	useEffect(() => {
		if (!open || Platform.OS !== "android") return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			dismiss();
			return true;
		});
		return () => sub.remove();
	}, [open, dismiss]);

	const pan = useMemo(
		() =>
			Gesture.Pan()
				// Only downward, and only from a drag that started on the handle: `activeOffsetY`
				// is what keeps a sideways swipe across the handle from moving the panel.
				.activeOffsetY(8)
				.onStart(() => {
					dragStart.value = translateY.value;
				})
				.onUpdate((event) => {
					// Clamped at the top: a sheet dragged above its highest snap would show the
					// screen behind it through a gap it cannot come back from.
					translateY.value = Math.max(
						highest,
						dragStart.value + event.translationY,
					);
				})
				.onEnd((event) => {
					const thrown = event.velocityY > CLOSE_VELOCITY;
					const past = translateY.value > lowest + CLOSE_DISTANCE;

					if (past || (thrown && translateY.value >= lowest)) {
						dismissing.value = true;
						if (reduceMotion) {
							// The gesture ends, the panel is placed at the bottom edge and the
							// sheet is dismissed — same frame, no 224ms of travel. `runOnJS` and
							// not a bare call: this callback is a worklet, and `dismiss` is a JS
							// closure that cannot be invoked on the UI thread.
							translateY.value = height;
							runOnJS(dismiss)();
							return;
						}
						translateY.value = withTiming(
							height,
							{ duration: exitDuration(duration.sheet) },
							(finished) => {
								if (finished) runOnJS(dismiss)();
							},
						);
						return;
					}

					// The nearest snap above where it was released, or the lowest one if it was
					// released below all of them — never a half-open position, because a sheet
					// that rests between two snap points reads as a bug rather than as a choice.
					const target = offsets.reduce(
						(best, candidate) =>
							Math.abs(candidate - translateY.value) <
							Math.abs(best - translateY.value)
								? candidate
								: best,
						lowest,
					);
					settle(Math.min(target, lowest));
				}),
		[
			dismiss,
			dismissing,
			dragStart,
			height,
			highest,
			lowest,
			offsets,
			reduceMotion,
			settle,
			translateY,
		],
	);

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	if (!mounted) return null;

	/**
	 * The body, in a scroll view.
	 *
	 * `contentContainerStyle` rather than `style`, so the padding belongs to the content and
	 * the scroll indicator stays at the panel's own edge. `keyboardShouldPersistTaps` is the
	 * same setting `./screen` uses: a body with a field and a control under it must not need
	 * two taps to press the control while the keyboard is up.
	 *
	 * The bottom inset is paid here only when there is no footer. A footer is an `ActionBar`,
	 * which pays it itself — paying it twice leaves a gap above the bar — and a body that ends
	 * at the screen's bottom edge without one puts its last line under the home indicator,
	 * which is exactly the line the scroll view was added to make reachable.
	 */
	const body = (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[
				styles.body,
				footer ? null : { paddingBottom: insets.bottom },
			]}
			keyboardShouldPersistTaps="handled"
			// The same pair `./screen` puts on its own scroller, and for the same reason: the
			// body brings its own scroll view, so a prop that would reach one owned by a
			// primitive never leaves the primitive. The dismissal mode is not gated, because a
			// drag mode is inert with no keyboard up — `'none'` is the cross-platform default
			// and `'on-drag'` the only other one Android implements (`'interactive'` "will have
			// the same behavior as 'none'" there, `ScrollView.js:472-489`).
			keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
			// The inset, on the other hand, is asked for only by a sheet that has a field in it
			// — which is what `avoidKeyboard` means, and every sheet that sets it has its
			// `Field`s in this body. A sheet without one keeps the props it had.
			//
			// It does not double-pay the `KeyboardAvoidingView` above, and the native code is
			// why: the inset is the *measured* overlap between this view's bottom edge and the
			// keyboard's top edge — `MAX(scrollViewLowerY - keyboardEndFrame.origin.y, 0)`,
			// written to `contentInset.bottom` (`RCTScrollViewComponentView.mm:209`,
			// `:214`, `:261`) — so it is zero once the lift has already moved the body clear,
			// and it is the part that helps when the panel is capped by `maxHeight` and the
			// lift cannot finish the job. `contentOffset` moves only for a first responder
			// inside this scroll view (`:217-238`, and `RCTTextInputComponentView.mm:153-155`
			// for the input that is not a descendant), which is exactly the field being typed
			// into. `undefined` rather than `false` off iOS, as in `./screen`: React drops an
			// undefined prop, so Android never receives a key it does not implement.
			automaticallyAdjustKeyboardInsets={
				Platform.OS === "ios" && avoidKeyboard ? true : undefined
			}
		>
			{children}
		</ScrollView>
	);

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
			{/* The backdrop is a target, so it is a `Pressable` like everything else that
			    answers a finger — with `scaleTo={1}`, because a full-screen dim that shrinks
			    when touched is the one place the press scale is wrong. Its opacity feedback
			    is the half that stays under reduced motion. */}
			<Pressable
				onPress={dismiss}
				scaleTo={1}
				ripple={false}
				accessibilityRole="button"
				accessibilityLabel={closeLabel}
				style={styles.backdrop}
			>
				<Animated.View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: colors.scrim },
						// A dim rather than an opaque cover: the sheet is a layer over the screen,
						// and a reader who cannot see what is behind it has lost the context the
						// panel was opened to act on.
						styles.scrim,
					]}
				/>
			</Pressable>

			<Animated.View
				style={[
					styles.sheet,
					{
						backgroundColor: colors.card,
						borderColor: colors.border,
						// The sheet's own floor: never taller than the screen, and never short
						// enough to hide the handle behind the home indicator.
						maxHeight: height - insets.top - space.lg,
					},
					sheetStyle,
				]}
				accessibilityViewIsModal
				accessibilityLabel={title}
				// The two-finger "escape" gesture, which is how a modal is left without finding a
				// button. It matters here for a reason that is specific to this component:
				// `accessibilityViewIsModal` makes VoiceOver skip every sibling view, and the
				// backdrop — the labelled "close" target at the top of this render — is a sibling.
				// So a reader who cannot find the panel's own dismissal has nothing else to
				// reach for. Every mount today passes one (a close button, or a done row), which
				// is why this is a way out rather than a rescue; it is here so the next mount that
				// forgets cannot trap anyone.
				onAccessibilityEscape={dismiss}
				// The measurement a fractional snap point is resolved against. Transform does
				// not affect layout, so this arrives while the panel is still offscreen.
				onLayout={onPanelLayout}
			>
				{/* The drag is the handle's, and only the handle's: a pan over the whole panel
				    would be a pan composed over the body's scroll, which is the coin toss this
				    component deliberately avoids. The strip is `MIN_TOUCH_TARGET` tall and full
				    width so the gesture has a 44pt target even though the ink is 4pt. */}
				<GestureDetector gesture={pan}>
					<View style={styles.handleArea}>
						<View style={[styles.handle, { backgroundColor: colors.border }]} />
					</View>
				</GestureDetector>

				{title ? (
					<Text variant="title" bold style={styles.title}>
						{title}
					</Text>
				) : null}
				{avoidKeyboard ? (
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : undefined}
					>
						{body}
					</KeyboardAvoidingView>
				) : (
					body
				)}
				{footer ? <View style={styles.footer}>{footer}</View> : null}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	// Spelled out rather than `StyleSheet.absoluteFillObject`, which RN 0.86 no longer
	// declares in its types — only the registered `absoluteFill` survives, and that is a
	// number this needs to merge a radius into. Square on purpose: the scrim covers the
	// whole screen, so it has no corners to round — the square is the rule's
	// "genuinely must be square, so say why" case, not a radius the scale forgot.
	backdrop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderRadius: 0,
	},
	// 62% of the `scrim` token: dark enough to separate the sheet from the screen, light enough
	// that the screen is still legible through it. The colour is the token's and the dimming is
	// this file's — `foreground` was the colour until it was measured, and in the dark theme it
	// inverted the relationship (see `theme/tokens.ts`).
	scrim: { opacity: 0.62 },
	sheet: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		// `lg` is the token the scale reserves for sheets and heroes. A sheet at `md` is a
		// card that happens to be at the bottom of the screen.
		borderTopLeftRadius: radius.lg,
		borderTopRightRadius: radius.lg,
		borderTopWidth: 1,
		overflow: "hidden",
	},
	// The drag target, and the top of the panel rather than a band inside it: the gesture
	// has to start at the sheet's own edge to reach the 44pt floor, and the 4pt of ink sits
	// centred in it. This is the whole of the sheet's top padding.
	handleArea: {
		height: MIN_TOUCH_TARGET,
		justifyContent: "center",
	},
	handle: {
		width: HANDLE_WIDTH,
		height: HANDLE_HEIGHT,
		borderRadius: radius.full,
		alignSelf: "center",
	},
	title: { paddingHorizontal: space.lg, marginBottom: space.sm },
	// The panel is content-sized and capped by `maxHeight`, and this is the only child
	// allowed to give height back. When the content is taller than the cap, shrinking this
	// view is what makes its frame the visible area and its content scrollable inside it —
	// rather than a body that overflows a frame `overflow: "hidden"` quietly clips. The
	// handle, the title and the footer keep their heights, so the whole of the overflow
	// lands here.
	scroll: { flexShrink: 1 },
	body: { paddingHorizontal: space.lg },
	footer: { paddingTop: space.md },
});
