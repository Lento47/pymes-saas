import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
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
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/lib/i18n";
import { BANNER_DROP, duration, exitDuration } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The new-order alert, interface.md §24 — the one surface in this app that exists because a
 * *missed* event costs money in real time.
 *
 * A paid order arrives while somebody is mid-task at a counter. Until it is answered the
 * customer is waiting and the shop is one timeout away from a refund, so the news cannot be a
 * toast: `./toast` is a sentence that leaves on its own after 3.2 seconds, which is exactly
 * the failure mode this surface is here to correct. The banner has **no timer at all**. It
 * leaves when the order is opened, when the order stops being new (the board says so, see
 * `app/(business)/business.tsx`), or when a newer order replaces it. Ignored, it stays — which
 * is the truth it is telling.
 *
 * ## Ink and a lime rail, and nothing else
 *
 * §24 draws it in exactly three colours: "deep ink background / lime left accent / light
 * text". Those are the two keys `./merchant-pulse` already folded the contract's structural
 * pair into — `colors.foreground` behind, `colors.background` in front — plus the one accent
 * the palette owns. No fourth colour, no severity, no icon: a new order is not a warning and
 * not a success, it is work. Taking the pair from the keys rather than from §24's hexes keeps
 * the banner owned by the same palette as the pulse beside it, which is that file's own
 * argument at length.
 *
 * The text is coloured by `style` and not by a tone, and that is not an oversight.
 * `./text`'s `tone="inverse"` resolves to `primaryForeground`, which in the merchant palette
 * is the ink — the tone exists for text on `primary` or `destructive`, and this is text on
 * `foreground`. `./merchant-pulse` writes the same `style={{ color: colors.background }}` for
 * the same reason.
 *
 * ## The one control is a button, and the banner is not one
 *
 * §24's example puts "Review →" on the second line as a distinct affordance, and the shape
 * follows: the two text lines are the alert, the control beside them is a `Pressable`, and
 * the two are siblings. Wrapping the whole surface in the press would be the bigger tap target
 * and would make the banner a control that is also its own announcement — the nesting
 * `components/star-input.tsx` and `app/(business)/business.tsx`'s own error banner both
 * refuse, for the reason the error banner states: a control nested inside an element a reader
 * treats as one thing is a control nobody can reach. The right-hand column is stretched to the
 * full banner height, so the tap target is the whole side rather than a 44-point chip.
 *
 * The chevron is hidden from the tree. The word is the label; a second channel, never the only
 * one — the rule `./toast` writes for its own mark.
 *
 * ## Why there is no close button
 *
 * The contract draws none, and a dismiss here would be a button that says "I have decided not
 * to answer this order". The banner is not stale news to be swept away, it is an unpaid bill
 * on the screen. An operator who wants it gone answers the order, which is the action the
 * surface is for; the board takes it down when the order leaves `PENDING`.
 *
 * ## Two shared values, because §24's exit does not move
 *
 * "enter: translateY -12 → 0, opacity 0 → 1, 220ms" and "exit: opacity 1 → 0, 160ms". The
 * exit is opacity *only* — the drop is an entrance, not a pendulum — so one shared value
 * driving both would drag the banner twelve points up the screen while it faded out, which is
 * the bounce §24's last line forbids. `opacity` and `drop` therefore have one job each: the
 * entrance times both, the exit times only the first, and `clear` rewinds the drop for the
 * next arrival. A replacement mid-flight times both again from wherever they are, which is
 * `./toast`'s own rule and the reason `dismiss`'s callback checks `finished` before it clears.
 *
 * 220ms is `duration.banner` and the exit is `exitDuration(220)` — 154ms, the vocabulary's
 * 0.7× rather than §24's rounded 160. The curve is `Easing.out(Easing.cubic)`, the one
 * `./toast` already uses for a floating notice: `lib/motion.ts` holds durations and springs
 * and deliberately no easings ("nothing here imports reanimated"), so the curve is typed here
 * the way it is typed there, and the two surfaces move alike. `withTiming` and not a spring,
 * because §24 says "Never bounce" and a spring is the one primitive that overshoots.
 *
 * ## Reduced motion
 *
 * `useReducedMotion()` is read in exactly one place, in the animated style that drops the
 * transform. The fade, both durations, the replacement behaviour and the lack of a timer are
 * identical with the setting on — `./toast`'s line, and the same one `./rollback-notice`
 * draws: *motion off changes nothing but the movement*.
 *
 * ## No haptic, and no sound of its own
 *
 * `lib/haptics.ts`'s vocabulary is for a change this app *made*, and a new order is a change
 * the customer made — buzzing the operator's hand for somebody else's action is the nudge the
 * vocabulary forbids. §57's short audio cue is the right channel for this, and it is run by
 * the board's arrival effect beside `show()` rather than from here: a surface does not decide
 * when news arrives. See `lib/new-order-sound.ts`, which is the other half of this one
 * announcement.
 *
 * ## What a screen reader gets
 *
 * The alert role and the live region sit on the *copy*, not on the surface: `./toast` can put
 * them on its one pressable because its whole surface is the message, and here the pressable
 * is a separate control. Making the surface `accessible` would swallow the button into the
 * announcement and leave a reader unable to reach "Review" — the same trap `StarMarks` names
 * on its own row. So the copy is one alert element carrying both lines, and the button is a
 * sibling that announces its own label. Android hears the live region; iOS has none, so the
 * change is announced explicitly there and only there, the pairing `./toast` and
 * `./rollback-notice` both use.
 */

export type NewOrderBannerAlert = {
	/** Where "Review" goes. The order's id, not its number. */
	orderId: string;
	/** The banner's first line, already translated: `biz.board.newOrder.title`. */
	title: string;
	/** The banner's second line, already translated: `biz.board.newOrder.meta`. */
	body: string;
};

export type NewOrderBannerApi = {
	/** Raise `alert`, replacing whatever is on screen. The strings are already translated. */
	show: (alert: NewOrderBannerAlert) => void;
	/** Take the banner down. The board calls this when the order stops being new. */
	dismiss: () => void;
};

/**
 * The banner, as the object rather than as three strings.
 *
 * A fresh object every `show()` for the reason `./toast` wraps its message: React bails out of
 * a state update whose value is `Object.is`-equal to the last one, and a second arrival for
 * the same order is still an arrival. The caller builds a literal, and the copy below makes
 * sure that is enough.
 */
const NewOrderBannerContext = createContext<NewOrderBannerApi | null>(null);

/**
 * One banner at a time, for the whole business tree.
 *
 * Mounted in `app/(business)/_layout.tsx`, inside `MerchantScopeProvider` and around the tabs,
 * so it paints over whichever business screen is on top and unmounts the moment the operator
 * leaves the tree. It is deliberately *not* in `app/_layout.tsx` beside `ToastProvider`: a
 * customer has no board to raise this, and a surface with no raiser should not be reachable.
 */
export function NewOrderBannerProvider({ children }: { children: ReactNode }) {
	const { colors } = useTheme();
	const { t } = useT();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReducedMotion();

	const [current, setCurrent] = useState<NewOrderBannerAlert | null>(null);
	/** The same alert as `current`, readable from a callback without a stale closure. */
	const shown = useRef<NewOrderBannerAlert | null>(null);
	const opacity = useSharedValue(0);
	const drop = useSharedValue(BANNER_DROP);

	const clear = useCallback(() => {
		shown.current = null;
		setCurrent(null);
		// Rewind the drop for the next arrival. The exit never moves it, so it is still at 0
		// here and the next `show()` would otherwise fade in place instead of falling.
		drop.value = BANNER_DROP;
		opacity.value = 0;
	}, [drop, opacity]);

	const show = useCallback(
		(alert: NewOrderBannerAlert) => {
			// Copied, so a caller that somehow reuses one object still produces a new state
			// value and the entrance runs again.
			const next: NewOrderBannerAlert = { ...alert };
			shown.current = next;
			setCurrent(next);
			// No rewind first: a replacement mid-flight continues from wherever it is, which
			// is `./toast`'s rule and the reason a swap does not re-drop.
			opacity.value = withTiming(1, {
				duration: duration.banner,
				easing: Easing.out(Easing.cubic),
			});
			drop.value = withTiming(0, {
				duration: duration.banner,
				easing: Easing.out(Easing.cubic),
			});
		},
		[drop, opacity],
	);

	const dismiss = useCallback(() => {
		// Nothing on screen, nothing to take away. The board can call this on a poll that
		// landed after an exit has already cleared, and a second exit would animate over a
		// value already at its target.
		if (!shown.current) return;
		opacity.value = withTiming(
			0,
			{ duration: exitDuration(duration.banner) },
			(finished) => {
				// `false` is an interrupted exit: a new order arrived mid-flight and owns the
				// screen now. Clearing here would unmount the banner that replaced this one.
				if (finished) runOnJS(clear)();
			},
		);
	}, [clear, opacity]);

	useEffect(() => {
		if (!current || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(
			`${current.title}. ${current.body}`,
		);
	}, [current]);

	/**
	 * Stable across a banner's whole life, so the board calling `show()` does not re-render
	 * the tree when one is drawn. Both are callbacks over refs and shared values.
	 */
	const api = useMemo<NewOrderBannerApi>(
		() => ({ dismiss, show }),
		[dismiss, show],
	);

	const animated = useAnimatedStyle(() => {
		// The whole of the reduced-motion branch: opacity survives the setting, the drop does
		// not.
		return {
			opacity: opacity.value,
			transform: [{ translateY: reduceMotion ? 0 : drop.value }],
		};
	});

	/** Where "Review" goes. The order is still on screen behind the push. */
	const open = useCallback(() => {
		const alert = shown.current;
		if (!alert) return;
		dismiss();
		router.push({
			pathname: "/merchant-order/[id]",
			params: { id: alert.orderId },
		});
	}, [dismiss]);

	return (
		<NewOrderBannerContext value={api}>
			{children}
			{current ? (
				<Animated.View
					style={[styles.host, { top: insets.top + space.sm }, animated]}
				>
					<View
						style={[styles.surface, { backgroundColor: colors.foreground }]}
					>
						{/* §24's "lime left accent": the same 4pt rail `./attention-banner` and
						    the status badges draw. Hidden from the tree — it carries no meaning
						    the words do not already carry. */}
						<View
							style={[styles.rail, { backgroundColor: colors.primary }]}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						{/* The alert itself. NOT the whole surface: see the file docblock on why
						    `accessible` here would swallow the control beside it. */}
						<View
							style={styles.copy}
							accessible
							accessibilityRole="alert"
							accessibilityLiveRegion="polite"
						>
							<Text
								variant="label"
								bold
								style={[styles.title, { color: colors.background }]}
							>
								{current.title}
							</Text>
							<Text
								variant="body"
								style={[styles.body, { color: colors.background }]}
							>
								{current.body}
							</Text>
						</View>
						{/* A sibling of the copy, never nested in it. The whole right column is
						    the target. */}
						<Pressable
							onPress={open}
							accessibilityRole="button"
							accessibilityLabel={t("biz.board.newOrder.review")}
							accessibilityHint={t("a11y.reviewNewOrder")}
							style={styles.cta}
						>
							<Text variant="label" bold style={{ color: colors.background }}>
								{t("biz.board.newOrder.review")}
							</Text>
							<Ionicons
								name="chevron-forward"
								size={icon.inline}
								color={colors.background}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</Pressable>
					</View>
				</Animated.View>
			) : null}
		</NewOrderBannerContext>
	);
}

/**
 * The banner, from the board.
 *
 * Throws outside `NewOrderBannerProvider` for the reason `useToast()` throws outside
 * `ToastProvider`: a fallback is a bug that ships. A silent no-op here would look fine — the
 * order is on the board either way — and the one surface that exists to prevent a missed order
 * would be silently missing.
 */
export function useNewOrderBanner(): NewOrderBannerApi {
	const value = use(NewOrderBannerContext);
	if (!value) {
		throw new Error(
			"useNewOrderBanner() fuera de <NewOrderBannerProvider>. Lo monta el layout del negocio.",
		);
	}
	return value;
}

/**
 * §24's "Height: 64–72", and the *minimum* rather than the height: the two lines are 41
 * points at 1× (`type.label` 18 + `TEXT_STACK_GAP` + `type.body` 21) and the padding sums to
 * 65, so 68 is the midpoint the contract drew — and at 200% text the lines grow and the
 * banner grows with them, because nothing here was written down to stop it.
 */
const BANNER_MIN_HEIGHT = 68;

const styles = StyleSheet.create({
	// §24's `calc(100% - 24)`. `space.md` each side is the twelve that makes twenty-four,
	// and the banner is a floating surface rather than a full-bleed band — which is also why
	// it has a corner and the pulse's band does not.
	host: {
		position: "absolute",
		left: space.md,
		right: space.md,
	},
	surface: {
		flexDirection: "row",
		alignItems: "stretch",
		minHeight: BANNER_MIN_HEIGHT,
		borderRadius: radius.md,
		// So the rail's left edge is the radius and not a square corner beside one.
		overflow: "hidden",
	},
	rail: {
		width: space.xs,
		alignSelf: "stretch",
	},
	copy: {
		flex: 1,
		justifyContent: "center",
		gap: TEXT_STACK_GAP,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
	},
	// The one line §24 draws in capitals. Same idiom as the board's own `sectionTitle`.
	title: { textTransform: "uppercase" },
	body: { flexShrink: 1 },
	// Stretched to the full banner height by the surface's `alignItems`, so the target is the
	// whole right column and not a 44-point chip floating in it.
	cta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		minWidth: MIN_TOUCH_TARGET,
		paddingHorizontal: space.md,
	},
});
