import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderStatus } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { radius, useTheme } from "@/theme";

import { statusKey } from "./status-badge";
import { Text } from "./text";

/**
 * The one dark block on an operator screen: where this order is right now.
 *
 * Every other module on `app/(business)/merchant-order/[id]` is a soft warm surface, which is
 * what makes this one read as the screen's subject. It is drawn the way `./merchant-pulse`
 * draws today's figures — `colors.foreground` behind, `colors.background` in front, a large
 * corner, and hierarchy carried by size and weight rather than by colour — so the console has
 * exactly two dark surfaces and both are built the same way.
 *
 * ## No shadow, and that is the point
 *
 * A lifted card on a near-black fill is two edges for one object, and on a dark surface the
 * shadow is invisible anyway (`theme/tokens.ts` says so of the consumer dark theme and the
 * merchant palette is light-only). The fill is the whole of the separation.
 *
 * ## The forms, and what they cannot be
 *
 * The design calls for "a subtle deep-green abstract background shape or radial form".
 * There is **no gradient in this app** — no `expo-linear-gradient`, no `react-native-svg`,
 * no Skia, and `components/order-placed.tsx` carries a comment saying so about the SVG
 * case — so a true radial form cannot be built and this does not pretend to. What is here
 * is three concentric circles sharing one centre, clipped by the module's own `overflow`
 * and entering from the right, which is the same shape language as one soft form and keeps
 * the fill from reading as flat.
 *
 * The colour is `success` at a low alpha rather than a new deep-green token: the merchant
 * palette has no alpha colours by construction (`_layout.tsx` says the palette holds none,
 * and derives its own with a named function), and inventing a second one here would be a
 * colour decision made outside the file that owns colour.
 */

/** The word on the chip. `t(statusKey(status))` is the dictionary's own casing. */
export function MerchantOrderHero({
	status,
	amountLabel,
	supporting,
	updatedLabel,
	fulfilmentIcon,
}: {
	status: OrderStatus;
	/** Already formatted by the caller — `formatMoney`, never a raw integer. */
	amountLabel: string;
	/** The line under the amount: "Delivery · 4 items". Composed by the caller, like the amount. */
	supporting: string;
	/** A clock time, or `null` when the log has no event to take one from. */
	updatedLabel: string | null;
	/** The fulfilment's glyph, so the circle says delivery or pickup rather than assuming. */
	fulfilmentIcon: React.ComponentProps<typeof Ionicons>["name"];
}) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<View style={[styles.hero, { backgroundColor: colors.foreground }]}>
			{/* The forms. Three concentric circles sharing one centre, clipped by the
			    module's own `overflow`, entering from the right. The centre is a zero-size
			    absolutely positioned anchor and each circle is hung off it by half its own
			    diameter, which is what makes them concentric by construction rather than by
			    three sets of offsets that have to agree; see `styles.shapes`.

			    The spec asks for 6-12% each and for the band to read dark first, green
			    second. Concentric circles overlap, so the middle of the nest carries all
			    three and compounds — which is why these sit at the bottom of that range
			    rather than the top. `SHAPE_ALPHA_*` are the tuned values and the note on
			    them says what to change if the band reads too green. */}
			<View style={styles.shapes} pointerEvents="none">
				<View
					style={[
						styles.shapeOuter,
						{ backgroundColor: colors.success, opacity: SHAPE_ALPHA_OUTER },
					]}
				/>
				<View
					style={[
						styles.shapeMiddle,
						{ backgroundColor: colors.success, opacity: SHAPE_ALPHA_MIDDLE },
					]}
				/>
				<View
					style={[
						styles.shapeInner,
						{ backgroundColor: colors.success, opacity: SHAPE_ALPHA_INNER },
					]}
				/>
			</View>

			{/* The icon stands BESIDE the whole column, which is what the design draws and
			    which is also the only arrangement that makes the band the height the design
			    asks for. It used to share a row with the chip alone, so the amount, the
			    supporting line and the updated time stacked underneath it at full width —
			    and the icon's 72 points became vertical air instead of horizontal. Measured,
			    that put the band at 230 against a brief of 190-200. Beside the column the
			    row is as tall as the *text*, the 72 is spent sideways where it belongs, and
			    the height falls out of the copy instead of out of the icon. */}
			<View style={styles.row}>
				{/* The well is a wrapper *and* a tint, rather than one view doing both, and
				    the reason is the glyph inside it. An `opacity` on the well would dim the
				    glyph with the fill, and a truck at 12% on a near-black band is not a
				    truck. Two views: the tint behind, the glyph at full strength in front.

				    The `mark` box is a third view and it exists so the glyph is centred by
				    its own geometry. The glyph was `position: absolute` with `left: 24`,
				    which only lined up because the hero's padding happened to be 24 and
				    nothing else in the tree positioned it; move the well and the glyph slid
				    off it silently. */}
				<View style={styles.mark}>
					<View style={[styles.well, { backgroundColor: colors.success }]} />
					<View style={styles.glyph} pointerEvents="none">
						<Ionicons
							name={fulfilmentIcon}
							size={HERO_ICON}
							color={colors.background}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</View>
				</View>

				<View style={styles.column}>
					{/* The chip, and it is `primary` on both palettes — lime is the merchant
					    system's one accent and the status word is the one thing on this hero that
					    is allowed it. Near-black ink on it, which is `primaryForeground` in
					    `theme/tokens.ts` and not a value typed here. */}
					<View style={[styles.chip, { backgroundColor: colors.primary }]}>
						<Text
							style={[styles.chipLabel, { color: colors.primaryForeground }]}
							numberOfLines={1}
						>
							{t(statusKey(status))}
						</Text>
					</View>

					<Text
						style={[styles.amount, { color: colors.background }]}
						tabular
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.8}
					>
						{amountLabel}
					</Text>

					<Text
						style={[
							styles.supporting,
							{ color: colors.background, opacity: 0.88 },
						]}
					>
						{supporting}
					</Text>

					{updatedLabel ? (
						<Text
							style={[
								styles.updated,
								{ color: colors.background, opacity: 0.6 },
							]}
						>
							{t("biz.order.updated", { time: updatedLabel })}
						</Text>
					) : null}
				</View>
			</View>
		</View>
	);
}

/** The well the fulfilment glyph sits in, sized to the reference's band rather than the brief's. */
const HERO_CIRCLE = 62;

/** The glyph inside it. 30, so it fills the 62 without touching its edge. */
const HERO_ICON = 30;

/** The well's tint on a near-black fill — restrained for the same reason the shape is. */
const WELL_ALPHA = 0.22;

/**
 * The forms' opacities, and the only values on this screen that were tuned by looking
 * rather than by arithmetic.
 *
 * The spec asks for "roughly 6-12% opacity" per form, but concentric circles overlap and
 * the middle of the nest carries all three, so the *compounded* centre is well above any
 * one of them. Taken at the top of the range the band stops reading as dark first and
 * green second, which is the one thing it must not do — the status is carried by the lime
 * chip and the white amount, and the forms are there to keep the fill from being flat.
 *
 * If it ever needs to be quieter, take the inner one first: it is the only one small
 * enough to be read as a shape rather than as a tint.
 */
const SHAPE_ALPHA_OUTER = 0.05;
const SHAPE_ALPHA_MIDDLE = 0.06;
const SHAPE_ALPHA_INNER = 0.09;

/**
 * The band's type scale, and why it is not the scale the brief's numbers describe.
 *
 * The brief asked for a 35pt amount on a 12pt chip. Rendered, that band is 198 tall and
 * reads as a headline — and against the approved reference it is plainly the wrong object:
 * in the reference the amount is a *figure inside a status band*, roughly level with the
 * module headings below it, and the band is a wide short strip rather than a slab. The two
 * descriptions cannot both be right, and the reference is the approved thing, so this is
 * the reference's scale.
 *
 * That is also why there is no `HERO_HEIGHT` any more. A fixed height is what made the
 * first two attempts miss: it was 198 by decree when the content wanted 130, and 230 by
 * accident before the icon moved beside the column. The band is now as tall as its four
 * lines and the 24pt of padding around them, which is the one arrangement that cannot
 * disagree with the copy.
 */
const HERO_PADDING = 20;

/** Where the forms' shared centre sits: this far inside the right edge. */
const SHAPE_BLEED = 30;

const styles = StyleSheet.create({
	// The band, and `overflow: "hidden"` is what makes the forms read as clipped by the
	// module's own corner rather than as circles drawn over it. Nothing else in the app
	// clips a dark surface, so this is the reason `merchant-pulse`'s band carries it too.
	hero: {
		borderRadius: radius.xl,
		overflow: "hidden",
		paddingHorizontal: 24,
		paddingVertical: HERO_PADDING,
	},
	/**
	 * The shared centre of the three forms: a zero-size box pinned inside the right edge
	 * and vertically centred, which puts its origin at exactly the point every circle is
	 * hung from.
	 *
	 * Written this way because the alternative was three sets of `right`/`top` offsets that
	 * only *looked* concentric until the band's height changed. Anchoring one point and
	 * hanging each circle off it by half its own diameter cannot drift, and it is also the
	 * only version of this that survives the hero not being 358 wide on the device it is
	 * finally running on.
	 */
	shapes: {
		position: "absolute",
		right: SHAPE_BLEED,
		top: 0,
		bottom: 0,
		width: 0,
		height: 0,
	},
	// 400 across a band that is 358 wide on the reference viewport, so it is clipped on
	// both the right and — because its centre is off-centre — reads as an arc and not a
	// disc. Each is half its own diameter off the anchor in both axes.
	shapeOuter: {
		position: "absolute",
		left: -200,
		top: -200,
		width: 400,
		height: 400,
		borderRadius: radius.full,
	},
	shapeMiddle: {
		position: "absolute",
		left: -130,
		top: -130,
		width: 260,
		height: 260,
		borderRadius: radius.full,
	},
	shapeInner: {
		position: "absolute",
		left: -70,
		top: -70,
		width: 140,
		height: 140,
		borderRadius: radius.full,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 18,
	},
	/**
	 * The box the glyph is centred in, and the reason it exists as a view at all: the
	 * glyph is absolutely positioned, and an absolutely positioned child resolves against
	 * the nearest positioned ancestor rather than against its sibling. With the well and
	 * the glyph loose in a row, the glyph's offset was a number that happened to match the
	 * hero's padding, and nothing about that would have complained when it stopped.
	 *
	 * 62 rather than the brief's 72, because the brief's 72 was sized against a 198-tall
	 * band; at the reference's proportions a 72 circle is taller than the text column it
	 * sits beside and becomes the thing that decides the band's height again.
	 */
	mark: {
		width: HERO_CIRCLE,
		height: HERO_CIRCLE,
	},
	well: {
		flex: 1,
		borderRadius: radius.full,
		// A translucent well on a near-black fill. The merchant palette holds no alpha colours
		// and `merchant.ts` says so, so this is `success` at an opacity rather than a new
		// token — which is the same substitution `./merchant-pulse` makes for its band.
		opacity: WELL_ALPHA,
	},
	// Pinned to the `mark` box on all four sides so the glyph is centred by the same 72 the
	// tint is, rather than by four numbers that have to agree with it.
	glyph: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	/**
	 * The status word, the amount, the supporting line and the clock.
	 *
	 * A tight `4` rather than a `space` step, and it is the same reason as the rest of this
	 * block: the reference sets these four lines as a block, not as a list. At the brief's
	 * `space.md` the band is 193 tall and reads as a headline; the reference's band is a
	 * strip. The column is 26 + 4 + 30 + 4 + 18 + 4 + 16 = 102, and with `HERO_PADDING`
	 * around it the band is 142.
	 */
	column: { flex: 1, gap: 4 },
	chip: {
		height: 26,
		alignSelf: "flex-start",
		justifyContent: "center",
		paddingHorizontal: 12,
		borderRadius: 13,
	},
	// 10 at 700, and `textTransform` because a status word in the dictionary is sentence case
	// ("On the way") and the chip is the one place on this screen that shouts it.
	chipLabel: {
		fontSize: 10,
		lineHeight: 14,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	/**
	 * The amount, and a local step rather than `merchantType.metric`.
	 *
	 * `merchantType.metric` is 34 and the brief asked for 35 with **negative tracking at
	 * -0.6**, which no step on that scale carries — `./merchant.ts` says the scale was
	 * transcribed from the web's Tailwind sizes and nothing in `globals.css` supplies that
	 * number. It is written here rather than bent into a step that does not describe it.
	 *
	 * The size is 28 rather than the brief's 35 because the reference sets it level with
	 * the module headings below the band, and at 35 it is a headline instead of a figure in
	 * a status strip. The tracking stays: a money figure wants to be tight at any size.
	 */
	amount: {
		fontSize: 28,
		lineHeight: 30,
		fontWeight: "700",
		letterSpacing: -0.4,
	},
	// 14 rather than a `merchantType` step: this is a supporting line, and the merchant scale's
	// smallest step is `section` (20) which is a section title.
	supporting: { fontSize: 14, lineHeight: 18 },
	updated: { fontSize: 12, lineHeight: 16 },
});
