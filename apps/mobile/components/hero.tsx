import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import {
	icon,
	media,
	palette,
	radius,
	STATUS_DOT_SIZE,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Image } from "./image";
import { Text } from "./text";

/**
 * The top of a shop: its identity, at the type scale's loudest step.
 *
 * The storefront used to draw a cover and then, under it, a row holding a logo, a name, a
 * category, an open/closed word and a rating. That row is the most important thing on the
 * page and it sat below the fold on a short phone, which is the whole reason this exists:
 * the same facts, moved onto the picture, where a customer sees them without scrolling.
 *
 * ## Rule 3: what is drawn, and what is composed
 *
 * `docs/design-mobile.md` Rule 3 is explicit that a shop's hero is built from **the logo, the
 * name and the chips at large type**, and never from a photograph the data does not have. What
 * the data has is `businessCardSchema.logoUrl`; the seed's shops carry `coverUrl: null`
 * (`packages/db/src/seed.ts`), so the composed surface below is the normal case rather than
 * the fallback. Two consequences, and both are deliberate:
 *
 * - **No invented image.** Without a logo the identity is the name — there is no
 *   `storefront-outline` stand-in and no grey rectangle, because a grey box where a picture
 *   would be is a claim that the picture exists. This file used to draw that stand-in over the
 *   scrim, where it was a `muted` square with an ink that could not be read on it.
 * - **The name is `display`.** It was `title`; the hero is the screen's one loud thing (Rule 1),
 *   and the shop's name is what a customer arriving from a link is checking. The meta line
 *   stays a `label` under it, so the step between them is the scale's own.
 *
 * The **chips are the caller's**, composed into the `facts` slot: they are the shop's rating,
 * its prep time, its delivery fee, its minimum and its distance, which is the exact vocabulary
 * `./business-card` composes for the same shop in a list (and `./facts` holds no keys and does
 * no formatting, so composing them here would put both in this file). They arrive as a node
 * rather than as fields so this component stays ignorant of the domain — and because the rating
 * chip is the pair `4.8 (212)`, which is `./business-card`'s claim that a score is only worth
 * printing beside the number of rows behind it.
 *
 * ## The scrim, and the two inks
 *
 * A photograph is not a surface the palette can reason about — a shop can upload a picture
 * of a white wall — so the words over it sit on a scrim, and the scrim is **always dark**.
 * That is not a theme choice: it is the only thing that lets the ink be **always light**,
 * because the picture underneath knows nothing about the reader's setting.
 *
 * So this component has two inks and picks by whether there is a cover, not by the theme:
 *
 * - **A cover** — the ink is the *dark* scheme's, read straight from `palette`. A dark
 *   scrim is exactly the surface the dark palette was drawn for, and `useTheme()` would
 *   answer "cream on cream" for every reader in the light scheme.
 * - **No cover** — there is no photograph to fight, so the hero becomes an `accent` surface
 *   and the ink is the ordinary theme's, through `Text`'s own `tone`.
 *
 * Both inks are tokens either way. Nothing here invents a colour, and there is no gradient
 * anywhere in the file — a gradient would be a second colour system inside a component.
 *
 * The **facts are the one exception**, and it is not an exception to the rule: `./facts` fills
 * its chips with `colors.muted` and inks them from the theme, so a chip carries its own
 * readable surface whatever it is dropped on. Nothing here recolours them, and no chip's ink is
 * borrowed from `inks()` — a chip that inherited the scrim's light ink would be light ink on a
 * light chip.
 */
export const HERO_MIN_HEIGHT = 200;

/**
 * How dark the scrim is, and where the number comes from.
 *
 * A layer's opacity rather than an alpha channel in a colour, because the colour itself is
 * a token (`palette.light.foreground`, the warm near-black the light scheme writes its text
 * in) and the palette has no translucent values to borrow one from.
 *
 * 0.68 is a contrast measurement, not a taste: over the worst thing a shop can upload — a
 * blown-out white sky — it composites to about `#676767`, and the ink above clears **5:1**
 * against that, which is the floor the rest of this app is reviewed against. Lighter than
 * this and the meta line fails; much darker and the photograph stops being one.
 */
const SCRIM_OPACITY = 0.68;

/**
 * The shield beside the name: `icon.inline` plus two.
 *
 * It was a bare `17` on the storefront this hero replaces, with a comment defending it as
 * "one point above `icon.inline`, and the one place 17 is drawn". That reasoning is kept
 * and the pixel is not: it sits on the page's `display` ink rather than on a `label` line, so
 * it is a step of its own here — derived from the token it is one step away from, which is
 * what makes it a size rather than a number.
 */
const VERIFIED_SIZE = icon.inline + 2;

/**
 * The ink and the marks, chosen once. See "The scrim, and the two inks" above.
 *
 * `text` is `undefined` — not a colour — when there is no cover, and that is the point: an
 * empty string, or a token borrowed to stand in for one, would be this component overriding
 * `./text`'s own theme-resolved ink with something it made up. `undefined` means "no
 * override", so without a cover the words are the ordinary `foreground` on the `accent`
 * surface, which is a pair the palette already decided.
 */
function inks(
	hasCover: boolean,
	theme: { success: string; mutedForeground: string },
): { text: string | undefined; closed: string; open: string } {
	if (hasCover) {
		return {
			text: palette.dark.foreground,
			// Decoration beside the word, not the word itself — that part of this comment was
			// always right, and it is why these two are not the ink above. What it got wrong was
			// the size of the concession. `mutedForeground` and `success` were measured against
			// the scrim over the worst thing a shop can upload, and gave **2.35:1** and
			// **2.73:1**: a mark the eye does not catch either, on the same grey the eye has to
			// read the words on.
			//
			// These are the dark scheme's two *status* inks, which is what the pair is: a shop
			// is either taking orders or it is not, and this app already draws that distinction
			// in exactly two colours. **3.18:1** and **4.06:1** over the same scrim.
			closed: palette.dark.statusCancelledForeground,
			open: palette.dark.statusCompletedForeground,
		};
	}
	return {
		text: undefined,
		closed: theme.mutedForeground,
		open: theme.success,
	};
}

type HeroProps = {
	coverUrl?: string | null;
	/**
	 * The shop's name, at `display`. Data, so it wraps rather than truncates — no
	 * `numberOfLines`, for the reason the render states.
	 */
	name: string;
	/** The line under the name — the category and the city, already joined. */
	meta?: string | null;
	/** The shop's own picture, drawn only when it uploaded one. See Rule 3 above. */
	logoUrl?: string | null;
	/** The marketplace's shield, and its word for a screen reader. */
	verified?: boolean;
	isOpen: boolean;
	/**
	 * The shop's facts, already composed: one `./facts` row of formatted chips.
	 *
	 * A node rather than an array of fields — see the docblock. `undefined` and an empty row
	 * are both fine: `./facts` renders nothing when a caller filtered every chip out, and a
	 * shop with no rating, no distance and no minimum is a real shop.
	 */
	facts?: React.ReactNode;
	/**
	 * Rendered in the top-right corner, on a `card` pill of its own.
	 *
	 * A slot rather than a prop because the one caller puts a `FavoriteButton` there, and
	 * that component's inks are resolved from the theme — over a scrim they would be a dark
	 * heart on a dark picture. The pill is the hero's, so the heart sits on the surface it
	 * was drawn for and this component stays ignorant of what the node is.
	 */
	action?: React.ReactNode;
};

export function Hero({
	coverUrl,
	name,
	meta,
	logoUrl,
	verified = false,
	isOpen,
	facts,
	action,
}: HeroProps) {
	const { colors } = useTheme();
	const { t } = useT();

	const hasCover = Boolean(coverUrl);
	const ink = inks(hasCover, colors);
	const open = isOpen ? t("store.open") : t("store.closed");

	return (
		<View
			style={[
				styles.hero,
				{ backgroundColor: hasCover ? colors.muted : colors.accent },
			]}
		>
			{coverUrl ? (
				<Image
					uri={coverUrl}
					style={styles.fill}
					radiusToken="lg"
					// The name is written on top of it; announced, every storefront would open
					// with an unlabelled image.
					accessibilityElementsHidden
				/>
			) : null}

			{hasCover ? (
				// Above the picture and below the words, and `pointerEvents="none"` so it is a
				// layer rather than something a finger can land on.
				<View pointerEvents="none" style={[styles.fill, styles.scrim]} />
			) : null}

			<View style={styles.content}>
				<View style={styles.identity}>
					{logoUrl ? (
						<Image
							uri={logoUrl}
							style={styles.logo}
							accessibilityElementsHidden
						/>
					) : null}

					<View style={styles.identityBody}>
						<View style={styles.nameRow}>
							{/* No `numberOfLines`, and there were two. The docblock above makes the name
							    the identity — "the shop's name is what a customer arriving from a link is
							    checking" — and Rule 3 builds the hero out of the logo, the name and the
							    chips, so cutting the name at two lines hides the one fact this surface
							    exists to state. The seed's own shop ("Panadería y Repostería Trigo de
							    Oro") takes a third line at 200% text. `hero` has `minHeight` and no fixed
							    height, so the block grows and the picture behind it stays where it is. */}
							<Text
								variant="display"
								bold
								style={[styles.flex, { color: ink.text }]}
							>
								{name}
							</Text>
							{verified ? (
								<Ionicons
									name="shield-checkmark"
									size={VERIFIED_SIZE}
									color={ink.open}
									accessibilityLabel={t("store.verified")}
								/>
							) : null}
						</View>

						{meta ? (
							// `numberOfLines={1}` was here, and `metaRow` below already refuses the same
							// cap for the shop's state ("the shop's state is not the line that gets cut").
							// The meta line is that rule's other half: it is a category and a distance,
							// which at 200% text do not fit one line, and half a fact under a shop's name
							// is worse than a hero that is a line taller.
							<Text variant="label" style={{ color: ink.text }}>
								{meta}
							</Text>
						) : null}

						{/* The state, and it is a sentence: a dot and a word, which is the pair
						    `./business-card` and `./hours-table` both draw for the same fact. Rule 2
						    keeps it out of the chip row below — a chip saying "Cerrado" explains
						    nothing, and the reason it is closed is on the screen rather than in a
						    chip (`app/store/[slug]` prints when the shop opens). */}
						<View style={styles.metaRow}>
							<View
								style={[
									styles.dot,
									{ backgroundColor: isOpen ? ink.open : ink.closed },
								]}
							/>
							<Text variant="label" style={{ color: ink.text }}>
								{open}
							</Text>
						</View>
					</View>
				</View>

				{/* Below the identity block rather than beside it: at 200% text the chips wrap,
				    and a row wrapped inside the column beside the logo would leave the logo
				    floating against a column of one-word lines. */}
				{facts ? <View style={styles.facts}>{facts}</View> : null}
			</View>

			{action ? (
				<View style={[styles.action, { backgroundColor: colors.card }]}>
					{action}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	hero: {
		borderRadius: radius.lg,
		// Clips the picture and the scrim to the corner, so the two cannot disagree about
		// the shape of the box they are filling.
		overflow: "hidden",
		minHeight: HERO_MIN_HEIGHT,
		justifyContent: "flex-end",
	},
	fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
	scrim: { backgroundColor: palette.light.foreground, opacity: SCRIM_OPACITY },
	// The top padding is the action's room: the heart is pinned up there, and at 200% text
	// the identity block grows up towards it.
	content: { padding: space.lg, paddingTop: space.huge + space.xl },
	identity: { flexDirection: "row", alignItems: "center", gap: space.md },
	logo: { width: media.header, height: media.header },
	// The name, its meta line and the state row are one text stack, so the gap inside it is
	// `TEXT_STACK_GAP` and not a `space` step (`theme/tokens.ts`) — at `space.xs` the lines
	// read as separate paragraphs. The same anatomy `./business-card` draws for the same
	// facts, so one shop is stacked at one grammar on both surfaces.
	identityBody: { flex: 1, gap: TEXT_STACK_GAP },
	nameRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
	flex: { flex: 1 },
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		// Wraps rather than truncates: the shop's state is not the line that gets cut.
		flexWrap: "wrap",
	},
	dot: {
		width: STATUS_DOT_SIZE,
		height: STATUS_DOT_SIZE,
		borderRadius: radius.full,
	},
	// The step between the identity and the facts is the page's own block gap, not a
	// `TEXT_STACK_GAP`: the chips are a separate block of the hero, not a line of the name.
	facts: { marginTop: space.md },
	// The pin is `./card`'s padding in from the corner — the same offset `./business-card`'s
	// `favoritePin` keeps for the same heart, so one control does not sit at two distances
	// from two surfaces' edges.
	action: {
		position: "absolute",
		top: space.lg,
		right: space.lg,
		borderRadius: radius.full,
	},
});
