import Ionicons from "@expo/vector-icons/Ionicons";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/lib/i18n";
import { duration, ENTER_RISE, exitDuration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { icon, radius, shadow, space, useTheme } from "@/theme";

import { MEASURE } from "./error-state";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The confirmation of a write that succeeded, where it happened.
 *
 * This is `docs/design-mobile.md`'s fifth composition rule and nothing else: *a write is
 * confirmed where it happened*. Add-to-cart, an address saved, a review posted, a promo
 * applied — each shows this once, with the thing that happened and the quantity or total it
 * produced. The failure it prevents is the one every app that saves silently has: a customer
 * who cannot tell whether the tap registered taps again, and the second tap is a second item
 * in the cart.
 *
 * ## One at a time, replacing rather than queueing
 *
 * A second `show()` before the first has gone does not wait its turn — it takes the screen.
 * A queue is the wrong shape here for two reasons that are the same fact: the sentences in it
 * describe writes that already happened, so the fourth one read is stale news the customer
 * cannot act on; and every one of them is drawn at the bottom of the screen, which is where
 * the thing being confirmed usually is. The surface shows the most recent sentence, which is
 * the only one still true.
 *
 * A replacement also restarts the auto-dismiss clock, because the sentence changed — the
 * timer belongs to the message on screen, not to the moment the first one arrived.
 *
 * ## The timing, and the one place reduced motion appears
 *
 * 240ms in and `exitDuration(240)` — 168ms — out, both read from `lib/motion` rather than
 * typed here, because a duration typed at a call site is how an app grows a fifth step. The
 * exit is 0.7× its entrance by `EXIT_RATIO`: leaving slower than arriving is what makes an
 * app feel sticky.
 *
 * `useReducedMotion()` is read in exactly one place in this file — the animated style that
 * drops the transform. The fade, both durations, the auto-dismiss and the replacement
 * behaviour are identical with the setting on, which is the review bar's own line: *motion
 * off changes nothing but the movement*. The rise is a transform and it goes; the opacity is
 * what still answers "something arrived", and it is why the setting costs this component a
 * branch rather than a second code path.
 *
 * The style is written as `ENTER_RISE * (1 - progress)` from one shared value, so the exit is
 * the entrance reversed: the toast sinks back the 8 points it rose, and it can be turned
 * around mid-flight by a replacement. `withTiming`'s callback reports `finished === false` for
 * an interrupted animation, which is what keeps a cancelled exit from clearing the screen
 * under the toast that replaced it.
 *
 * ## No error ever goes here, and the type says so
 *
 * A refusal needs a sentence, a reason and often a retry — `./rollback-notice` for an
 * optimistic write the API refused, `./error-state` for a screen that could not load, both of
 * which are drawn *in* the layout rather than floated over it, because a message you have to
 * act on must not be able to leave on its own after 3.2 seconds. So `show()` takes a message
 * and nothing else: there is no severity to set, and no tone that would make an error
 * reachable from here.
 *
 * ## The haptic is not here, because it already happened
 *
 * `lib/haptics.ts` fires `light()` on add-to-cart, a favourite and a quantity, and `success()`
 * when an order is placed — at the moment of the tap, in the mutation that did the write. The
 * toast confirms exactly those commits, so a second buzz from this file would be the same
 * event announced twice, which is the nudge the vocabulary forbids ("never to draw attention
 * to something the user did not ask for"). It would also be a haptic fired from a render
 * path, which `./rollback-notice` already refused for the same reason: a component that buzzes
 * on mount buzzes again on every re-render that remounted it.
 *
 * ## Where it sits
 *
 * The bottom inset plus one step of air, on every screen — above the home
 * indicator and clear of the floating order controls on home. It is a
 * constant rather than a per-screen value on purpose: a toast that sits at a
 * different height on the cart than on the feed is a toast that moves for no
 * reason the customer can see.
 *
 * ## What a screen reader gets
 *
 * `accessibilityLiveRegion="polite"` is React Native's Android mechanism — the platform
 * announces the change to the view itself — and `accessibilityRole="alert"` is the role the
 * contract names. iOS has no live region, so there the sentence is announced explicitly on
 * the change that produced it, which is the same pairing `./rollback-notice` uses. The
 * explicit call is gated to iOS rather than made everywhere: on Android the live region is
 * already the announcement, and asking twice is a sentence read twice.
 *
 * The dismiss is a tap with an `accessibilityHint`, because an alert is not discovered as a
 * control — without it a reader would wait out the 3.2 seconds rather than know they can end
 * it sooner. The mark is hidden from the tree; the word is the message.
 */

/** How long the sentence stays before it leaves on its own. The contract's 3.2s. */
const AUTO_DISMISS = 3200;

// The sentence's measure is `./error-state`'s exported `MEASURE` — the same cap the error
// block puts on its own centred lines, read from there rather than spelled a second time:
// three message surfaces deriving the same number was three chances to drift.

export type ToastApi = {
	/** Show `message`, replacing whatever is on screen. The message is already translated. */
	show: (message: string) => void;
	/** Take the current toast away early. Rarely needed: it leaves on its own. */
	dismiss: () => void;
};

/**
 * A toast, as the object rather than as the string.
 *
 * React bails out of a state update whose value is `Object.is`-equal to the last one, so a
 * `useState<string>` would swallow the second "Agregado al carrito" in a row: no re-render,
 * so the auto-dismiss clock would keep running down from the first and iOS would not announce
 * the second. A fresh object every time is what makes two identical sentences two arrivals.
 */
type Toast = { message: string };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * One toast at a time, for the whole app.
 *
 * Mounted once, in `app/_layout.tsx`, inside `SafeAreaProvider` — the offset below is the
 * bottom inset's — and around the navigator, so it paints over the tab bar and over a pushed
 * screen rather than inside one. `useToast()` resolves on every route, `(auth)` included.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
	const { colors } = useTheme();
	const { t } = useT();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReducedMotion();

	const [current, setCurrent] = useState<Toast | null>(null);
	/** The same toast as `current`, readable from a callback without a stale closure. */
	const shown = useRef<Toast | null>(null);
	const progress = useSharedValue(0);

	const clear = useCallback(() => {
		shown.current = null;
		setCurrent(null);
	}, []);

	const show = useCallback(
		(message: string) => {
			const next = { message };
			shown.current = next;
			setCurrent(next);
			progress.value = withTiming(1, {
				duration: duration.entering,
				easing: Easing.out(Easing.cubic),
			});
		},
		[progress],
	);

	const dismiss = useCallback(() => {
		// Nothing on screen, nothing to take away. The tap and the timer can both arrive after
		// an exit has already cleared this, and a second exit would be an animation over a value
		// that is already at its target.
		if (!shown.current) return;
		progress.value = withTiming(
			0,
			{ duration: exitDuration(duration.entering) },
			(finished) => {
				// `false` is an interrupted exit: a replacement arrived mid-flight and owns the
				// screen now. Clearing here would unmount the toast that replaced this one.
				if (finished) runOnJS(clear)();
			},
		);
	}, [clear, progress]);

	useEffect(() => {
		if (!current) return;
		const timer = setTimeout(() => dismiss(), AUTO_DISMISS);
		return () => clearTimeout(timer);
	}, [current, dismiss]);

	useEffect(() => {
		if (!current || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(current.message);
	}, [current]);

	/**
	 * Stable across a toast's whole life, so a screen that only ever calls `show()` does not
	 * re-render when one is drawn. `show` and `dismiss` are callbacks over a ref and a shared
	 * value, neither of which changes identity when the message does.
	 */
	const api = useMemo<ToastApi>(() => ({ dismiss, show }), [dismiss, show]);

	const animated = useAnimatedStyle(() => {
		// The whole of the reduced-motion branch: opacity survives the setting, the rise does not.
		return {
			opacity: progress.value,
			transform: [
				{ translateY: reduceMotion ? 0 : ENTER_RISE * (1 - progress.value) },
			],
		};
	});

	return (
		<ToastContext value={api}>
			{children}
			{current ? (
				<Animated.View
					style={[styles.host, { bottom: insets.bottom + space.md }, animated]}
				>
					<Pressable
						onPress={dismiss}
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
						accessibilityHint={t("a11y.dismissToast")}
						style={[
							styles.surface,
							{ backgroundColor: colors.card, borderColor: colors.border },
							// The `raised` lift, because this is the one surface that floats over a
							// screen rather than sitting in one. It is above the tab bar because
							// `ToastProvider` mounts it after the navigator, not because of this —
							// the token's `elevation` is Android's half of the shadow.
							shadow.raised,
						]}
					>
						{/* The word carries the meaning; this is the second channel, never the only
						    one — hence a `success` tint on a mark that is hidden from the tree. */}
						<Ionicons
							name="checkmark-circle"
							size={icon.inline}
							color={colors.success}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="body" style={styles.message}>
							{current.message}
						</Text>
					</Pressable>
				</Animated.View>
			) : null}
		</ToastContext>
	);
}

/**
 * The toast, from a screen.
 *
 * Throws outside `ToastProvider` for the reason `useT()` throws outside `I18nProvider`: a
 * fallback is a bug that ships. A no-op here would look *fine* — the write succeeds, the
 * screen is right — and the one thing rule 5 asks for would be silently missing, which is the
 * kind of defect nobody finds because nothing is broken.
 */
export function useToast(): ToastApi {
	const value = use(ToastContext);
	if (!value) {
		throw new Error(
			"useToast() fuera de <ToastProvider>. Lo monta el layout raíz.",
		);
	}
	return value;
}

const styles = StyleSheet.create({
	host: {
		position: "absolute",
		left: space.lg,
		right: space.lg,
		// Centred so the measure above caps it on a wide screen instead of stretching one
		// sentence across an iPad.
		alignItems: "center",
	},
	surface: {
		flexDirection: "row",
		// Top-aligned, not centred: at 200% text a message that wraps to three lines would
		// otherwise push the mark to the middle of the block, away from the words it marks.
		alignItems: "flex-start",
		gap: space.sm,
		width: "100%",
		maxWidth: MEASURE,
		borderWidth: 1,
		borderRadius: radius.md,
		padding: space.md,
	},
	/** The sentence takes the rest of the row and wraps. Never a `numberOfLines`. */
	message: { flex: 1 },
});
