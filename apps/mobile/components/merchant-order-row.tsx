import type { OrderStatus } from "@pymeshub/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

import { spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	MIN_TOUCH_TARGET,
	orderChip,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
	weight as weights,
} from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * One order in the merchant queue: what it is, what it needs from the operator, and the
 * buttons that answer it. `MerchantStatusChip` is the state half, `MerchantOrderRow` the
 * row that carries it, and nothing in between is a screen's job.
 *
 * ## The words are the screen's
 *
 * Every string here arrives already translated — `statusLabel`, `fulfilmentLabel`,
 * `waitLabel`, `totalLabel` and each action's `label` — and nothing in this file imports
 * `@pymeshub/i18n`. A primitive that reached for the dictionary would be a second place a
 * translation decision gets made, and the same status would end up as two words on two
 * screens; the screen that owns the band owns the language, and the primitive owns layout,
 * colour and touch. Nothing here can render a word the screen did not hand it.
 *
 * ## Why a rail, and why the row is never tinted
 *
 * Urgency is drawn as a 4-point rail at the row's left edge rather than as a tinted
 * background (interface.md §18). A row whose background changes with its state stops being
 * the same row three states later: the fill is the loudest thing on the list, three states
 * draw three colours across it, and a reader with a colour vision deficiency is back to
 * greys. The rail is small enough to be a signal instead of a paint job — "new" takes
 * `primary`, the lime interface.md §6 reserves for the one thing asking the operator to act,
 * and "late" takes `warning`, the one state where time has already been lost — while the row
 * under it stays `background` in every state, so the list reads as one surface with a mark
 * on it. It is absolutely positioned so it costs the text no indentation and rides centred
 * on a row that grows under it at 200% text rather than fighting the layout for the space.
 *
 * ## Why the chip keeps the palette's status pairs
 *
 * The chip is coloured from `orderChip` (`theme/merchant.ts`), not from the consumer
 * `./status-badge`'s map: that map is the customer tree's answer, built around an icon
 * because a bare tinted word is a tint doing a word's job. The queue's chip is
 * interface.md §19's — a fill and the ink on it, both named `ThemeColors` keys so the
 * pairing cannot outlive the merchant palette it was measured against — and it works here
 * because the row already carries its facts as words: the headline names the order, the
 * meta line says where it goes, and the rail says whether it is shouting. `PENDING` takes
 * the lime for the same reason the rail does — it is the one state that asks for something.
 *
 * The row opens the merchant order detail. The smaller action buttons keep their
 * own responders, so an action moves the order without opening its detail.
 */
export type MerchantRowAction = {
	label: string;
	onPress: () => void;
	/**
	 * The write this action starts is still running. The control dims through
	 * `./pressable`'s default `disabledOpacity` — the dim is what says "working" — and
	 * nothing else is drawn for it: a spinner would be a second answer to a question the
	 * pressable already answers, and the row has no room for two.
	 */
	pending?: boolean;
	/**
	 * How much box the action carries. `primary` is the moment's one filled control,
	 * `secondary` the outlined alternative, `quiet` the bare word. Omitted, an action is
	 * `secondary`: the outlined box is the middle of the three and the one that needs no
	 * argument, where the other two are choices a screen makes on purpose.
	 */
	kind?: "primary" | "secondary" | "quiet";
};

export type MerchantUrgency = "new" | "late" | "critical" | null;

/**
 * An order's state, as the queue's chip draws it.
 *
 * The pair comes from `orderChip`, so the fill and the ink move together when the merchant
 * palette moves — the chip never names a colour of its own, because a pairing typed beside
 * this component would be the third copy of the eight pairs the theme already keeps. The
 * word inside is the screen's `label`, set at the chip's 11 points and bold, and the chip is
 * a rounded rectangle at `radius.sm` rather than a capsule: a capsule is `./status-badge`'s
 * shape on a row where the state is one fact among four, and the contract draws this one
 * square enough to sit inline with the fulfilment and wait words it shares a line with.
 */
export function MerchantStatusChip({
	status,
	label,
}: {
	status: OrderStatus;
	label: string;
}): React.ReactElement {
	const { colors } = useTheme();
	const pair = orderChip[status];

	return (
		// One node, one word: `text` rather than an unroled container, so a screen reader
		// reads the status as a fact on the screen and not as a box that invites a tap the
		// chip has nowhere to take.
		<View
			accessible
			accessibilityRole="text"
			style={[styles.chip, { backgroundColor: colors[pair.bg] }]}
		>
			<Text
				variant="label"
				style={{
					fontSize: CHIP_FONT_SIZE,
					fontWeight: weights.bold,
					color: colors[pair.fg],
				}}
			>
				{label}
			</Text>
		</View>
	);
}

/**
 * One row of the merchant queue (interface.md §18, §19, §20, §64).
 *
 * The band is dense on purpose — a queue is scanned as a column, not read as a list — and it
 * is a `minHeight` rather than a height, so a row at 200% text grows instead of clipping.
 * `urgent` draws the rail described in the file docblock above and tints nothing else; the
 * actions are the row's controls and go through `./pressable` like every other control in
 * the app, which is where their press scale, busy dim and Android ripple come from. `last`
 * takes the trailing hairline off the final row, because the line under a row belongs to the
 * row (`./list-row`'s divider rule) and the last one's line is the list's edge, not a rule.
 */
export function MerchantOrderRow({
	reference,
	headline,
	fulfilmentLabel,
	status,
	statusLabel,
	totalLabel,
	waitLabel,
	urgent,
	helpLabel,
	actions,
	onPress,
	last = false,
}: {
	reference: string;
	headline: string;
	fulfilmentLabel: string;
	status: OrderStatus;
	statusLabel: string;
	totalLabel: string;
	/** The queue's clock for this order — "12 min", "—". Omitted when the order has none. */
	waitLabel?: string;
	urgent: MerchantUrgency;
	/**
	 * The swipe's one contextual control. It opens this row's detail and never changes
	 * the order state.
	 */
	helpLabel?: string;
	/** Up to two; the band is drawn to hold two side by side and no more. */
	actions?: MerchantRowAction[];
	onPress: () => void;
	last?: boolean;
}): React.ReactElement {
	const { colors } = useTheme();
	const reducedMotion = useReducedMotion();
	const [revealed, setRevealed] = useState(false);
	const translateX = useSharedValue(0);

	const setHelpRevealed = (open: boolean) => {
		setRevealed(open);
		if (!reducedMotion) {
			translateX.value = withSpring(open ? -HELP_WIDTH : 0, spring.layout);
		}
	};

	const pan = Gesture.Pan()
		.enabled(helpLabel !== undefined)
		.activeOffsetX(-24)
		.failOffsetY(12)
		.onEnd((event) => {
			const open =
				event.translationX <= -SWIPE_REVEAL ||
				event.velocityX <= -SWIPE_VELOCITY;
			if (reducedMotion) {
				if (open) runOnJS(setHelpRevealed)(true);
				return;
			}
			translateX.value = withSpring(open ? -HELP_WIDTH : 0, spring.layout);
			runOnJS(setRevealed)(open);
		});

	const rowStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: reducedMotion ? 0 : translateX.value }],
	}));
	const helpOpacity = reducedMotion ? (revealed ? 1 : 0) : 1;
	const rowOpacity = reducedMotion && revealed ? 0 : 1;

	return (
		<View
			style={[
				styles.row,
				{ borderBottomColor: colors.border },
				!last && styles.rowRule,
			]}
		>
			<View
				pointerEvents={reducedMotion && revealed ? "none" : "box-none"}
				style={[styles.helpSlot, { opacity: helpOpacity }]}
			>
				{helpLabel ? (
					<Pressable
						onPress={() => {
							setHelpRevealed(false);
							onPress();
						}}
						accessibilityRole="button"
						accessibilityLabel={helpLabel}
						style={[styles.helpAction, { backgroundColor: colors.muted }]}
					>
						<Text variant="label" bold>
							{helpLabel}
						</Text>
					</Pressable>
				) : null}
			</View>
			<GestureDetector gesture={pan}>
				<Animated.View
					pointerEvents={reducedMotion && revealed ? "none" : "auto"}
					style={[
						styles.rowSurface,
						{ backgroundColor: colors.background, opacity: rowOpacity },
						rowStyle,
					]}
				>
					<Pressable
						onPress={() => {
							setHelpRevealed(false);
							onPress();
						}}
						accessibilityRole="button"
						accessibilityLabel={`#${reference}, ${headline}, ${statusLabel}, ${totalLabel}`}
						accessibilityActions={
							helpLabel ? [{ name: helpLabel, label: helpLabel }] : undefined
						}
						onAccessibilityAction={(event) => {
							if (helpLabel && event.nativeEvent.actionName === helpLabel) {
								setHelpRevealed(true);
							}
						}}
						scaleTo={1}
						rippleColor={colors.muted}
						style={StyleSheet.absoluteFill}
					/>
					<View pointerEvents="none" style={styles.railSlot}>
						<View
							style={[
								styles.rail,
								{
									backgroundColor:
										urgent === "new"
											? colors.primary
											: urgent === "late"
												? colors.warning
												: urgent === "critical"
													? colors.destructive
													: "transparent",
								},
							]}
						/>
					</View>

					<View pointerEvents="none" style={styles.main}>
						<View style={styles.titleLine}>
							<Text
								variant="label"
								tone="muted"
								numberOfLines={1}
								style={{ fontWeight: weights.bold }}
							>
								#{reference}
							</Text>
							<Text
								variant="body"
								numberOfLines={1}
								style={{ fontWeight: weights.semibold, flexShrink: 1 }}
							>
								{headline}
							</Text>
						</View>
						<View style={styles.metaLine}>
							<Text
								variant="caption"
								tone="muted"
								numberOfLines={1}
								style={{ flexShrink: 1 }}
							>
								{fulfilmentLabel}
							</Text>
							<MerchantStatusChip status={status} label={statusLabel} />
							{waitLabel ? (
								<Text variant="caption" tone="muted" tabular>
									{waitLabel}
								</Text>
							) : null}
						</View>
					</View>

					<View pointerEvents="box-none" style={styles.aside}>
						<Text
							pointerEvents="none"
							variant="body"
							tabular
							style={{ fontWeight: weights.bold }}
						>
							{totalLabel}
						</Text>
						{actions && actions.length > 0 ? (
							<View style={styles.actions}>
								{actions.map((action) => (
									<MerchantAction
										key={`${action.kind ?? "secondary"}:${action.label}`}
										action={action}
									/>
								))}
							</View>
						) : null}
					</View>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

/**
 * One of the row's controls, drawn by its `kind`.
 *
 * All three kinds are the same control at the same height — the queue's buttons are a set,
 * and a kind that also changed height would read as a hierarchy of importance that is really
 * a layout accident. The box is where the kinds disagree: `primary` takes the palette's own
 * pair, `secondary` takes the outlined box, `quiet` takes no box at all and keeps the row's
 * muted ink, so the row's own words stay louder than it. Each goes through `./pressable`,
 * which is what carries the press feedback and — for a `pending` action, through
 * `disabled` — the busy dim; a busy control shows nothing else, because a spinner beside a
 * dimmed label would be two answers to one press.
 */
function MerchantAction({
	action,
}: {
	action: MerchantRowAction;
}): React.ReactElement {
	const { colors } = useTheme();
	const kind = action.kind ?? "secondary";

	return (
		<Pressable
			onPress={action.onPress}
			disabled={action.pending}
			accessibilityRole="button"
			style={[
				styles.action,
				kind === "primary" && { backgroundColor: colors.primary },
				kind === "secondary" && {
					borderWidth: 1,
					borderColor: colors.border,
				},
				kind === "quiet" && styles.actionQuiet,
			]}
		>
			<Text
				variant="label"
				tone={
					kind === "primary"
						? "inverse"
						: kind === "quiet"
							? "muted"
							: "default"
				}
				style={{ fontWeight: weights.bold }}
			>
				{action.label}
			</Text>
		</Pressable>
	);
}

/**
 * The dense-row band: 73 points at rest, a floor rather than a height — exported so a
 * skeleton standing in for one of these rows stands at the row's own measure (and grows
 * where the row grows), instead of a second copy of the number that drifts.
 *
 * 73 is the rest arithmetic rather than a round number picked for looks: `type.body`'s
 * 21-point headline line + `TEXT_STACK_GAP`'s 2 between the two fact lines + the chip's 26
 * on the meta line + `space.md` of padding above and below (21 + 2 + 26 + 24 = 73). The
 * chip is what binds the second line, not the caption beside it.
 *
 * A queue row is not `MIN_TOUCH_TARGET`'s 44 — that is a *control's* floor, and this is a
 * surface that holds two lines of text and a chip — but it is held the same way: `minHeight`
 * so the band grows with the reader's font scale instead of clipping it. It is exported as
 * a resolved number rather than left for callers to re-derive the way `./list-row` keeps
 * its 44, because the sum above mixes a type step, a text-stack gap and the chip's own
 * floor: a caller adding up `space` insets would get the wrong answer and have no way to
 * see which piece moved.
 */
export const ROW_MIN_HEIGHT = 73;

/**
 * The rail's two measures, and why neither is a `space` step.
 *
 * The width is ink, not air — the spacing scale's subject is the distance between elements,
 * and a 4-point bar is a mark — so it is named here rather than borrowed from `space.xs`,
 * whose 4 is the same number by coincidence and would break the argument the day either
 * moved. The height is the rail's own: tall enough to read as a stripe on the band and short
 * enough to stay clear of the row's rules, and it does not follow the row's height because a
 * rail that stretched with 200% text would stop being a mark and become an edge.
 */
const RAIL_WIDTH = 4;
const RAIL_HEIGHT = 48;
const HELP_WIDTH = 128;
const SWIPE_REVEAL = 64;
const SWIPE_VELOCITY = 400;

/**
 * The chip's floor and its ink.
 *
 * `CHIP_FONT_SIZE` is 11 — the one size interface.md §19 names that the app's scale does not
 * hold (`type`'s smallest step is `caption` at 12, and `merchantType` adds figures and
 * titles, not a smaller label). It is the documented exception, not a fourth step: the chip
 * is a word on a band of other words, sized to sit on the line rather than to headline it.
 *
 * The `Text` sets `variant="label"` and *then* overrides `fontSize` to 11, and the two are
 * not redundant. `./text` takes its line box from the variant's `type` step, not from a
 * `fontSize` override, so the default `body` would hang a 21-point line box under an
 * 11-point label and the chip would measure 29 — `label`'s 18 is the line this box was
 * reckoned against. `CHIP_MIN_HEIGHT` is therefore 26 with `space.xs` of padding above and
 * below it (18 + 8 = 26): the box is the line at rest and the padding is what lets it grow
 * at 200% text — a chip that only had the minimum would hold a scaled label in an unscaled
 * box, and that is the exact failure `minHeight`-without-padding produces.
 */
const CHIP_MIN_HEIGHT = 26;
const CHIP_FONT_SIZE = 11;

const styles = StyleSheet.create({
	row: {
		minHeight: ROW_MIN_HEIGHT,
		overflow: "hidden",
	},
	/** The hairline under the row, owned by the row and taken off the final one. */
	rowRule: {
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowSurface: {
		flexDirection: "row",
		alignItems: "center",
		minHeight: ROW_MIN_HEIGHT,
		paddingVertical: space.md,
	},
	helpSlot: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
	},
	helpAction: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 0,
		width: HELP_WIDTH,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: space.md,
	},
	/** The rail's slot: the row's full height, so the rail can be centred inside it. */
	railSlot: {
		position: "absolute",
		left: space.xs,
		top: 0,
		bottom: 0,
		justifyContent: "center",
	},
	rail: {
		width: RAIL_WIDTH,
		height: RAIL_HEIGHT,
		borderRadius: radius.full,
	},
	main: {
		flex: 1,
		// `titleLine` and `metaLine` are two lines of one statement — what this order is,
		// and what it needs — so they stack at `TEXT_STACK_GAP`, the same shape as
		// `./list-row`'s `body`. `space.*` separates blocks, not lines inside one.
		gap: TEXT_STACK_GAP,
		paddingLeft: space.lg,
	},
	/** Two sizes on one line, met at the baseline or the line reads as two rows. */
	titleLine: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.sm,
	},
	metaLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	aside: {
		alignItems: "flex-end",
		gap: space.xs,
		paddingLeft: space.sm,
		// The row is full-bleed at every call site (interface.md §64's queue runs its
		// hairlines edge to edge), so the money column pays the screen's air itself rather
		// than borrowing a wrapper's — dropping the row in unpadded would otherwise put the
		// total on the bezel. The air cannot be forgotten, which is the same guarantee
		// `./empty-state` took for its own gutter: paid here, so it cannot be adjusted per
		// caller either.
		paddingRight: space.lg,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	chip: {
		alignSelf: "flex-start",
		justifyContent: "center",
		minHeight: CHIP_MIN_HEIGHT,
		paddingHorizontal: space.sm,
		paddingVertical: space.xs,
		borderRadius: radius.sm,
	},
	/** The box every kind shares; the kinds disagree only in fill, border and ink. */
	action: {
		justifyContent: "center",
		height: MIN_TOUCH_TARGET,
		paddingHorizontal: space.lg,
		borderRadius: radius.sm,
	},
	/** The quiet action's air: narrower than a boxed one, since it draws no box to fill. */
	actionQuiet: {
		paddingHorizontal: space.sm,
	},
});
