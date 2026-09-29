import Ionicons from "@expo/vector-icons/Ionicons";
import {
	customerTimeline,
	type FulfilmentKind,
	type OrderStatus,
	type TimelineStep,
} from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { formatClock, formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	type ThemeColors,
	useTheme,
} from "@/theme";

import { AnimateIn } from "./animate-in";
import { statusKey } from "./status-badge";
import { Text } from "./text";

/**
 * Where the order is, and what already happened.
 *
 * The steps come from `customerTimeline` in `@pymeshub/shared` — the same function the web
 * tracker renders, so the two surfaces cannot disagree about what a pickup order's steps
 * are or whether a cancelled order showed "en camino" on the way out. This file is the
 * drawing of that list and nothing else: no arithmetic over statuses here, and no `next`
 * computed locally, because a client that decides what comes next is a client that will
 * one day decide wrong.
 *
 * ## The shapes, and the word that carries them
 *
 * Every step is a word first. The marker beside it is a second signal for a reader who is
 * scanning rather than reading, and the four are distinguishable by *form*, not by tint:
 *
 * - `done` — a filled primary disc with a tick in `primaryForeground`;
 * - `current` — the ring (a primary disc with a `card` centre) **plus a halo**: one
 *   hairline circle in `primary` drawn just outside the marker. The halo is what makes the
 *   current step the loud one on the rail — the row that is happening is the row the eye
 *   should land on, and it is the only marker carrying a second shape;
 * - `upcoming` — the same ring in `border`, and nothing else;
 * - `skipped` — the ring in `border` with a `remove` dash inside it, plus the
 *   `order.track.skipped` caption under the word.
 *
 * Turn the colours off and the four still read: a tick, a halo, a bare ring, a dash. That
 * is the test a state conveyed by colour has to pass, and it is the reason the marker is
 * built from discs and a glyph rather than from a `borderWidth` and a shade.
 *
 * ## `skipped` is total here, and it is not reachable today
 *
 * `TimelineStep["state"]` in `@pymeshub/shared` declares four states and
 * `orderTrackingSchema` can carry any of them, but `customerTimeline` — the one function
 * this file reads its steps from, shared with the web tracker — only ever emits the other
 * three: a refusal collapses the rail to two steps rather than marking one skipped. So the
 * fourth branch is drawn for a state the wire permits and the current producer does not
 * send. It was not drawn for one at all before this: the marker fell through to the same
 * `border` ring as `upcoming`, so a step that arrives `skipped` would have been shown as a
 * step still to come — the one reading of that state that is wrong in the direction that
 * matters, because it promises work that is not going to happen.
 *
 * ## A completed step animates in
 *
 * The rail's rows arrive as a group (`AnimateIn`'s stagger stops at six, which is longer
 * than any timeline here), and a row's key includes its *state* — so the moment a step
 * becomes `done` the row remounts and its entrance plays again. That is the completion
 * being marked, and it is the right event to mark: a step that has just happened is the
 * one fact on this screen that is new. Under reduced motion the rise and the stagger go,
 * the fade stays, and the checkmark is there either way — the state change is never the
 * animation's to make.
 *
 * ## A row is also a row that moves, because a caption comes and goes
 *
 * The freshness line below "En camino" belongs to the step the order is *on*, so it is
 * there for exactly one state and the row it belongs to is a line taller while it is. That
 * makes the whole rail below it move — twice per step, once when the line arrives and once
 * when it leaves — on a screen that is re-read every five seconds. So the rows carry
 * `reorder`: the row that gains the line grows on the layout spring rather than snapping,
 * and the rows under it slide by the height of that line rather than jumping under the eye
 * of somebody who is waiting on them. See `./animate-in` for why the transition and the
 * mount-only entrance are one prop.
 *
 * ## A step that already happened says when
 *
 * A `done` step carries the clock time it was reached, read from the order's own event log
 * through `reachedAt`. This is the same fact the web tracker prints beside its steps
 * (`clock.format(step.at)` in `apps/web/app/(shop)/orders/[id]/page.tsx`), and the two
 * surfaces showing the same rail with a time on only one of them is the kind of difference
 * nobody reports and everybody notices. Nothing here is compared against `Date.now()` — an
 * order that was accepted at 14:02 says 14:02 whether the reader opens the screen a minute or
 * a week later — and a step the log has no event for simply gets no time, which is the
 * `formatRelative` rule ("one line fewer beats one claim more") applied to the other half.
 *
 * The *current* step keeps the relative line instead, because "hace 5 min" is the sentence a
 * customer refreshing a tracker is reading, and printing both would say the same timestamp
 * twice in two formats.
 *
 * ## The merchant rail, and why it is a variant and not a second file
 *
 * `app/(business)/merchant-order/[id]` draws the same five steps in the same order with the
 * same words — the list is still `customerTimeline`, so a merchant's order and the customer's
 * view of it cannot disagree about what has happened — inside a warm module under a dark
 * hero. Four things differ: the completed dot and its connector are `success` rather than
 * `primary` (a lime dot under a lime hero is the same green spent twice), the row floor is 52
 * rather than 44, the current step's centre is `foreground` rather than `card`, and `NOTE`
 * events are interleaved into the rail instead of dropped.
 *
 * The notes are the substantive difference and the reason a second component would have been
 * wrong. The customer's tracker is reassurance, so a comment somebody left is noise on it; the
 * operator's screen showed the raw log before this and argued for it — *"a note is work and a
 * rail is reassurance"*. Both are right, and the fact that they differ is the argument for one
 * component with a variant: two files would be two implementations of the same rail to keep
 * in step, and the step order is the one thing on this screen that must never drift from the
 * customer's.
 *
 * The customer variant is the default and every existing call site passes nothing, so this is
 * additive arithmetic rather than a rewrite — which matters because this file has no test and
 * the app has no component-render suite to catch a regression in it.
 */

export function OrderTimeline({
	status,
	fulfilment,
	reachedAt,
	variant = "customer",
	notes,
}: {
	status: OrderStatus;
	fulfilment: FulfilmentKind;
	/**
	 * When each step was reached, keyed by status, from the order's append-only event log —
	 * the event time of the step, not the time this screen last reached the network. Passed in
	 * rather than fetched here: this file draws the list, and the screen that owns the order is
	 * the one holding the log. A status absent from the map is a step whose time is unknown,
	 * and it is drawn with no time rather than with a guess.
	 */
	reachedAt?: Partial<Record<OrderStatus, Date>>;
	/**
	 * Which of the two rails this is. `customer` is the default and is the tracker every
	 * other surface draws; see the "## The merchant rail" section in this file's docblock for
	 * what the other one changes and why it is a variant rather than a second component.
	 */
	variant?: OrderTimelineVariant;
	/**
	 * `NOTE` events, for the merchant rail. The customer's tracker drops them — a note is
	 * somebody's comment, not a step — and the merchant's screen keeps them because
	 * `app/(business)/merchant-order/[id]` already showed the raw log and argued for it: "a
	 * note is work and a rail is reassurance". Read only when `variant === "merchant"`, and
	 * passed in rather than fetched for the same reason `reachedAt` is.
	 */
	notes?: OrderNoteEvent[];
}) {
	const steps = customerTimeline(status, fulfilment);

	/**
	 * One ordered list, built once and drawn the same either way.
	 *
	 * A note is interleaved by its own `createdAt` rather than appended, because "a note left
	 * at 12:50 between Ready and On the way" belongs between those two rows and drawing it
	 * last would say it was left after the courier left. The log is append-only and arrives
	 * ordered by `createdAt` ascending, so a single pass that walks both lists in step is
	 * enough — no sort, which is the kind of allocation a five-row rail should not need.
	 *
	 * A step still wins a tie: the status an order *reached* is a fact about the order and a
	 * note is a fact about it too, and the rail is a reading of the order's progress first.
	 * `<=` puts the step ahead, which is what that reading wants.
	 */
	const rows: OrderTimelineRow[] = [];
	if (variant === "merchant" && notes !== undefined && notes.length > 0) {
		// A copy, because `notes` is the caller's array and sorting it in place would be a
		// surprise to a screen holding it for something else.
		const ordered = [...notes].sort(
			(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
		);
		let cursor = 0;
		for (const step of steps) {
			// Every step's own time is what positions it when the log has one; a step with no
			// event cannot be placed against a note and stays where `customerTimeline` put it,
			// at the end of what came before.
			const at = reachedAt?.[step.status];
			while (at !== undefined && cursor < ordered.length) {
				// Bound once, read once: `noUncheckedIndexedAccess` makes a bare
				// `ordered[cursor]` a `| undefined` and a `!` on it is an assertion this
				// file does not make anywhere else.
				const next = ordered[cursor];
				if (next === undefined) break;
				if (next.createdAt.getTime() > at.getTime()) break;
				rows.push({ kind: "note", note: next });
				cursor += 1;
			}
			rows.push({ kind: "step", step, reachedAt: at });
		}
		// Notes written after the last step reached — the common case, since a note is
		// usually left once the order is where it is going to be.
		for (; cursor < ordered.length; cursor += 1) {
			const note = ordered[cursor];
			if (note !== undefined) rows.push({ kind: "note", note });
		}
	} else {
		for (const step of steps) {
			rows.push({ kind: "step", step, reachedAt: reachedAt?.[step.status] });
		}
	}

	return (
		<View
			style={styles.list}
			accessible={false}
			// The whole timeline is one reading, not seven items: a screen reader that walks
			// each dot announces "checkmark", "ring", "circle" between the words.
			accessibilityRole="list"
		>
			{rows.map((row, index) => (
				<TimelineRow
					// The state is part of the identity on purpose: a step that changes from
					// `upcoming` to `current` to `done` is a new row as far as the entrance is
					// concerned, and reusing the old one would spend the animation before the
					// news arrived.
					key={
						row.kind === "step"
							? `${row.step.status}:${row.step.state}`
							: `note:${row.note.id}`
					}
					row={row}
					index={index}
					last={index === rows.length - 1}
					variant={variant}
				/>
			))}
		</View>
	);
}

/**
 * Which rail this is. `customer` is the tracker; `merchant` is the operator's, inside
 * `app/(business)/merchant-order/[id]`.
 *
 * A word and not a boolean, for the reason `sheet.tsx`'s `variant` is a word: the two rails
 * differ in four visible things at once, and a set of booleans would permit a third
 * combination that nobody drew and that no one would then be responsible for.
 */
export type OrderTimelineVariant = "customer" | "merchant";

/**
 * One row of either rail, discriminated so a note can never be read as a step.
 *
 * A note has no `status` and no `state`, so a union that pretended otherwise would be a type
 * lying about what it held and every reader would have to re-check. The screen never inspects
 * the internals — it hands `notes` in and this file places them.
 */
type OrderTimelineRow =
	| { kind: "step"; step: TimelineStep; reachedAt?: Date }
	| { kind: "note"; note: OrderNoteEvent };

/**
 * The three fields this file needs off a `NOTE` event, declared here rather than taking
 * `OrderEvent[]` so a caller cannot hand over a whole event log and have the status events
 * silently ignored — which is exactly what would happen otherwise, since a note is the only
 * one of the eight this rail reads.
 */
export type OrderNoteEvent = {
	id: string;
	note: string | null;
	createdAt: Date;
};

function TimelineRow({
	row,
	index,
	last,
	variant,
}: {
	row: OrderTimelineRow;
	index: number;
	last: boolean;
	variant: OrderTimelineVariant;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();
	const merchant = variant === "merchant";

	// A note is not a step, so it has no status, no `TimelineStep["state"]` and no freshness
	// line. What it does have is a clock — the time the note was left, which is the one thing
	// about it an operator scanning the rail is looking for — and its own text.
	if (row.kind === "note") {
		return (
			<AnimateIn index={index} reorder>
				<View style={[styles.row, styles.rowMerchant]}>
					<View style={styles.rail}>
						<View style={[styles.marker, { backgroundColor: colors.muted }]}>
							<Ionicons
								name="chatbox-ellipses-outline"
								size={icon.control}
								color={colors.mutedForeground}
								accessibilityElementsHidden
								importantForAccessibility="no"
							/>
						</View>
						{last ? null : (
							<View
								style={[styles.connector, { backgroundColor: colors.border }]}
							/>
						)}
					</View>
					<View style={styles.body}>
						<Text variant="body" bold>
							{t("biz.order.noteEvent")}
						</Text>
						{row.note.note ? (
							<Text variant="label" tone="muted">
								{row.note.note}
							</Text>
						) : null}
						<Text variant="caption" tone="muted" tabular>
							{formatClock(row.note.createdAt, intlLocale)}
						</Text>
					</View>
				</View>
			</AnimateIn>
		);
	}

	const { step, reachedAt } = row;
	const label = t(statusKey(step.status));
	// `formatRelative` answers `null` when there is no truthful sentence to build (no
	// timestamp, an unreadable one, or an engine without `Intl.RelativeTimeFormat`). The
	// check below is the half of that contract this file owes — a `null` rendered into the
	// `{time}` slot would print "Actualizado null".
	const updatedLabel = reachedAt ? formatRelative(reachedAt, intlLocale) : null;

	return (
		<AnimateIn index={index} reorder>
			<View style={[styles.row, merchant ? styles.rowMerchant : null]}>
				<View style={styles.rail}>
					<StepMarker state={step.state} colors={colors} merchant={merchant} />
					{/* The connector is omitted under the last step rather than drawn and clipped:
					    a trailing stub below "Entregado" reads as one more thing to come. */}
					{last ? null : (
						<View
							style={[
								styles.connector,
								{
									// Green on the merchant rail and lime on the customer's, and the
									// distinction is the one the variant exists for: on a rail whose
									// dots are green, a lime connector is a second colour for the
									// same fact. See the file docblock.
									backgroundColor:
										step.state === "done"
											? merchant
												? colors.success
												: colors.primary
											: colors.border,
								},
							]}
						/>
					)}
				</View>
				<View style={styles.body}>
					<Text
						variant="body"
						bold={step.state === "current"}
						// A step that has not happened is quieter than one that has, and `skipped`
						// joins `upcoming` here rather than getting an ink of its own: the two are
						// told apart by the marker and by the caption below, which is the pair the
						// docblock at the top of this file says carries every state.
						tone={
							step.state === "upcoming" || step.state === "skipped"
								? "muted"
								: "default"
						}
					>
						{label}
					</Text>
					{/*
					 * The `{time}` slot of `order.track.updated` ("Actualizado {time}") used to be
					 * fed `order.track.live` — the *label* "En vivo" — so the app printed
					 * **"Actualizado En vivo"**: a word where a timestamp belongs, asserting a push
					 * this client does not have. There is no socket here; the screen polls
					 * `orders.byId` every five seconds. `docs/design-mobile.md` puts that in its
					 * out-list with no exception ("any 'hurry' that is not true"), and this is the
					 * line a customer waiting on an order reads to decide whether the screen is
					 * still telling the truth.
					 *
					 * What replaces it is a fact of the same kind and actually true: the event time
					 * of the step the order is on, formatted by `Intl` (see `lib/format.ts`) rather
					 * than concatenated. It is about the *order*, not about this client's
					 * connection, so it stays honest when a poll fails — an order that changed five
					 * minutes ago still says so. With no timestamp there is no sentence at all:
					 * one line fewer beats one claim more.
					 */}
					{step.state === "done" && reachedAt ? (
						/*
						 * A step that happened, with the clock time it happened at. `tabular`
						 * because it is digits in a column of words, and `caption`/`muted`
						 * because it is the step's detail rather than the step — the same
						 * weight the freshness line below carries, so the rail has one kind
						 * of annotation rather than two.
						 */
						<Text variant="caption" tone="muted" tabular>
							{formatClock(reachedAt, intlLocale)}
						</Text>
					) : null}
					{step.state === "current" && updatedLabel ? (
						<Text variant="caption" tone="muted">
							{t("order.track.updated", { time: updatedLabel })}
						</Text>
					) : null}
					{/*
					 * A step that is not going to happen says so in a word. The marker's dash is
					 * the scanning signal and this is the reading one, which is the order every
					 * row here puts the two in — and it is the half a screen reader gets, because
					 * the marker is a glyph and glyphs are not announced.
					 *
					 * No time on this line and no time on the row: `reachedAt` is built from the
					 * order's event log, a step that was skipped was never reached, and so it has
					 * no event to stamp it. A `done` step is the only one that draws a clock.
					 */}
					{step.state === "skipped" ? (
						<Text variant="caption" tone="muted">
							{t("order.track.skipped")}
						</Text>
					) : null}
				</View>
			</View>
		</AnimateIn>
	);
}

/**
 * One marker, total over the four states.
 *
 * The shapes are in the docblock at the top of the file; what matters here is that this
 * function **returns a drawing for every member of `TimelineStep["state"]`**, including
 * the one the current producer does not send. A marker that fell through to "not `done`,
 * not `current`" would draw `skipped` as `upcoming`, which on a tracker is the reading
 * that promises a step that is not coming.
 *
 * Both glyphs are sized by role, not by a metric they happen to share: `icon.control`, the
 * namespace that owns glyph sizes, drawn inside the 20-point disc `MARKER` builds. That the
 * value equals `type.label`'s line box is a coincidence of the two scales, not the reason —
 * a size taken from the type scale here would move when the type scale did.
 *
 * Nothing here animates. The halo on `current` is a static ring — the halo *is* the
 * emphasis, so under reduced motion there is nothing to remove and nothing to shorten,
 * which is why this file imports no motion vocabulary at all. What little movement the
 * rail has is the row entrance and the reorder spring in `./animate-in`, and both of those
 * already answer `useReducedMotion` themselves.
 */
function StepMarker({
	state,
	colors,
	merchant = false,
}: {
	state: TimelineStep["state"];
	colors: ThemeColors;
	/**
	 * The merchant rail's completed dot is `success`, not `primary`. Not a tint swap for its
	 * own sake: on the customer's tracker `primary` *is* the step colour and nothing else on
	 * the rail competes with it, while this rail sits inside a warm module under a lime hero
	 * where a lime dot would be spending the same green on a second meaning.
	 */
	merchant?: boolean;
}) {
	if (state === "done") {
		return (
			<View
				style={[
					styles.marker,
					{ backgroundColor: merchant ? colors.success : colors.primary },
				]}
			>
				<Ionicons
					name="checkmark"
					size={icon.control}
					color={colors.primaryForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>
		);
	}

	// A ring: a disc of the state's ink with the surface punched through the middle, so the
	// marker reads as an outline at any size. `upcoming` and `skipped` share the `border`
	// ink and are told apart by the glyph below; `current` takes `primary` and the halo.
	const ring = state === "current" ? "primary" : "border";

	return (
		<View style={[styles.marker, { backgroundColor: colors[ring] }]}>
			{state === "current" ? (
				/*
				 * The halo, drawn as a hairline circle with no fill — see `HALO` below for its
				 * size and why it spills, and the file's docblock for why `current` is the one
				 * state that gets a second mark.
				 */
				<View style={[styles.halo, { borderColor: colors.primary }]} />
			) : null}
			{state === "skipped" ? (
				<Ionicons
					name="remove"
					size={icon.control}
					color={colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			) : (
				<View
					style={[
						styles.dot,
						// The merchant's centre is `foreground`, not `card`. A white centre in a
						// `#F6F5F1` module is a bright dot in a warm field; the customer's rail has
						// the opposite problem, which is why this is the variant and not a token.
						{ backgroundColor: merchant ? colors.foreground : colors.card },
					]}
				/>
			)}
		</View>
	);
}

/**
 * The marker's diameter, its centre, and the rail joining them — all off the spacing scale.
 *
 * `space.lg + space.xs` is a size no step of the scale is, and it is the smallest one that
 * still holds a tick and reads as a marker beside a line of body text. The connector is
 * half of a step because it is a hairline between two 44-point rows: a full `xs` would be a
 * bar as wide as the dot inside it.
 */
const MARKER = space.lg + space.xs;
const DOT = space.sm;
const CONNECTOR = space.xs / 2;

/**
 * The merchant row's floor, and it is off the spacing scale like `MARKER` is.
 *
 * 52 is `space.huge` (32) plus `space.xl` (20), and it is a floor rather than a step because
 * the thing it measures is a two-line stack's height — a word and a clock — which is the same
 * arithmetic `type.heading.lineHeight` plus `type.caption.lineHeight` is. The customer's 44
 * is `MIN_TOUCH_TARGET` because that rail is read in one pass; this one is scanned, so its
 * rows are allowed the air the scanning needs.
 */
const MERCHANT_ROW = space.huge + space.xl;

/**
 * The halo: one `xs` step wider than the marker it circles, so it stands `space.xs / 2`
 * clear of it on every side.
 *
 * It is drawn with no `overflow` set on the marker, so it is free to spill over the rail's
 * own width (`MARKER` — the number every row's text is positioned off). That is the point:
 * a halo that fitted inside the rail would have to widen it, and every line of every row
 * would shift the first time an order advanced into `current`. The offsets are what centre
 * it — the two boxes differ by `space.xs`, so each side takes half of that.
 *
 * Its fill is deliberately nothing. The marker's own `card` dot is the only place this
 * component assumes a surface, and that is one it is already inside; a halo with a fill
 * would have to know what is behind *it*, which is the screen's business and not this
 * file's.
 */
const HALO = MARKER + space.xs;

const styles = StyleSheet.create({
	list: { gap: 0 },
	row: { flexDirection: "row", gap: space.md, minHeight: MIN_TOUCH_TARGET },
	/**
	 * 52 rather than the 44 floor, and it is a floor rather than a fixed height for the same
	 * reason every other control here is: a rail row holds two lines of type and a timestamp,
	 * and at 200% Dynamic Type the second line is the one that grows. 52 is the merchant
	 * system's own number for this row.
	 */
	rowMerchant: { minHeight: MERCHANT_ROW },
	rail: { alignItems: "center", width: MARKER },
	marker: {
		width: MARKER,
		height: MARKER,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		marginTop: space.xs,
	},
	dot: { width: DOT, height: DOT, borderRadius: radius.full },
	halo: {
		position: "absolute",
		width: HALO,
		height: HALO,
		borderRadius: radius.full,
		borderWidth: 1,
		top: -space.xs / 2,
		left: -space.xs / 2,
	},
	connector: { flex: 1, width: CONNECTOR, marginVertical: space.xs / 2 },
	body: {
		flex: 1,
		paddingBottom: space.lg,
		paddingTop: space.xs,
		gap: space.xs / 2,
	},
});
