import type { Currency } from "@pymeshub/shared";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";

import { useT } from "@/lib/i18n";
import { duration, staggerDelay } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { radius, space, TEXT_STACK_GAP, useTheme } from "@/theme";

import { Button } from "./button";
import { Card } from "./card";
import { MoneyLine } from "./money-line";
import { Text } from "./text";

/**
 * The peak: an order that has been placed.
 *
 * `docs/design-mobile.md` puts the peak-end rule on exactly this moment — a check drawn in,
 * the success haptic, and then the receipt. So this screen holds three things and refuses a
 * fourth.
 *
 * **Three.** The check, drawn as a stroke rather than faded in as a picture, because a stroke
 * is what a hand does when it ticks something off. The receipt: the order's number, which is
 * the fact the customer will read out to the shop, and what it cost, which is the fact they
 * agreed to on the screen before this one. And one action, which is the receipt itself.
 *
 * **Not a fourth.** Nothing is sold here. No promotion, no "add a drink", no rating prompt, no
 * upsell of any kind: the customer has just committed money, and a screen that answers that
 * with a suggestion is a screen that spent their trust on a second sale. The spec's own
 * out-list says it, and it is the easiest rule in this file to break by accident six months
 * from now.
 *
 * ## There is no timer, and there was one
 *
 * This component used to advance itself: draw the tick, hold it for a beat, then navigate to
 * the receipt on a `setTimeout`. It was a nice piece of choreography and it was wrong. A
 * screen that leaves on its own takes the moment away from the person it belongs to — there
 * is no time to read the order number, no time to photograph it, and if the phone was face
 * down in a pocket the whole confirmation is simply missed. It also made the tick a loading
 * state, which is the one thing a confirmation must not be. So the check is drawn, the
 * receipt is on the screen, and this screen stays until the customer says it can go.
 *
 * The order number is still announced, and now it is announced *and* readable for as long as
 * they want.
 *
 * ## No icon font, and no SVG
 *
 * The app ships no `react-native-svg`, and a checkmark glyph from the icon font cannot be
 * drawn in — it arrives whole. So the check is two rotated rectangles, each growing along its
 * own axis by `scaleX`, with a compensating translation that holds the end the stroke starts
 * from still. That is what a drawn check is: one short arm down to the elbow, then a long arm
 * up and away.
 *
 * Each arm takes `duration.entering`, and the second starts one `staggerDelay` after the
 * first, so the whole check is drawn in 280ms — inside the 320ms ceiling in `lib/motion.ts`,
 * which is there because a transition a person can notice *as a duration* is a transition in
 * their way.
 *
 * ## Reduced motion
 *
 * Both arms are set to fully drawn and nothing animates. The check does not appear gradually —
 * it is simply there. What is *not* reduced is the moment itself: the receipt is there, and
 * the announcement is still made, because neither of those is movement.
 *
 * The haptic is not fired here either. `success()` belongs to the mutation that placed the
 * order — the commit — and it has already happened by the time this renders; firing it again
 * from a mount effect would answer a re-render with a buzz.
 */

/** The circle the check is drawn in, from the spacing scale — `theme/tokens.ts` has no icon sizes. */
const BADGE = space.huge * 2;
/** The stroke's weight, and the corner it ends on. */
const THICKNESS = space.xs;
/** The two arms of the tick, as fractions of the circle — a check, not a right angle. */
const ARM_SHORT = BADGE * 0.32;
const ARM_LONG = BADGE * 0.58;
const COS_45 = Math.cos(Math.PI / 4);

/**
 * Where the check's own bounding box sits relative to the elbow where the arms meet.
 *
 * The two arms are laid out from their shared elbow, so the drawn shape leans up and to the
 * right of it. Without this the tick sits low and left inside the circle, which reads as a
 * mistake rather than a flourish.
 */
const SHIFT_X = -((ARM_LONG - ARM_SHORT) * COS_45) / 2;
const SHIFT_Y = (ARM_LONG * COS_45) / 2;

export function OrderPlaced({
	reference,
	totalMinor,
	currency,
	onDone,
}: {
	reference: string;
	/** What the API charged. The same figure the checkout's bar was showing a moment ago. */
	totalMinor: number;
	currency: Currency;
	/** The one action — reading the receipt in full. Called when the customer asks for it. */
	onDone: () => void;
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const reduceMotion = useReducedMotion();
	const short = useSharedValue(0);
	const long = useSharedValue(0);
	const started = useRef(false);

	useEffect(() => {
		// Reduced motion: the arms are set to drawn and no timing runs at all. Not a shorter
		// draw — no draw, because the drawing is the movement.
		if (reduceMotion) {
			started.current = true;
			cancelAnimation(short);
			cancelAnimation(long);
			short.value = 1;
			long.value = 1;
			return;
		}
		// Changing a device preference does not announce or replay this order.
		if (started.current) return;
		started.current = true;

		short.value = withDelay(
			staggerDelay(0),
			withTiming(1, {
				duration: duration.entering,
				easing: Easing.out(Easing.quad),
			}),
		);
		long.value = withDelay(
			staggerDelay(1),
			withTiming(1, {
				duration: duration.entering,
				easing: Easing.out(Easing.quad),
			}),
		);
	}, [long, reduceMotion, short]);

	useEffect(() => {
		// The announcement says the whole of what is on the screen — that it happened, and the
		// number to quote — because the two are one fact to somebody who cannot see the tick.
		//
		// Deliberately **not** gated to iOS. The gate exists where a live region already speaks
		// on Android and the explicit call would be that same sentence a second time; this
		// screen has no live region — nothing here carries `accessibilityLiveRegion`, and the
		// confirmation is not a slot that changes but a whole screen that arrives — so gating
		// this the way `./rollback-notice:67` gates its own would leave Android with no
		// announcement at all.
		//
		// This paragraph used to end "which is the one place in this app that is true". It is
		// not the one place: `lib/cart-mutations.ts` announces the cart's unit count ungated at
		// `:169` and `:308`, and the cart screen carries no live region either, so the same
		// reasoning holds there. What is true is narrower and is the part that matters — this is
		// not a place where somebody forgot the gate, which is what an ungated call looks like
		// from the outside.
		AccessibilityInfo.announceForAccessibility(
			`${t("order.placed")}. ${t("order.number", { code: reference })}`,
		);
	}, [reference, t]);

	return (
		<View style={styles.wrap}>
			<View style={styles.peak}>
				<View style={[styles.circle, { backgroundColor: colors.primary }]}>
					<View
						style={[
							styles.check,
							{ transform: [{ translateX: SHIFT_X }, { translateY: SHIFT_Y }] },
						]}
					>
						<Arm
							length={ARM_SHORT}
							degrees={45}
							progress={short}
							color={colors.primaryForeground}
						/>
						<Arm
							length={ARM_LONG}
							// **135, not -45.** A bar has 180° symmetry, so the two are the same line and
							// the difference is which of its two ends ends up at the elbow: `Arm`'s
							// layout pins the box's *right* edge there. At -45° that put the long arm on
							// the far side of the elbow — the tick drew as a `<` with its tip 50pt from
							// the centre of a 64pt circle, hanging outside the green disc — and it also
							// made `SHIFT_X`/`SHIFT_Y` above centre a shape that was never drawn. 135°
							// puts the elbow on the other end of the same diagonal, so the arm runs up
							// and away as the docblock says and the shift lands it in the middle.
							degrees={135}
							progress={long}
							color={colors.primaryForeground}
						/>
					</View>
				</View>
				<Text variant="title" bold style={styles.centered}>
					{t("order.placed")}
				</Text>

				{/* The receipt. Two lines and no more: the number, which is what the shop asks for,
				    and the total, which is what was agreed. Anything else here — the items, the
				    address, the estimate — belongs on the order screen the button below opens, and
				    the peak is the one place in the app where a figure can wait.

				    `MoneyLine` rather than a `Price` and a label, so this is the same row the cart and
				    the checkout drew: the number a customer just paid should look exactly like the
				    number they agreed to, down to the row it sits in. */}
				<Card style={styles.receipt}>
					<Text variant="label" tone="muted" tabular>
						{t("order.number", { code: reference })}
					</Text>
					<MoneyLine
						label={t("cart.total")}
						amountMinor={totalMinor}
						currency={currency}
						strong
					/>
				</Card>
			</View>

			{/* One action, at the foot of the screen where every other primary action in the app
			    lives. It is not an `ActionBar`: a bar exists to hold a figure and an action
			    together, and this screen has just given the figure a card of its own. */}
			<Button
				label={t("action.view")}
				onPress={onDone}
				size="lg"
				shape="pill"
				fullWidth
			/>
		</View>
	);
}

/**
 * One arm of the tick, growing out of the elbow.
 *
 * A bar is laid out with its box at the origin and rotated about its own centre. Growing it
 * means shrinking its `scaleX`, which pulls *both* ends toward the centre — so the end the
 * stroke started from has to be pushed back out along the arm's own axis by half of what the
 * shrink took away. `scaleX` is the innermost transform and `translate` the outermost, which
 * is what makes those axes screen axes; see the note in the file above.
 */
function Arm({
	length,
	degrees,
	progress,
	color,
}: {
	length: number;
	degrees: number;
	progress: SharedValue<number>;
	color: string;
}) {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	// Where this bar's centre has to sit so both arms meet at the origin.
	const x = -(length / 2) * cos - length / 2;
	const y = -(length / 2) * sin - THICKNESS / 2;

	const animated = useAnimatedStyle(() => {
		// Half of what the scale takes away, pushed back **out** along the arm's own axis, and
		// the direction is the point: the box's right edge is the end pinned to the elbow, and
		// `scaleX` pulls it toward the centre exactly like the far end. The sign here used to be
		// the other way, which slid each arm *away* from the elbow while it grew — a gap at the
		// joint on both arms, closing only on the last frame — so the tick arrived rather than
		// being drawn. The prose above had it right and the code did not.
		const push = (length / 2) * (1 - progress.value);
		return {
			transform: [
				{ translateX: x + push * cos },
				{ translateY: y + push * sin },
				{ rotate: `${degrees}deg` },
				{ scaleX: progress.value },
			],
		};
	});

	return (
		<Animated.View
			style={[
				styles.arm,
				{
					width: length,
					height: THICKNESS,
					borderRadius: radius.full,
					backgroundColor: color,
				},
				animated,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	wrap: {
		// Fills the body its screen gives it, so the tick lands in the middle of the viewport
		// rather than at the top of a scrolled page. The caller makes room with
		// `contentStyle={{ flex: 1 }}`; without it this is simply a block of content.
		flex: 1,
		gap: space.xxl,
		paddingVertical: space.huge,
	},
	// The tick, the words and the receipt take the room that is left, and they take it centred:
	// this is the one screen in the app with nothing above or below it to align to.
	peak: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
	},
	circle: {
		width: BADGE,
		height: BADGE,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: space.md,
	},
	// A zero-size point at the circle's centre; the arms are laid out around it. The shift
	// that centres the tick is a transform rather than a layout offset so it moves with
	// nothing and reflows nothing.
	check: { width: 0, height: 0 },
	arm: { position: "absolute", top: 0, left: 0 },
	centered: { textAlign: "center" },
	// Full width of the column, so the receipt is a card and not a label floating under a tick.
	receipt: { alignSelf: "stretch", gap: TEXT_STACK_GAP },
});
