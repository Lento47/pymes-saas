import type { MessageKey } from "@pymeshub/i18n";
import {
	type DashboardPreferences,
	formatMoney,
	isCurrency,
	type OperationalPulse,
} from "@pymeshub/shared";
import { Fragment } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useT } from "@/lib/i18n";
import { duration, staggerDelay } from "@/lib/motion";
import { NO_VALUE } from "@/lib/no-value";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	merchantType,
	radius,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
	weight,
} from "@/theme";

import { Skeleton } from "./skeleton";
import { Text } from "./text";

/**
 * The operational pulse, interface.md §14 — the most distinctive surface in the merchant
 * console: today's three figures on one dark band.
 *
 * §14 draws the band in exactly two colours, `#241922` behind and `#F6F2E9` in front, and
 * the palette folds that register into the two keys every component already reads: the
 * surface is `colors.foreground`, the ink on it is `colors.background`. Taking the pair
 * from the keys rather than from the contract's hexes is what keeps the band owned by the
 * palette that owns everything else on the screen — and it is also why nothing else is
 * spent here: with two colours, hierarchy inside the band is size and weight, and nothing
 * else.
 *
 * Which is why the deltas carry no colour at all. Semantic green and red would fail
 * contrast at a 12-point delta line — §14's own reason — so direction is the explicit
 * sign, `+11.8%` and `-3.1%`, and the sign is the one signal that survives a reader who
 * sees no colour at all. That is the rule `./status-badge` argues at length about the
 * status word, and this band is the place it matters most: three numbers a seller reads
 * at a glance while a queue is moving behind them.
 *
 * No metric is a card. Three cards here would be three surfaces with a fill nobody can
 * see (`theme/tokens.ts` argues that about the card shadow), around a module that is
 * already the loudest object on the screen; the figures sit directly on it, told apart
 * by hairline rules and by nothing else. The module is inset by the page gutter and
 * cornered at the module step — the screen's edge is not its edge. Its height is not
 * typed here either: the header's line, the metric stack and the `space.xxl` padding
 * sum the height, and at 200% text the module grows with the text, because no height
 * was ever written down to stop it.
 *
 * Every line is only what the API sent. A metric with no value prints an em dash, and a
 * delta of `null` renders nothing at all: the server omits a comparison when there is no
 * base. The same honesty governs the entrance (§15): the figures arrive as text that
 * fades up, and nothing counts from zero — a count-up is a second, invented number shown
 * on the way to the true one.
 *
 * ## Loading
 *
 * `data === null` draws the same band — the header line is already known, because
 * `dateLabel` is a prop — with one `./skeleton` block per column standing in for that
 * column's figures. The block is the column's whole stack, at the reader's font scale,
 * because a block that stood in for the value alone would promise a shorter band and then
 * grow it: the swap would be the flicker the contract forbids. The one day this is wrong
 * is a day with no base, where every delta is `null` and the loaded band settles a delta
 * line shorter — `./skeletons` documents the same inference under "what a block does when
 * the screen's block is optional", and gives the same answer: the fuller shape, because
 * the reader is at the top of the screen and a block one short costs nothing they can see.
 *
 * ## Motion (§15)
 *
 * On first appearance the three columns fade in and rise over
 * `duration.standard`, staggered `staggerDelay` apart — and never again: a refresh that
 * changes a figure changes text, it does not replay an arrival. This does not reuse
 * `./animate-in`, whose entrance is `duration.entering` and whose reduced-motion answer
 * keeps a fade, because §14 names `standard` for this band and asks it to *appear* under
 * reduced motion; the entrance is written here rather than bent there.
 *
 * ## Reduced motion
 *
 * No movement: the column renders as a plain view, already at rest, and the band simply
 * appears. A fade is the half of a transition that survives the setting in
 * `./animate-in`, but §14 asks for an appearance and not a crossfade, and the figures —
 * the message — are on the band from the first frame either way.
 */

/**
 * The band's numbers, as the dashboard read returns them.
 *
 * The fields are the server's pulse values. Missing comparisons render as absence rather
 * than as a delta invented around them.
 */
export type MerchantPulseData = Pick<
	OperationalPulse,
	| "merchantNetSalesMinor"
	| "orderCount"
	| "averageOrderValueMinor"
	| "currency"
	| "comparisons"
	/**
	 * Orders at this location that have not reached COMPLETED, CANCELLED or
	 * REJECTED — the one field of `operationalPulseSchema` the band itself does
	 * not draw.
	 *
	 * It is here rather than read off `home.data.pulse` at the call site because
	 * this is the type that already names what the pulse carries, and the home's
	 * queue summary needs it to say how much of the backlog the five-row preview
	 * is hiding. Adding it to a `Pick` widens the type; it does not oblige the
	 * band to draw it, and the band draws the same three columns either way.
	 */
	| "active"
>;

/**
 * What a metric with no value prints.
 *
 * An em dash is punctuation, so it cannot be anybody's figure; it is what a table in any
 * language prints for "no value here", and it is the same glyph in both dictionaries,
 * which is why it is a constant and not a key in `@pymeshub/i18n`: there is nothing
 * in it to translate. It now lives in `@/lib/no-value` with the other two copies that
 * used to sit in `app/account.tsx` and `app/(business)/index.tsx` — one of which had
 * rotted, which is the whole reason there is one.
 */

/**
 * The band's small step: the two word layers the contract writes at 11 points.
 *
 * The app's scale starts at `caption`'s 12 and `merchantType` adds nothing under its own
 * 20, so the contract's 11 is a size the vocabulary does not carry. It is the same move
 * `TAB_BAR_LABEL_SIZE` makes — a size below the floor, named where it is used because it
 * is the surface's own chrome and not app text — and it reads on `caption`'s 16-point
 * line box, which is also what keeps it measurable: the date beside it and the delta
 * under a figure are both `type.caption` lines, so one line of the band's small text is
 * counted with one ruler everywhere, including the loading block's height below.
 */
const PULSE_SMALL = { fontSize: 11, lineHeight: 16 } as const;

/**
 * The one tracking the contract writes, on the one line it writes it on.
 *
 * §14 asks for `letterSpacing: 1` on the header's uppercased title and asks for nothing
 * on the words under the figures, so a bare `1` in the style sheet below is named here —
 * a number that reads as a rounding error until it is named as a decision.
 */
const PULSE_TRACKING = 1;

/**
 * The band's three columns, in the order §14 draws them: net sales at 44, orders at 24,
 * the average ticket at 32.
 *
 * Flex ratios and not pixels, which is the whole point of the three numbers: pixels would
 * pin the band to one device, ratios keep the net-sales column the widest thing on it at
 * every width the phone is held at. `labelKey` is typed against the closed union so a
 * key that stops existing is a compile error in this table rather than a band showing a
 * translation key, and the two readers are functions rather than fields so the loading
 * branch and the loaded branch below can map the same table and never grow a second copy
 * of the ratios.
 */
type PulseColumn = {
	id: DashboardPreferences["metrics"][number];
	/** Flex ratio, not pixels — see above. */
	flex: number;
	/** The word under the figure, named in the dictionary. */
	labelKey: MessageKey;
	/** The figure, already formatted, or the em dash when the day has none. */
	value: (data: MerchantPulseData, intlLocale: string) => string;
	/** The day's delta, already signed, or `null` — which renders nothing. */
	delta: (data: MerchantPulseData, intlLocale: string) => string | null;
};

const COLUMNS: ReadonlyArray<PulseColumn> = [
	{
		id: "net_sales",
		flex: 44,
		labelKey: "biz.pulse.netSales",
		value: (data, intlLocale) =>
			moneyOrNothing(data.merchantNetSalesMinor, data.currency, intlLocale),
		delta: (data, intlLocale) => {
			const previousDay = data.comparisons?.find(
				({ period }) => period === "previous_day",
			);
			return previousDay
				? signedMoney(previousDay.salesDeltaMinor, data.currency, intlLocale)
				: null;
		},
	},
	{
		id: "orders",
		flex: 24,
		labelKey: "biz.dashboard.ordersToday",
		// `NO_VALUE` and not `String(data.orderCount)`, which was here and printed the
		// word "undefined" in 34-point figures on the band's own canvas whenever the read
		// left the count out. The other two columns have gone through `moneyOrNothing`
		// since the module was written, and this one did not — so a shop with no orders
		// counted yet drew a dash beside two dashes on its left and right, and a shop the
		// API answered partially drew a bug where a dash belonged. `== null` rather than
		// `=== null` because a count that arrives absent is the same case as one that
		// arrives null, and `String` is what turned the first into the word.
		value: (data) =>
			data.orderCount == null ? NO_VALUE : String(data.orderCount),
		delta: (data) => {
			const previousDay = data.comparisons?.find(
				({ period }) => period === "previous_day",
			);
			return previousDay ? signedCount(previousDay.orderDelta) : null;
		},
	},
	{
		id: "average_order",
		flex: 32,
		labelKey: "biz.pulse.avgTicket",
		value: (data, intlLocale) =>
			moneyOrNothing(data.averageOrderValueMinor, data.currency, intlLocale),
		delta: () => null,
	},
	{
		id: "active_orders",
		flex: 32,
		labelKey: "customize.activeOrders",
		value: (data) => String(data.active),
		delta: () => null,
	},
];

/**
 * The rule between two columns, and the register it is drawn in.
 *
 * §14 draws this separator in the band's ivory at about 20% alpha, and the palette holds
 * no alpha colours — the note on `./skeleton`'s shimmer band is the same constraint — so
 * the rule takes `mutedForeground`, the nearest solid token in that register: the mid-ink
 * the band's own captions would use, read against the dark surface. `RULE_HEIGHT` is the
 * contract's 56 and it does not scale with the reader's text, because the rule is the
 * row's furniture and not a line of it; centred, it stays a divider rather than becoming
 * a bar.
 */
const RULE_HEIGHT = 56;

/**
 * The loading block's width, as a share of its column and as nothing else.
 *
 * A share because the figure it stands in for is a figure nobody has yet: `./skeletons`
 * makes the same argument for its chips, and a width in points would be a measurement
 * somebody took of a number that does not exist.
 */
const METRIC_SKELETON_WIDTH = "88%" as const;

/**
 * One metric column's loading block, at the reader's text scale.
 *
 * Derived from the loaded column's own lines rather than measured beside them — the metric
 * line, the word under it and the delta line scaled, plus the two gaps between them, which
 * are static points and do not scale (`./skeletons`' rule: the lines scale, the padding
 * does not). A block that stood in for the value alone would promise a shorter band and
 * then grow it, and the swap would move the band under the reader — the one thing a
 * skeleton exists to prevent. See the file docblock for the one day the fuller shape is
 * wrong.
 */
export function pulseColumnHeight(fontScale: number): number {
	return (
		Math.round(
			(merchantType.metric.lineHeight +
				PULSE_SMALL.lineHeight +
				type.caption.lineHeight) *
				fontScale,
		) +
		space.xs +
		TEXT_STACK_GAP
	);
}

/**
 * The module's height at rest — the sum the file docblock describes, written as
 * the sum rather than as the number: the vertical padding, the header's small line, the
 * step to the figures and one column's stack, each term scaled only where the text behind
 * it scales. Exported so the skeleton that stands in for the whole module before the
 * module itself is mounted (`app/(business)/index`'s `HomeSkeleton`) reads the measure
 * from here and the wait and the arrival cannot disagree about the module's height
 * without this file saying so.
 */
export function pulseBandHeight(fontScale: number): number {
	return (
		space.xxl * 2 +
		Math.round(PULSE_SMALL.lineHeight * fontScale) +
		space.md +
		pulseColumnHeight(fontScale)
	);
}

/**
 * A metric's money, or the dash when the day has none of it.
 *
 * `data.currency` is a string off the wire and `formatMoney` takes the closed union: a
 * cast would trust a string nobody proved, and `isCurrency` costs one array scan. A code
 * the table does not know is the same case as no data — the em dash, not a formatted
 * guess.
 */
function moneyOrNothing(
	minor: number | null,
	currency: string,
	intlLocale: string,
): string {
	if (minor === null || !isCurrency(currency)) return NO_VALUE;
	return formatMoney(minor, currency, {
		locale: intlLocale,
		currencyDisplay: "narrowSymbol",
	});
}

/**
 * A money delta, signed, or nothing when there is no comparison.
 */
function signedMoney(
	delta: number,
	currency: string,
	intlLocale: string,
): string | null {
	if (!isCurrency(currency)) return null;
	const body = formatMoney(delta, currency, {
		locale: intlLocale,
		currencyDisplay: "narrowSymbol",
	});
	return delta > 0 ? `+${body}` : body;
}

/**
 * An orders delta, signed the same way the percentages are: "+6", "-6", and a bare "0"
 * for a day that matched yesterday exactly.
 */
function signedCount(delta: number | null): string | null {
	if (delta === null) return null;
	return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * What a column says to a screen reader: the word, the figure, and the day's delta, as
 * one sentence rather than three stray lines the reader has to assemble in order.
 */
function spokenColumn(
	label: string,
	value: string,
	delta: string | null,
): string {
	return delta === null ? `${label}: ${value}` : `${label}: ${value}, ${delta}`;
}

/**
 * One column of the band: the figure, the word under it, the day's delta under that.
 *
 * The entrance runs when the animated column mounts. Query refreshes only re-render it,
 * so they never replay the arrival.
 *
 * ## Reduced motion
 *
 * The wrapper is a plain view when motion is reduced.
 */
function PulseMetric({
	flex,
	stacked,
	index,
	label,
	value,
	delta,
	ink,
	size = "metric",
}: {
	flex: number;
	stacked?: boolean;
	/** Position in the group. Drives the stagger and nothing else. */
	index: number;
	label: string;
	value: string;
	delta: string | null;
	ink: string;
	size?: "metric" | "small";
}) {
	const reduceMotion = useReducedMotion();

	const spoken = spokenColumn(label, value, delta);

	const content = (
		<>
			<Text
				tabular
				numberOfLines={stacked ? undefined : 1}
				adjustsFontSizeToFit={!stacked}
				minimumFontScale={0.6}
				style={[
					size === "small" ? styles.metricValueSmall : styles.metricValue,
					{ color: ink },
				]}
			>
				{value}
			</Text>
			<Text
				numberOfLines={stacked ? undefined : 2}
				style={[styles.metricLabel, { color: ink }]}
			>
				{label}
			</Text>
			{delta === null ? null : (
				<Text
					variant="caption"
					tabular
					numberOfLines={stacked ? undefined : 1}
					adjustsFontSizeToFit={!stacked}
					minimumFontScale={0.6}
					style={[styles.metricDelta, { color: ink }]}
				>
					{delta}
				</Text>
			)}
		</>
	);

	const columnStyle = [
		styles.column,
		stacked ? { width: "100%" as const } : { flex },
	];

	if (reduceMotion) {
		return (
			<View
				style={columnStyle}
				accessible
				accessibilityRole="text"
				accessibilityLabel={spoken}
			>
				{content}
			</View>
		);
	}

	return (
		<Animated.View
			entering={FadeInUp.duration(duration.standard).delay(staggerDelay(index))}
			style={columnStyle}
			accessible
			accessibilityRole="text"
			accessibilityLabel={spoken}
		>
			{content}
		</Animated.View>
	);
}

/**
 * The band itself: header line, then the three columns the contract lays out.
 */
export function MerchantPulse({
	data,
	dateLabel,
	metrics = ["net_sales", "orders", "average_order"],
	layout = "band",
	paint = "invert",
	compact = false,
}: {
	data: MerchantPulseData | null;
	dateLabel: string;
	metrics?: DashboardPreferences["metrics"];
	layout?: DashboardPreferences["layouts"]["pulse"];
	paint?: "invert" | "accent";
	compact?: boolean;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();
	const { fontScale } = useWindowDimensions();
	const stacked = fontScale >= 1.8;
	const cards = layout === "cards";
	const hero = layout === "hero";
	const tally = layout === "stack";
	const filled = !cards && !tally;
	const accent = paint === "accent";
	const ink = filled
		? accent
			? colors.primaryForeground
			: colors.background
		: accent
			? colors.primary
			: colors.foreground;
	const bandFill = accent ? colors.primary : colors.foreground;
	const cardBorder = accent ? colors.primary : colors.border;
	const columns = metrics.flatMap((id) => {
		const found = COLUMNS.find((column) => column.id === id);
		return found ? [found] : [];
	});
	const singleColumn = columns[0];
	if (compact && columns.length === 1 && singleColumn) {
		const column = singleColumn;
		return (
			<View
				style={[
					styles.compactCard,
					{ backgroundColor: colors.card, borderColor: cardBorder },
				]}
			>
				<View style={styles.compactHeader}>
					<Text variant="caption" tone="muted">
						{t("biz.dashboard.today")}
					</Text>
					<Text variant="caption" tone="muted">
						{dateLabel}
					</Text>
				</View>
				<View
					style={styles.compactMetric}
					accessible
					accessibilityLabel={
						data
							? spokenColumn(
									t(column.labelKey),
									column.value(data, intlLocale),
									null,
								)
							: t("state.loading")
					}
				>
					<Text variant="body" style={{ flex: 1 }}>
						{t(column.labelKey)}
					</Text>
					{data ? (
						<Text
							variant="heading"
							bold
							tabular
							style={{ color: accent ? colors.primary : colors.foreground }}
						>
							{column.value(data, intlLocale)}
						</Text>
					) : (
						<Skeleton style={{ width: 48, height: 24 }} />
					)}
				</View>
			</View>
		);
	}

	const rule = (index: number) =>
		index > 0 && !cards ? (
			<View
				style={[
					styles.rule,
					stacked && {
						width: "100%",
						height: StyleSheet.hairlineWidth,
					},
					{ backgroundColor: colors.mutedForeground },
				]}
			/>
		) : null;
	const figures =
		data === null
			? columns.map((column, index) => (
					<Fragment key={column.labelKey}>
						{rule(index)}
						<View
							style={[
								styles.column,
								stacked ? { width: "100%" } : { flex: column.flex },
								cards
									? [
											styles.card,
											{
												backgroundColor: colors.card,
												borderColor: cardBorder,
											},
										]
									: null,
							]}
						>
							<Skeleton
								style={[
									styles.metricSkeleton,
									{ height: pulseColumnHeight(fontScale) },
								]}
							/>
						</View>
					</Fragment>
				))
			: columns.map((column, index) => (
					<Fragment key={column.labelKey}>
						{rule(index)}
						{cards ? (
							<View
								style={[
									styles.card,
									stacked ? { width: "100%" } : { flex: column.flex },
									{
										backgroundColor: colors.card,
										borderColor: cardBorder,
									},
								]}
							>
								<PulseMetric
									flex={column.flex}
									stacked={stacked}
									index={index}
									label={t(column.labelKey)}
									value={column.value(data, intlLocale)}
									delta={column.delta(data, intlLocale)}
									ink={ink}
								/>
							</View>
						) : (
							<PulseMetric
								flex={column.flex}
								stacked={stacked}
								index={index}
								label={t(column.labelKey)}
								value={column.value(data, intlLocale)}
								delta={column.delta(data, intlLocale)}
								ink={ink}
							/>
						)}
					</Fragment>
				));

	if (hero) {
		const lead = columns[0];
		const rest = columns.slice(1);
		if (!lead) return null;
		return (
			<View style={[styles.band, { backgroundColor: bandFill }]}>
				<View
					style={[
						styles.header,
						stacked && { flexWrap: "wrap", gap: space.xs },
					]}
				>
					<Text style={[styles.bandTitle, { color: ink }]}>
						{t("biz.dashboard.today")}
					</Text>
					<Text variant="caption" tabular style={{ color: ink }}>
						{dateLabel}
					</Text>
				</View>
				<View style={styles.heroLead}>
					{data === null ? (
						<Skeleton
							style={[
								styles.metricSkeleton,
								{ height: pulseColumnHeight(fontScale) },
							]}
						/>
					) : (
						<PulseMetric
							flex={lead.flex}
							stacked
							index={0}
							label={t(lead.labelKey)}
							value={lead.value(data, intlLocale)}
							delta={lead.delta(data, intlLocale)}
							ink={ink}
						/>
					)}
				</View>
				{rest.length > 0 ? (
					<View
						style={[styles.heroRest, stacked && { flexDirection: "column" }]}
					>
						{rest.map((column, index) => (
							<View
								key={column.labelKey}
								style={stacked ? { width: "100%" as const } : { flex: 1 }}
							>
								{data === null ? (
									<Skeleton
										style={[
											styles.metricSkeleton,
											{ height: pulseColumnHeight(fontScale) * 0.6 },
										]}
									/>
								) : (
									<PulseMetric
										flex={column.flex}
										stacked={stacked}
										index={index + 1}
										label={t(column.labelKey)}
										value={column.value(data, intlLocale)}
										delta={column.delta(data, intlLocale)}
										ink={ink}
										size="small"
									/>
								)}
							</View>
						))}
					</View>
				) : null}
			</View>
		);
	}

	if (tally) {
		return (
			<View
				style={[
					styles.stackBlock,
					{
						backgroundColor: colors.card,
						borderColor: cardBorder,
					},
				]}
			>
				<View
					style={[
						styles.header,
						stacked && { flexWrap: "wrap", gap: space.xs },
					]}
				>
					<Text style={[styles.bandTitle, { color: ink }]}>
						{t("biz.dashboard.today")}
					</Text>
					<Text
						variant="caption"
						tabular
						style={{ color: colors.mutedForeground }}
					>
						{dateLabel}
					</Text>
				</View>
				{columns.map((column) => {
					const spoken = spokenColumn(
						t(column.labelKey),
						data === null ? "" : column.value(data, intlLocale),
						data === null ? null : column.delta(data, intlLocale),
					);
					return (
						<View
							key={column.labelKey}
							style={[styles.stackRow, { borderBottomColor: cardBorder }]}
							accessible
							accessibilityRole="text"
							accessibilityLabel={spoken}
						>
							<View style={styles.stackCopy}>
								<Text
									style={[styles.metricLabel, { color: ink, marginTop: 0 }]}
								>
									{t(column.labelKey)}
								</Text>
								{data === null ||
								column.delta(data, intlLocale) === null ? null : (
									<Text variant="caption" tabular style={{ color: ink }}>
										{column.delta(data, intlLocale)}
									</Text>
								)}
							</View>
							{data === null ? (
								<Skeleton
									style={[
										styles.metricSkeleton,
										{ width: 72, height: merchantType.metricSmall.lineHeight },
									]}
								/>
							) : (
								<Text tabular style={[styles.metricValueSmall, { color: ink }]}>
									{column.value(data, intlLocale)}
								</Text>
							)}
						</View>
					);
				})}
			</View>
		);
	}

	if (cards) {
		return (
			<View style={styles.cardsBlock}>
				<View
					style={[
						styles.header,
						stacked && { flexWrap: "wrap", gap: space.xs },
					]}
				>
					<Text style={[styles.bandTitle, { color: ink }]}>
						{t("biz.dashboard.today")}
					</Text>
					<Text
						variant="caption"
						tabular
						style={{ color: colors.mutedForeground }}
					>
						{dateLabel}
					</Text>
				</View>
				<View style={[styles.metrics, stacked && { flexDirection: "column" }]}>
					{figures}
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.band, { backgroundColor: bandFill }]}>
			<View
				style={[styles.header, stacked && { flexWrap: "wrap", gap: space.xs }]}
			>
				<Text style={[styles.bandTitle, { color: ink }]}>
					{t("biz.dashboard.today")}
				</Text>
				<Text variant="caption" tabular style={{ color: ink }}>
					{dateLabel}
				</Text>
			</View>
			<View style={[styles.metrics, stacked && { flexDirection: "column" }]}>
				{figures}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	compactCard: {
		marginHorizontal: space.lg,
		padding: space.md,
		gap: space.sm,
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	compactHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: space.sm,
	},
	compactMetric: { flexDirection: "row", alignItems: "center", gap: space.md },
	/**
	 * The module itself: inset by the page gutter, cornered at the module
	 * step, clipped to it. The ink surface (`colors.foreground`) on the white
	 * canvas is what makes it the loudest object on the screen — no shadow,
	 * no border, and nothing else spent.
	 */
	band: {
		marginHorizontal: space.lg,
		borderRadius: radius.xl,
		overflow: "hidden",
		paddingHorizontal: space.xxl,
		paddingVertical: space.xxl,
	},
	/** The header line: the day's word left, the date right, on one baseline. */
	header: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
	},
	bandTitle: {
		...PULSE_SMALL,
		fontWeight: weight.bold,
		letterSpacing: PULSE_TRACKING,
		textTransform: "uppercase",
	},
	/** `space.md` of air between the header and the figures — the step that lands the band's natural height inside §14's 136–152 at 1×, where `space.sm` would set it below the range. */
	metrics: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginTop: space.md,
		gap: space.sm,
	},
	column: { flexShrink: 1, minWidth: 0 },
	/** The separator: hairline wide, `RULE_HEIGHT` tall, centred on the row. Its colour is `mutedForeground` — see the constant's note about the ivory-at-20% register. */
	rule: {
		width: StyleSheet.hairlineWidth,
		height: RULE_HEIGHT,
		alignSelf: "center",
	},
	metricSkeleton: { width: METRIC_SKELETON_WIDTH },
	/** The figure, at `merchantType.metric` with `tabular-nums` — which `theme/merchant.ts` asks every call site to add, and `./text`'s `tabular` does. */
	metricValue: { ...merchantType.metric, fontWeight: weight.bold },
	metricValueSmall: { ...merchantType.metricSmall, fontWeight: weight.bold },
	heroLead: { marginTop: space.md },
	heroRest: {
		flexDirection: "row",
		gap: space.sm,
		marginTop: space.md,
	},
	stackBlock: {
		marginHorizontal: space.lg,
		borderRadius: radius.xl,
		borderWidth: 1,
		paddingHorizontal: space.xl,
		paddingVertical: space.lg,
		gap: space.sm,
	},
	stackRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingVertical: space.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	stackCopy: { flex: 1, minWidth: 0, gap: space.xs },
	metricLabel: {
		...PULSE_SMALL,
		marginTop: space.xs,
		fontWeight: weight.bold,
		textTransform: "uppercase",
	},
	/** The delta rides `TEXT_STACK_GAP` — the gap *inside* one text stack, which is what a figure and its change against yesterday are. */
	metricDelta: { marginTop: TEXT_STACK_GAP, fontWeight: weight.bold },
	cardsBlock: {
		marginHorizontal: space.lg,
		gap: space.md,
	},
	card: {
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: space.md,
		minWidth: 0,
	},
});
