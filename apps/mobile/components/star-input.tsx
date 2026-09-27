import Ionicons from "@expo/vector-icons/Ionicons";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { icon, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";

/**
 * Stars, two ways: the marks, and the control a customer picks one with.
 *
 * The display half of the pair `./rating.tsx` starts. `./rating.tsx` draws a shop's *average*
 * -- one mark beside a number and a count, and nothing at all when there is no average to
 * print. This file draws a single rating's five positions, either as a row someone already
 * chose (`StarMarks`) or as a row somebody is choosing right now (`StarInput`). The third
 * site, `./review-list.tsx`, draws its own copy of the marks today and is not wired to this
 * one: it receives a full `Review` and this screen's read carries `{ id, rating, comment }`
 * and nothing else (`orderDetailSchema.review`), so the two rows meet in shape and not in a
 * shared prop type. That is a schema gap and not a reason to draw a fourth star row.
 *
 * ## Why `StarInput` is not `Button`
 *
 * `./button`'s `selected` looked like the obvious primitive and is the wrong one twice over.
 * It makes the control a `radio` (by default) or a `checkbox` and then **replaces `icon` with
 * a tick** on the chosen one -- so a chosen star would stop being a star at the exact moment
 * it became the one thing worth looking at. And `selected={value >= n}` would mark four radios
 * checked at once, which is not what a radio group is. So the control is five `./pressable`s
 * with `accessibilityRole="radio"` on each and `radiogroup` on the row, which is the shape the
 * accessibility tree already expects of it.
 *
 * ## The state is a shape, and the colour is the same mark it always was
 *
 * Filled against `star-outline` is the whole signal. Both take `colors.rating`, the token this
 * app reserves for this mark and nothing else -- see `theme/tokens.ts`, which says outright
 * that sharing a name with `warning` is how recolouring one recolours both. That is also
 * exactly what `./review-list.tsx` draws for a posted review, so a rating reads the same
 * before and after it is written.
 *
 * ## `review.stars` is this control's own label, and the dictionary said so first
 *
 * Each star announces `review.stars` -- "{count} de {stars} estrellas" -- which is commented in
 * both dictionaries as "Spoken label for one star in the rating radio group". Five glyphs read
 * one at a time say "star, star, star" and never the number; the key carries the number. The
 * group's own name is the caller's `label`, set on the row as `accessibilityLabel` under
 * `radiogroup`, and the caller draws that same word as visible text above the row -- the
 * contract `./switch.tsx` states for its own `label`, which draws no words either.
 *
 * The row is **not** `accessible`. Making it so would swallow the five radios into one element
 * and leave a TalkBack user unable to move between the positions, which is the one thing this
 * control has to let them do.
 *
 * ## A re-tap of the chosen star is not a change
 *
 * `selection()` fires when the rating moves, and not when the thumb comes back to the position
 * already on it. That is `app/(business)/product-form.tsx`'s ShopChips rule, and it is the
 * difference between "a choice settled" and "the same choice again" -- one of which is news to
 * the hand and one of which is not. A radio group does not clear on a re-tap either.
 */

const STARS = 5;

/**
 * The five positions, 1 to 5.
 *
 * A row of stars is five fixed marks and its identity is the position, so the array is the
 * five positions rather than a `length` counted at each call site -- `./review-list.tsx`'s
 * own `STAR_POSITIONS` makes the same argument: a key off a map's index is a key that moves
 * when the list does, and these do not move because there are always five of them.
 */
const STAR_POSITIONS = Array.from({ length: STARS }, (_, index) => index + 1);

/**
 * The five marks, filled up to `rating`. Read-only.
 *
 * The row is one accessible element carrying `review.stars`, because this is a statement about
 * a rating somebody already gave and not a control: the sentence is the content and the five
 * glyphs are how it is drawn. The marks themselves are hidden from the tree for the same
 * reason they are in `./rating.tsx` -- announced one by one they interrupt the sentence with
 * five words for "star".
 */
export function StarMarks({
	rating,
	style,
}: {
	/** How many of the five are filled. An integer the API stored, not a computed average. */
	rating: number;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<View
			style={[styles.row, style]}
			accessible
			accessibilityLabel={t("review.stars", { count: rating, stars: STARS })}
		>
			{STAR_POSITIONS.map((position) => (
				<Ionicons
					key={position}
					name={position <= rating ? "star" : "star-outline"}
					size={icon.inline}
					color={colors.rating}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			))}
		</View>
	);
}

/**
 * The five positions as a radio group. The customer's answer, one to five.
 *
 * `value` is `null` before anything is chosen rather than `0`: "no rating yet" is a state of
 * the form and not a rating of zero, and a `0` would be a number the write schema refuses
 * (`createReviewInput.rating` is `min(1)`), so a client holding one would be holding a value
 * it cannot post.
 */
export function StarInput({
	value,
	onChange,
	label,
	disabled = false,
	style,
}: {
	value: number | null;
	onChange: (next: number) => void;
	/** The group's name in the accessibility tree, and the word the caller draws above it. */
	label: string;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	return (
		<View
			style={[styles.row, style]}
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
		>
			{STAR_POSITIONS.map((position) => {
				const filled = value !== null && position <= value;
				return (
					<Pressable
						key={position}
						onPress={() => {
							// See the file docblock: the same position again is not a change,
							// and the hand is told only about changes.
							if (disabled || value === position) return;
							selection();
							onChange(position);
						}}
						disabled={disabled}
						// An unavailable group is not a busy one. `./pressable`'s default
						// 0.5 fades the mark toward the page and takes the shape with it,
						// and shape is the entire signal here -- so the opacity stays at 1
						// and `disabled` is what says the control cannot be used, which is
						// the rule `./button`, `./option-card` and `./quantity-stepper`
						// already follow for an unavailable control.
						disabledOpacity={1}
						accessibilityRole="radio"
						accessibilityState={{ checked: value === position, disabled }}
						accessibilityLabel={t("review.stars", {
							count: position,
							stars: STARS,
						})}
						style={styles.star}
					>
						<Ionicons
							name={filled ? "star" : "star-outline"}
							size={icon.action}
							color={colors.rating}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	// `space.xs`, the same step `./review-list.tsx` spaces its marks at: the five are one
	// object rather than five things on a page, and the gap is what makes them read as a row
	// without turning them into five separate controls to the eye.
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	// `./pressable` already floors its target at `MIN_TOUCH_TARGET`, so the box is the floor
	// drawn rather than floored -- `./favorite-button`'s rule. The glyph inside is
	// `icon.action`, which is this app's size for a mark that is itself the control; the
	// `icon.inline` marks `StarMarks` draws are the ones sitting beside a number.
	star: {
		alignItems: "center",
		justifyContent: "center",
	},
});
