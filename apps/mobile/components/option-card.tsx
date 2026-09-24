import Ionicons from "@expo/vector-icons/Ionicons";
import { type Currency, formatMoney } from "@pymeshub/shared";
import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { duration, STATE_POP, spring } from "@/lib/motion";
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
 * A group of choices, as cards you scroll through sideways.
 *
 * A dish with a size, a salsa and three extras used to draw every option as a full-width
 * `Button` stacked vertically — nine 44-point rows of "Grande", "Mediano", "Pequeño"
 * before the reader reached the second group, on a page whose whole point is the one
 * decision at the bottom. The set is the same set; what changes is that a row of cards
 * shows *how many* choices there are at a glance, which a column never does, and that the
 * group stops being the tallest thing on the page.
 *
 * ## It replaces the buttons, and it keeps everything they had
 *
 * This is a re-presentation, not a new control: every property the buttons carried is here,
 * because each one was doing a job.
 *
 * - `choiceRole` — `SINGLE` is one of these and `MULTI` is any of them, and the role is
 *   announced. A radio is a promise that choosing this unchooses the last one, and a group
 *   where that is false says so.
 * - the **tick** on the chosen card, because a fill is not a status: it survives a colour
 *   vision deficiency, a greyscale screenshot and a monochrome printout. It lands with
 *   `lib/motion`'s `STATE_POP`, the movement reserved for a control whose state changed —
 *   see the note at the effect in `OptionCard`.
 * - `accessibilityState.checked`, so the state outlives the ink entirely.
 * - the **`+price` suffix**, now drawn where the Button could only hint it. The delta was an
 *   `accessibilityHint` and nothing else, which meant a sighted customer learned the cost of
 *   an option only after adding it to the cart — the one number on this page that changes
 *   what they pay, invisible.
 * - the **required marker** on the group's heading.
 * - the **group's floor**, for the groups that need more than one choice — see `minSelect`.
 *
 * The disabled state also says *why* now, which the buttons did not: an unavailable option
 * reads "No disponible hoy" where its price would be. A greyed control with no reason on it
 * is a dead end, and `product.unavailable` was already in the dictionary with no caller.
 *
 * ## The floor, and why the heading is the only place it can be read
 *
 * A group carries `kind`, `isRequired`, `minSelect` and `maxSelect`
 * (`productOptionGroupSchema`), and this rail drew the first two. A `MULTI` group whose floor
 * is two said "Obligatorio", which is a different sentence: it promises that the reader must
 * choose, not that they must choose **twice**. The customer who read it as "one will do"
 * found out at the button, and the button is the one place on the page where a refusal costs
 * a tap.
 *
 * Nothing downstream catches it, which is why the sentence has to be here. Measured by
 * reading `apps/api/src/services/cart.ts`: `addItem` resolves the chosen ids
 * (`chosenOptionsOf`, which refuses an id that is not an option *of this product*) and never
 * reads `isRequired`, `minSelect` or `maxSelect` — so a short selection is stored as given
 * and there is no 400 to fall back on. The heading is not a hint in front of a server rule;
 * for this rule it is the rule.
 *
 * Only a floor of **two or more** is drawn, for two reasons. `SINGLE` cannot need more: the
 * schema refines a single-choice group to `maxSelect === 1`, so "Obligatorio" has already
 * said everything true about it. And a floor of one *is* `required` — the schema refines
 * `isRequired` to `minSelect >= 1` — so drawing both would be the same sentence twice. When
 * the floor is drawn the required marker is therefore dropped, and the stronger sentence
 * stands alone.
 *
 * `maxSelect` is deliberately not drawn. A ceiling that no one enforces and that the rail
 * does not cap is not a rule the customer can break, and printing "Hasta 2" over a card they
 * can still tap a third time would be copy the component does not honour.
 *
 * ## The name is not set here
 *
 * The heading is inside this component because the group and its name are one thing, and
 * the *required* marker is part of that name. The rail pays its own horizontal padding and
 * bleeds to both screen edges — the same rule `CategoryRail` follows — so the caller renders
 * it outside whatever column padding the rest of the page uses.
 *
 * ## The haptic
 *
 * `selection()`, and only here. `docs/design-mobile.md` gives that haptic to "a tab, a
 * segment or a picker settling", and a product's option group is the picker that vocabulary
 * is named for. Every tap on a card changes the set — a `SINGLE` card that is already chosen
 * is unchosen by the tap — so there is no re-tap case to guard, unlike `Segmented`. Tapping
 * an unavailable card fires nothing, because nothing settles.
 */

/**
 * How narrow a card may be drawn.
 *
 * `theme/tokens.ts` has no width scale — its steps are the air between elements, and a card
 * is not air — so the box a card is drawn in is one of the measurements a component owns,
 * stated once and named so it can be changed in one place.
 *
 * A **minimum** and not a width: at 200% Dynamic Type the name needs more than this, and a
 * fixed card would clip the very case it was sized for. Cards in a row are therefore
 * allowed to differ in width, which is the honest answer at a text scale the box cannot
 * predict. 140 is one short option name ("Grande") with room to spare.
 *
 * The name does not wrap here, and that is measured rather than assumed: the row is a
 * horizontal `ScrollView`, which measures its children against an unbounded width, so the
 * label is never handed a constraint to wrap against and the card grows to the longest name
 * in the group instead. The `numberOfLines={2}` that used to sit on the label was therefore
 * inert — it could not fire — and is gone, because `docs/design-mobile.md:109-110` keeps
 * `numberOfLines` for truncating data and never for saving a layout.
 */
const OPTION_CARD_MIN_WIDTH = 140;

type OptionCardOption = {
	id: string;
	name: string;
	/** Money in the currency's minor unit. Added to the product's price, never divided. */
	priceDeltaMinor: number;
	isAvailable: boolean;
};

type OptionCardRowProps = {
	/** The group's name, drawn as the heading above the rail. */
	name: string;
	/** Draws the `product.required` marker beside the name. */
	required?: boolean;
	/** `SINGLE` is one of these, `MULTI` is any number of them. Decides the announced role. */
	kind: "SINGLE" | "MULTI";
	/**
	 * The group's floor, `productOptionGroupSchema.minSelect`, in the customer's words.
	 *
	 * Two or more draws the rule beside the name — see the docblock for why nothing
	 * downstream would catch a short selection, and why one is not drawn.
	 */
	minSelect?: number;
	options: OptionCardOption[];
	/** The ids currently chosen, in whatever order the screen keeps them. */
	selectedIds: string[];
	currency: Currency;
	onToggle: (optionId: string) => void;
};

export function OptionCardRow({
	name,
	required = false,
	kind,
	minSelect = 0,
	options,
	selectedIds,
	currency,
	onToggle,
}: OptionCardRowProps) {
	const { t } = useT();

	/**
	 * Nothing is drawn for a group with no options.
	 *
	 * A heading over an empty rail is a heading with a shrug under it, and the API can send
	 * one: a group whose every option is hidden from the catalogue is still a group.
	 */
	if (options.length === 0) return null;

	/**
	 * The floor, as the dictionary's sentence, or nothing.
	 *
	 * `minSelect` is the number the shop wrote; drawing it needs a sentence and sentences
	 * live in the dictionary, so the only decision here is which case gets one. Two is the
	 * threshold and the docblock above argues it: below two the required marker already says
	 * it, and a `SINGLE` group cannot have a higher floor than one.
	 */
	const floor =
		kind === "MULTI" && minSelect >= 2
			? t("product.select.min", { count: minSelect })
			: null;

	return (
		<View style={styles.group}>
			{/* Outside the rail and outside the `radiogroup`: the heading names the set, and a
			    group that contained its own label would announce the name and then the choices
			    as if the name were one of them. The required marker is on the heading because
			    that is where the rule is — "Obligatorio · Tamaño" is one sentence about the set,
			    and putting it on every card would say it once per option. The floor joins it
			    there for the same reason, and it replaces the required marker rather than
			    following it: a floor of two already says the choice is mandatory, and
			    "Obligatorio · Elige al menos 2" is one rule written twice. */}
			<Text variant="heading" bold>
				{name}
				{floor ? ` · ${floor}` : required ? ` · ${t("product.required")}` : ""}
			</Text>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.rail}
				// The set, not the rail: `radiogroup` says the cards inside are one choice and
				// `checkbox` groups have no wrapper role to announce. No label — the heading above
				// is the visible name and is already in the tree, and a second copy of it here
				// would be read twice.
				accessibilityRole={kind === "SINGLE" ? "radiogroup" : undefined}
			>
				{options.map((option) => (
					<OptionCard
						key={option.id}
						option={option}
						chosen={selectedIds.includes(option.id)}
						choiceRole={kind === "SINGLE" ? "radio" : "checkbox"}
						currency={currency}
						onPress={() => {
							selection();
							onToggle(option.id);
						}}
					/>
				))}
			</ScrollView>
		</View>
	);
}

function OptionCard({
	option,
	chosen,
	choiceRole,
	currency,
	onPress,
}: {
	option: OptionCardOption;
	chosen: boolean;
	choiceRole: "radio" | "checkbox";
	currency: Currency;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	/**
	 * The tick pops when the choice lands, and only then.
	 *
	 * `STATE_POP` is `lib/motion`'s magnitude reserved for a control whose **state**
	 * changed — the opposite move from a press — and the tick is exactly that: the mark
	 * that just appeared on the card a thumb is still on. The three things that keep it
	 * honest are `./favorite-button`'s, reused here: it is driven by `chosen`, the same
	 * value the fill, the border and the announced state read, so it cannot celebrate a
	 * change that did not happen; the shared value is seeded with the state the card
	 * mounted at, so a group of pre-chosen options does not pop as it arrives; and reduced
	 * motion drops the travel and keeps the state — the tick still appears, the fill and
	 * the border still move, which is the signal the pop echoes. The settle back to rest is
	 * `spring.press`, so a second tap interrupts it rather than restarting it.
	 */
	const reduceMotion = useReducedMotion();
	const scale = useSharedValue(1);
	const shown = useRef(chosen);

	useEffect(() => {
		if (reduceMotion) {
			shown.current = chosen;
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		if (shown.current === chosen) return;
		shown.current = chosen;
		scale.value = withSequence(
			withTiming(STATE_POP, { duration: duration.instant }),
			withSpring(1, spring.press),
		);
	}, [chosen, reduceMotion, scale]);

	const pop = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : scale.value }],
	}));

	return (
		<Pressable
			onPress={onPress}
			disabled={!option.isAvailable}
			// The unavailable card is drawn, not faded. `muted` is the surface that is not taking
			// input and `mutedForeground` is its ink (**6.03:1** light, **5.86:1** dark); the 0.5
			// opacity multiplier this used to inherit from the primitive took the name down to
			// 2.42:1 in the dark theme, on the line that also carries the reason it is off.
			disabledOpacity={1}
			accessibilityRole={choiceRole}
			// The name is *not* set here, so it is composed from the two lines inside: the
			// option's name and its price (or the reason it is off). That is the only way the
			// delta reaches a screen reader — a card with an explicit label stops reading its
			// children, which is how the old button's `+₡500` stayed a hint that arrived after
			// a pause instead of part of the choice.
			accessibilityState={{ checked: chosen, disabled: !option.isAvailable }}
			style={[
				styles.card,
				{
					// `accent` and not `primary`: a filled card the colour of the add button would
					// read as the screen's action, and these are four of them in a row. An
					// unavailable option outranks both — it is not chosen or choosable.
					backgroundColor: !option.isAvailable
						? colors.muted
						: chosen
							? colors.accent
							: colors.card,
					borderColor: chosen ? colors.primary : colors.border,
				},
			]}
		>
			<View style={styles.head}>
				<Text
					variant="body"
					// The weight is the signal that survives every colour being taken away, and it
					// is one of three: the tick, this, and the announced `checked`.
					bold={chosen}
					// The name is the one thing on this card that is not already `tone="muted"`, so
					// it is the one that has to be recoloured rather than dimmed.
					tone={option.isAvailable ? "default" : "muted"}
					style={styles.name}
				>
					{option.name}
				</Text>
				{chosen ? (
					<Animated.View style={pop}>
						<Ionicons
							name="checkmark"
							size={icon.control}
							color={colors.primary}
							// The radio's own state is announced; an image read after it repeats it.
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</Animated.View>
				) : null}
			</View>

			{option.isAvailable ? (
				// `> 0` and not `!== 0`, because the sentence this draws is `"+{amount}"` in both
				// locales (`packages/i18n/src/messages/*/customer.ts`): a negative delta through it
				// would read `+-₡500`. The schema does allow one — a smaller size is a negative
				// delta, and a free option is zero (`packages/shared/src/schemas/catalog.ts`) — so a
				// cheaper option is drawn with no price line at all rather than with a broken one.
				// That is a real cost and not a decision: the sign of a saving is the one thing this
				// line cannot say, and the copy is where it would have to be said.
				option.priceDeltaMinor > 0 ? (
					<Text variant="label" tone="muted" tabular>
						{t("product.optionPrice", {
							// The delta is money and is formatted as money — never as a bare count of
							// minor units, and never divided.
							amount: formatMoney(option.priceDeltaMinor, currency, {
								locale: intlLocale,
							}),
						})}
					</Text>
				) : null
			) : (
				<Text variant="label" tone="muted">
					{t("product.unavailable")}
				</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	group: { gap: space.sm },
	// The rail pays its own horizontal padding and bleeds to the screen's edges; see the note
	// in the docblock. `stretch` keeps the cards in one row the same height as the tallest of
	// them, and the second line is what makes that necessary: a surcharge draws a price line,
	// a free option draws none, and an unavailable one draws `product.unavailable` instead.
	// A name is not the variable — it cannot wrap (see the minimum-width note above), so a long
	// one makes a *wider* card rather than a taller one.
	rail: {
		flexDirection: "row",
		alignItems: "stretch",
		gap: space.sm,
		paddingHorizontal: space.lg,
	},
	// The name and the line under it are one text stack — a name and its price line, which
	// is exactly the pair `theme/tokens.ts`' `TEXT_STACK_GAP` names — so the gap inside it
	// is the stack's own and not a `space` step: at `space.xs` the two read as separate
	// paragraphs on a card that is one choice.
	card: {
		minWidth: OPTION_CARD_MIN_WIDTH,
		minHeight: MIN_TOUCH_TARGET,
		borderRadius: radius.md,
		borderWidth: 1,
		padding: space.md,
		justifyContent: "space-between",
		gap: TEXT_STACK_GAP,
	},
	head: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
	name: { flexShrink: 1 },
});
