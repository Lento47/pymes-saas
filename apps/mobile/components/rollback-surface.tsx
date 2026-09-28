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
import { StyleSheet } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BANNER_DROP, duration, exitDuration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { space } from "@/theme";

import { MEASURE } from "./error-state";
import { RollbackNotice } from "./rollback-notice";

/**
 * A refused optimistic write, for a screen that has nowhere to put the sentence.
 *
 * `./rollback-notice` is drawn *in* a screen — the cart's line, an order's detail — because
 * those screens own the transaction the refusal is about and can put the sentence under it.
 * The heart cannot: it lives on a card, in a feed, on a storefront and on a product page, and
 * a 44-point square pinned to a corner has no room for a sentence. That is the gap this
 * surface fills, and it is the gap `lib/favorites.ts` was filling with `Alert.alert` — the one
 * system dialog left in an app whose `./confirm-sheet` docblock exists to argue them out. An
 * alert is the OS's surface, not this app's: its colours, its corner, its type, none of which
 * a token reaches. This draws the same sentence in the app's own notice instead.
 *
 * ## One at a time, replacing rather than queueing
 *
 * `./toast`'s rule, for its reason: a queue of refusals is stale news by the third one, and
 * every sentence is about a write that has already been undone. The most recent refusal is the
 * only one still true, so a second `show()` takes the screen.
 *
 * ## It sits at the top, where the toast is not
 *
 * The success confirmation is at the bottom because it is about the thing under the thumb
 * (`./toast`). This surface is the same shape of news in the opposite direction, and it would
 * collide with that toast if it took the same slot — the two can be on screen in the same
 * second, because a customer can add to the cart and fail to save a favourite without moving.
 * The top is the one band a customer screen leaves empty, and it is where `./new-order-banner`
 * already draws a notice that arrives *over* the screen rather than inside it — the drop, the
 * duration and the curve below are that surface's, from `lib/motion`, rather than a second
 * vocabulary for the same move.
 *
 * ## It leaves on its own, and it can be ended sooner
 *
 * Unlike `./new-order-banner`, this carries a timer: an unpaid order is work and stays until
 * answered, while a refusal is a thing the reader has to know and then get on with their
 * screen. `AUTO_DISMISS` is twice `./toast`'s window, because a refusal carries the *reason
 * the write was undone* and the reader is not necessarily looking at the top of the screen
 * when it lands; the tap ends it sooner for anyone who is.
 *
 * ## Reduced motion
 *
 * `useReducedMotion()` is read in exactly one place, the animated style that drops the drop.
 * The fade, both durations and the timer are identical with the setting on — *motion off
 * changes nothing but the movement*, which is `./toast`'s and `./new-order-banner`'s own line.
 *
 * ## The haptic is not here, because it already happened
 *
 * `lib/favorites.ts` fires `warning()` in the mutation that failed, at the moment it failed —
 * the same division `./rollback-notice` states for the same reason: a component that buzzes on
 * mount buzzes again on every re-render that remounted it.
 */

/**
 * How long the refusal stays before it leaves on its own.
 *
 * Twice `./toast`'s 2800 — see the file docblock. Long enough to read a full sentence twice at
 * a distance, short enough that a reader who has moved on is not left with it over their
 * screen, and the tap-to-dismiss below is what covers the reader who wants it gone now.
 */
const AUTO_DISMISS = 6000;

export type RollbackApi = {
	/** Show `error`, replacing whatever is on screen. The sentence is derived from it. */
	show: (error: unknown) => void;
	/** Take the refusal away. Rarely needed by hand: it leaves on its own. */
	dismiss: () => void;
};

/**
 * The refusal, as the error object rather than as its sentence.
 *
 * The raw throw is what travels, so the surface reads it through the same `useApiFailure` and
 * the same 4xx-vs-5xx rule `./rollback-notice` uses. Passing a pre-translated string would put
 * the choice of wording at the call site, which is the one thing this layer exists to fix.
 *
 * A fresh object every `show()` for the reason `./toast` wraps its message: React bails out of
 * a state update whose value is `Object.is`-equal to the last one, and two refusals of the same
 * shape are still two arrivals.
 */
type Rollback = { error: unknown };

const RollbackContext = createContext<RollbackApi | null>(null);

/**
 * One refusal at a time, for the whole app.
 *
 * Mounted once, in `app/_layout.tsx`, inside `SafeAreaProvider` — the offset above is the top
 * inset's — and inside every provider the notice itself reads (`useTheme`, `useT`,
 * `useApiFailure`'s session). It sits around the navigator, so it paints over whichever screen
 * raised it rather than scrolling away inside one.
 */
export function RollbackProvider({ children }: { children: ReactNode }) {
	const insets = useSafeAreaInsets();
	const reduceMotion = useReducedMotion();

	const [current, setCurrent] = useState<Rollback | null>(null);
	/** The same refusal as `current`, readable from a callback without a stale closure. */
	const shown = useRef(false);
	const progress = useSharedValue(0);

	const clear = useCallback(() => {
		shown.current = false;
		setCurrent(null);
	}, []);

	const show = useCallback(
		(error: unknown) => {
			shown.current = true;
			setCurrent({ error });
			progress.value = withTiming(1, {
				duration: duration.banner,
				easing: Easing.out(Easing.cubic),
			});
		},
		[progress],
	);

	const dismiss = useCallback(() => {
		// Nothing on screen, nothing to take away. The tap and the timer can both arrive after
		// an exit has already cleared this, and a second exit would be an animation over a value
		// already at its target.
		if (!shown.current) return;
		progress.value = withTiming(
			0,
			{ duration: exitDuration(duration.banner) },
			(finished) => {
				// `false` is an interrupted exit: a replacement arrived mid-flight and owns the
				// screen now. Clearing here would unmount the notice that replaced this one.
				if (finished) runOnJS(clear)();
			},
		);
	}, [clear, progress]);

	useEffect(() => {
		if (!current) return;
		const timer = setTimeout(() => dismiss(), AUTO_DISMISS);
		return () => clearTimeout(timer);
	}, [current, dismiss]);

	/**
	 * Stable across a refusal's whole life, so a caller that only ever calls `show()` does not
	 * re-render when one is drawn. Both are callbacks over a ref and a shared value.
	 */
	const api = useMemo<RollbackApi>(() => ({ dismiss, show }), [dismiss, show]);

	const animated = useAnimatedStyle(() => ({
		// The whole of the reduced-motion branch: opacity survives the setting, the drop does not.
		opacity: progress.value,
		transform: [
			{ translateY: reduceMotion ? 0 : BANNER_DROP * (1 - progress.value) },
		],
	}));

	return (
		<RollbackContext value={api}>
			{children}
			{current ? (
				<Animated.View
					// The band is the notice's, not the screen's: a full-width invisible row would
					// steal the taps under it, including the header's own controls.
					pointerEvents="box-none"
					style={[styles.host, { top: insets.top + space.sm }, animated]}
				>
					<RollbackNotice
						error={current.error}
						onDismiss={dismiss}
						style={styles.notice}
					/>
				</Animated.View>
			) : null}
		</RollbackContext>
	);
}

/**
 * The surface, from a screen or a component.
 *
 * Throws outside `RollbackProvider` for the reason `useToast()` throws outside `ToastProvider`:
 * a fallback is a bug that ships. A silent no-op would look fine — the heart simply reverts —
 * and the half the design asks for, the sentence saying *why*, would be the half that went
 * missing.
 */
export function useRollback(): RollbackApi {
	const value = use(RollbackContext);
	if (!value) {
		throw new Error(
			"useRollback() fuera de <RollbackProvider>. Lo monta el layout raíz.",
		);
	}
	return value;
}

const styles = StyleSheet.create({
	host: {
		position: "absolute",
		left: space.md,
		right: space.md,
		// Centred so the measure below caps it on a wide screen instead of stretching one
		// sentence across an iPad — `./toast`'s host, one step of gutter narrower to match
		// `./new-order-banner`'s own band.
		alignItems: "center",
	},
	// The notice's own skin (fill, hairline, corner, padding) is `./rollback-notice`'s; this is
	// only its width, so the floated copy and the in-layout one cannot drift apart.
	notice: { width: "100%", maxWidth: MEASURE },
});
