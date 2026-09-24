import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import type { OrderStatus } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { icon, radius, space, type ThemeColors, type, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * An order's state, as a word.
 *
 * The colour is the second signal, never the only one, and this is where that rule is
 * easiest to break: eight states as eight pills is a rainbow, and a customer with a colour
 * vision deficiency sees four indistinguishable greys. So every badge carries an **icon**
 * too, and both are decorations around the **word** — `order.status.PREPARING` reads
 * "En preparación", which is the part that actually says what is happening.
 *
 * The pairs come from the tokens rather than from a hue chosen here: `statusPreparing` and
 * `statusAccepted` are deliberately close cousins — minutes apart in the same kitchen —
 * and telling them apart by tint alone was never the plan.
 *
 * ## The word is not optional, in either size
 *
 * Both variants render the status word, and the compact one is named `dot` for its *size*
 * rather than for its contents. That distinction is the whole reason this paragraph exists:
 * "dot" reads like the icon-only variant, an icon-only status chip on a list row is a tint
 * plus a glyph for a sighted reader (`docs/design.md`: colour is never the only signal), and
 * a reader who cannot see the tint is left with an icon they have to learn. There is
 * deliberately no size that omits the label — the smallest thing this component can draw is
 * an icon beside a word, and a screen that cannot fit that has a layout problem rather than a
 * badge problem.
 *
 * ## The ink is exported, because the status word is sometimes a headline
 *
 * `statusForeground` is the same `STATUS_STYLE` map read for its ink alone.
 * `app/order/[id].tsx` draws the status at `display` size above the timeline — the answer to
 * "where is it" is the largest thing on a screen whose whole job is that question — and it
 * takes the ink from here rather than reaching for a colour of its own. One map, two sizes.
 */
const STATUS_STYLE: Record<
	OrderStatus,
	{
		background: keyof ThemeColors;
		foreground: keyof ThemeColors;
		icon: React.ComponentProps<typeof Ionicons>["name"];
	}
> = {
	PENDING: {
		background: "statusPending",
		foreground: "statusPendingForeground",
		icon: "time-outline",
	},
	ACCEPTED: {
		background: "statusAccepted",
		foreground: "statusAcceptedForeground",
		icon: "checkmark-circle-outline",
	},
	PREPARING: {
		background: "statusPreparing",
		foreground: "statusPreparingForeground",
		icon: "restaurant-outline",
	},
	READY: {
		background: "statusReady",
		foreground: "statusReadyForeground",
		icon: "bag-handle-outline",
	},
	OUT_FOR_DELIVERY: {
		background: "statusOutForDelivery",
		foreground: "statusOutForDeliveryForeground",
		icon: "bicycle-outline",
	},
	COMPLETED: {
		background: "statusCompleted",
		foreground: "statusCompletedForeground",
		icon: "checkmark-done-outline",
	},
	CANCELLED: {
		background: "statusCancelled",
		foreground: "statusCancelledForeground",
		icon: "close-circle-outline",
	},
	REJECTED: {
		background: "statusRejected",
		foreground: "statusRejectedForeground",
		icon: "alert-circle-outline",
	},
};

export function StatusBadge({
	status,
	/** `dot` for a list row, `pill` for a detail screen. */
	size = "pill",
}: {
	status: OrderStatus;
	size?: "pill" | "dot";
}) {
	const { colors } = useTheme();
	const { t } = useT();
	const style = STATUS_STYLE[status];

	return (
		<View
			style={[
				styles.badge,
				size === "dot" ? styles.dot : styles.pill,
				{ backgroundColor: colors[style.background] },
			]}
			// One node, one sentence: "Pedido: En preparación". Without this the row reads
			// as an unlabelled icon followed by a bare word, and the status has no key of its
			// own — `order.title` is the closest existing one. It is `text` rather than an
			// unroled container so a screen reader reads it as words: this is a fact on the
			// screen, not a control, and a container that announces itself as one invites a tap
			// that does nothing.
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${t("order.title")}: ${t(statusKey(status))}`}
		>
			<Ionicons
				name={style.icon}
				// `icon.inline` in both sizes, which is the size `theme/tokens.ts` names for
				// exactly this mark: "the glyph inside a status badge". It was 14 in the
				// compact badge — a point smaller, unnamed, on the argument that the glyph is
				// sized down with the padding. The padding is what makes the badge compact; a
				// 15-point glyph sits inside the label's 18-point line box either way, so the
				// extra point costs nothing and buys the mark its name back.
				size={icon.inline}
				color={colors[style.foreground]}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant="label" bold style={{ color: colors[style.foreground] }}>
				{t(statusKey(status))}
			</Text>
		</View>
	);
}

/**
 * The ink a status is written in, for the one place it is written larger.
 *
 * `app/order/[id].tsx` sets the status word at `display` above the timeline, and it draws it
 * in this rather than in `foreground`: the status's own ink is the half of the pair that
 * says *which* status it is, and the two-token pairs are what the eight states are for. Every
 * one of the eight is dark enough on `background` to read as body text in the light palette
 * (`#613897` on `#fefdfa`, `#005d5e` on `#fefdfa`, …) and light enough in the dark one, so the
 * same token carries the word on a tint and the word at 28 points.
 */
export function statusForeground(status: OrderStatus): keyof ThemeColors {
	return STATUS_STYLE[status].foreground;
}

/**
 * `PREPARING` → `order.status.PREPARING`.
 *
 * The keys are spelled out in the dictionary rather than lower-cased from the enum, so a
 * status added to the domain is a compile error here — `OrderStatus` is the key of a
 * `Record`, and a missing entry fails `tsc` before it fails a screen.
 */
export function statusKey(status: OrderStatus): MessageKey {
	return `order.status.${status}` as MessageKey;
}

/**
 * The two vertical insets, and why neither is a `space` step.
 *
 * A badge is its label's line box (18) plus twice one of these, so the number is measured
 * against the text inside the badge rather than against the rhythm *between* elements — which
 * is what `space` is a scale of. No step lands the two sizes where they belong: `space.xs` (4)
 * would put both at 22, the same height under two names, and `space.sm` (8) would put the pill
 * at 34, where it reads as a band across the row rather than as a badge. Derived from the
 * scale rather than typed as literals — `space.md / 2` is the pill's 30 and `space.xs / 2` the
 * compact badge's 22 — so the intent survives even though neither is a step of it. There is no
 * token for this and there is not going to be one: `theme/tokens.ts` has four radii and one
 * spacing scale, and a third spacing scale for badges is how a design system grows a second
 * opinion. This is the documented exception, not a value somebody liked.
 */
const PILL_INSET_Y = space.md / 2;
const DOT_INSET_Y = space.xs / 2;

/**
 * How tall a badge of each size draws, at the reader's own font scale.
 *
 * This is the badge's *own* measure, exported for the one caller that has to stand in for it:
 * `app/orders.tsx` draws a badge-shaped block in its row skeleton, and a skeleton is
 * only worth having if the layout it stands in for does not move when the data lands. The
 * alternative was a second copy of `space.md + label.lineHeight * 2` written into that
 * screen's style sheet, which would have been correct on the day it was typed and wrong the
 * first time either inset changed — the same argument that made
 * `./action-bar`'s `ACTION_BAR_CLEARANCE` a derived export rather than a constant in the two
 * screens that reserve room for it.
 *
 * It scales with `fontScale` because the label inside it does: `./text` sets no
 * `allowFontScaling={false}` anywhere, so a badge at 200% text is a taller badge, and a
 * skeleton that ignored that would be the one thing on the screen that did not grow.
 *
 * The *line* scales and the inset does not. `paddingVertical` is the static `PILL_INSET_Y`
 * (`:223`, `paddingVertical: PILL_INSET_Y`) and `DOT_INSET_Y` (`:228`, `paddingVertical:
 * DOT_INSET_Y`) — the same points at 200% as at 100% — so multiplying the
 * whole sum by `fontScale` over-reported the badge at every size but 1: the pill came out 60
 * where the badge is 48, and the `OrderRowSkeleton` that reserves this height held the row 12
 * points too tall. That is the jump this export exists to prevent, arriving from inside it.
 *
 * A default rather than a required argument, because the callers that only want the 100%
 * figure are the ones reading it as a number about the component rather than about a screen.
 */
export function statusBadgeHeight(size: "pill" | "dot", fontScale = 1): number {
	const inset = size === "pill" ? PILL_INSET_Y : DOT_INSET_Y;
	return Math.round(type.label.lineHeight * fontScale + inset * 2);
}

const styles = StyleSheet.create({
	badge: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: space.xs,
		borderRadius: radius.full,
	},
	/** The detail-screen size: `space.md` across, so the word has air around it. */
	pill: { paddingHorizontal: space.md, paddingVertical: PILL_INSET_Y },
	/**
	 * The compact size a list row holds: one step narrower, and named for its diameter rather
	 * than for its contents. It carries the same word — see the note at the top of this file.
	 */
	dot: { paddingHorizontal: space.sm, paddingVertical: DOT_INSET_Y },
});
