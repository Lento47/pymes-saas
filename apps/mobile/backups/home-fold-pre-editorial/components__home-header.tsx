import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { usePurchaseAccent } from "@/lib/purchase-accent";
import {
	browsingBandTop,
	inkOnBand,
	purchaseBand,
} from "@/lib/purchase-colors";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Image } from "./image";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * The home screen's header: who this order is for, and where it would go.
 *
 * One row, two registers. The left column is a text stack — the customer's greeting as
 * this screen's **title** (`heading`/semibold, the register `./section-header` titles its
 * sections at) over the coordinate as its **meta line** (`label`, the quiet voice a
 * marketplace header sets under its title). The avatar holds the right of the row. At 100%
 * text the stack is `type.heading.lineHeight` + `TEXT_STACK_GAP` + `type.label.lineHeight`
 * — 24 + 2 + 18 = 44 — which is exactly the avatar's own `MIN_TOUCH_TARGET`, so the band is
 * re-typeset without spending a point of fold.
 *
 * An earlier version of this drew three phrases over four visual lines: a "Deliver to"
 * label, the coordinate under it, and a tagline under the customer's name. It was cut to
 * one contested row — one line each side, five words — and that count became the design.
 * It was not. The failure was three phrases sharing one row's *width* (the tagline ran
 * until "Your current location" wrapped to two lines of its own); the fix is one phrase per
 * register, not one phrase per screen. Two bold facts on one baseline — a heading greeting
 * and a body coordinate — was the second failure: the eye could not tell which was the
 * title. The greeting wins the title slot because it is the stable line. The coordinate
 * mutates between a fact and a verb, and a title that swaps registers lies about what it
 * is.
 *
 * What each register keeps, and why it earns its words:
 *
 * - **The coordinate's meta line.** Every distance on the screen below is measured from it
 *   and the feed is sorted by it, so it is the one fact about this screen rather than about
 *   one of its sections. This is also the *only* statement of location on the screen — the
 *   rule `./hero-search` used to own, kept intact here because two files holding one fact
 *   can disagree about it, and these two did once already. `./map` draws a *picture* of
 *   the same coordinate and states nothing. `discovery.hero.deliverTo` leads the line as
 *   its quiet role: the pin says the line is a *place*, the lead says the place is *where
 *   this order goes* — the job "Tu ubicación actual" alone never stated. The lead is
 *   `muted` and regular; the value is the datum, and only it changes between states.
 * - **The title, and the door beside it.** The given name and the avatar, which opens
 *   `app/account.tsx`.
 *
 * ## The line cannot name a street
 *
 * There is no reverse geocoding anywhere in the API (`docs/api-surface.md` records the
 * gap), so `discovery.hero.currentLocation` is the honest ceiling. An address here would be
 * invented, and an invented address is the kind of lie a customer only discovers at the
 * door.
 *
 * The line is **the fact or the action, never both**: with a fix the meta line states where
 * delivery goes and there is nothing to tap (a control that only re-asks a question already
 * answered is a nag this app does not do); without one the value's seat takes `location.use`
 * as a link and the whole meta row is the target that asks the platform. The location hook
 * opens settings only when the platform says it cannot ask again, and refreshes permission
 * when the customer returns. The role lead is constant across both states, so only the
 * value and the row's role change.
 *
 * There is deliberately no "change location" chevron beside the fact, and no door to
 * `app/addresses.tsx` on this line. The schema *could* carry one — `addressInput`
 * (`packages/shared/src/schemas/user.ts`) declares optional `lat`/`lng` — but the phone's
 * address form writes a label, two lines, a city and a region and never those, so a saved
 * address arrives as text only. And the feed does not read addresses at all: every distance
 * below is measured from `useDeviceLocation()`'s fix, the coordinate `catalog.feed` takes.
 * Choosing a saved address would move a *word* at the top of the screen while every
 * distance below kept being measured from the fix. The day the feed's location source
 * becomes a saved address — schema coordinates filled in *and* the query reading them — is
 * the day this decision reopens. Not before.
 *
 * The nested value `Text` re-declares `variant="label"`: `./text` rebuilds its base per
 * node and defaults to `body`, which would drop the value at 15/21 inside a 13/18 line.
 * Two tones, one size, one baseline.
 *
 * ## Who it is for
 *
 * `users.me` is where the name and the avatar live; the session is an identity and nothing
 * else (`MarketplaceSession` carries an email and cannot grow a name). The **given** name
 * only — a full name wraps the title at 200% text, and the full name is the account card's
 * job, which draws it. The email prefix is the last resort, because a profile with no name
 * is a real state and the title still has to say something.
 *
 * The avatar is labelled with the customer's *name* rather than with its destination — so
 * its hint is `home.greeting.avatar.help`, the rule `app/settings.ts` states for a pressable
 * whose label does not say where it goes. With no name there is no avatar to label and the
 * block announces the account instead, where the hint would be a second sentence for the
 * first.
 */
export function HomeHeader({
	locationLabel,
	onLocationPress,
	name,
	avatarUrl,
	onAvatarPress,
}: {
	/** Current device location, saved map pin, or a prompt to choose one. */
	locationLabel: string;
	/** Opens the location chooser even when a location is already active. */
	onLocationPress: () => void;
	/** The given name, or `null` when the profile has none and the email prefix is all there is. */
	name: string | null;
	/** `users.me.image`. Null draws the initials; a URL draws the photo over them. */
	avatarUrl: string | null;
	onAvatarPress: () => void;
}) {
	const { colors, scheme } = useTheme();
	const { t } = useT();
	const stage = usePurchaseAccent();
	const journeyInk =
		stage && stage !== "browsing"
			? purchaseBand(stage, colors, scheme)?.ink
			: undefined;
	/**
	 * The ink for every mark drawn on the browsing band, on **every** theme, and `undefined`
	 * when there is no browsing band to draw on.
	 *
	 * **Measured against the colour the ramp opens on, which is not the anchored one.** This is
	 * the invariant the whole file turns on: *ink is measured against the colour under it*,
	 * whichever function owns that colour. A journey stage's band arrives anchored
	 * (`purchaseBand`), so its ink comes from there. The browsing ramp does not anchor —
	 * `./home-gradient` draws the theme's primary, verbatim on lime's hand-authored ramps and
	 * composited over the page at the top stop's alpha everywhere else — so `browsingBandTop`
	 * reproduces that one stop and this measures against it. The two files share
	 * `BROWSING_RAMP_ALPHA`, so they cannot drift into describing two different colours, which
	 * they once did: the ink was chosen against the anchor's `#638000` and painted onto the
	 * ramp's `#C8FF18`, **1.18:1**, white on bright lime.
	 *
	 * **It used to run on lime only** — behind a check that the theme's primary was the lime
	 * token — and that check was the defect rather than the safety rail it looked like. On the
	 * other twelve themes no ink was applied at all, so the greeting took `foreground` and the meta
	 * line its own `mutedForeground` over a band nobody had measured. Measured on the light
	 * bands, `mutedForeground` against the stop the ramp opens on runs **1.09:1 to 4.19:1** —
	 * berry 1.09, orchid 1.36, vine 1.53, harbor 1.73, forest 1.87, sunset 1.89, dune 1.91,
	 * ocean 2.13, coral 2.43, citrus 2.77, sky 3.21, amber 3.40, lime 4.19 — **thirteen themes,
	 * and not one of them clearing the 4.5 a 13px line owes.** Lime is in that list and was the
	 * only line that was legible, because lime was the only one the old gate measured. Measuring
	 * here instead takes the best of the three candidates and lands **4.4967:1 to 15.98:1** in light
	 * and **6.41:1 to 16.22:1** in dark, twenty-five of the twenty-six theme/scheme pairs
	 * clearing 4.5 outright.
	 *
	 * **The one pair that does not, and why the ink is not what fixes it.** `berry` in light is
	 * **4.4967:1**, three thousandths short. Its ramp opens on `#b549bf` — the one composite of
	 * the thirteen whose relative luminance, 0.1835, falls in the narrow band where neither
	 * white (needs `L ≤ 0.1833`) nor its own `foreground`, `#140A16` (4.31 there), clears 4.5.
	 * That is its top stop's problem, not the ink's, and it is written down rather than rounded
	 * to a pass;
	 * `lib/purchase-colors.test.ts` pins the value so it cannot quietly get worse.
	 *
	 * Lime's ink is unchanged by the move: its ramp opens on `#C8FF18` either way, and what
	 * `inkOnBand` returns for it is what it already returned — `#111111` in light (15.98:1) and
	 * `colors.background` in dark (16.22:1). Both are dark, and both are correct: dark letters
	 * on a lime band are the design, not a defect, and worth saying because "dark mode, dark
	 * letters" reads like a bug and is not one.
	 *
	 * **Every mark on the band reads it, and nothing on this file knows about lime.** The
	 * greeting, the meta line's lead *and* its value, the pin and the chevron all wear
	 * `activeInk`, which is the whole of what the old file was trying to express through
	 * `onLimeGradient`, `bandInk`, `limeDarkInk` and `nestedInk`. The avatar deliberately
	 * reads nothing — `./image` paints `colors.muted`, so the initials sit on their own disc
	 * and never see the ramp.
	 *
	 * `stage === "browsing"` is the gate because it is exactly when this ramp is drawn —
	 * `./screen` mounts `<HomeGradient>` for a non-null stage, and `/` is the only route this
	 * header appears on. With a journey stage in flight the band is a journey ramp, and
	 * `journeyInk` above is what answers for it; with no stage at all there is no band, and no
	 * mark takes an ink it would be wrong to trust.
	 */
	const browsingInk =
		stage === "browsing"
			? inkOnBand(
					browsingBandTop(colors.primary, scheme, colors.background),
					scheme === "dark"
						? colors.primaryForeground
						: colors.secondaryForeground,
					colors,
				)
			: undefined;
	const activeInk = journeyInk ?? browsingInk;

	// Two initials where the name has two parts, one where it has one. The avatar's box is
	// `MIN_TOUCH_TARGET` square — a target drawn at its own floor, like `./business-card`'s
	// heart slot — so this is a 44pt circle with room for two characters at `caption` and
	// not for a third.
	const initials = name
		? name
				.trim()
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part.charAt(0).toUpperCase())
				.join("")
		: null;

	// The meta line's lead, shared by both states so the sentence cannot drift between
	// them. The middot rides inside this string rather than as its own node, so a wrap
	// keeps it on the lead's own line-fragment.
	const lead = `${t("discovery.hero.deliverTo")} · `;

	return (
		<View style={styles.wrap}>
			<View style={styles.stack}>
				{/* The title: this screen's `title`, one step above the `heading` `./section-header` gives its own titles,
				    so the greeting leads the page without out-shouting the
				    field below it (`docs/design-mobile.md` Rule 1). */}
				<Text
					variant="title"
					bold
					// The greeting is the one mark here that carried no colour of its own and
					// took `foreground` by default — white, which on the dark theme's new lime
					// band is unreadable. `activeInk` is `undefined` with no band, so a screen
					// that draws none keeps the default it had.
					style={[styles.title, activeInk ? { color: activeInk } : null]}
				>
					{name ? t("home.greeting", { name }) : t("home.greeting.anon")}
				</Text>

				<Pressable
					onPress={onLocationPress}
					accessibilityRole="button"
					accessibilityLabel={`${t("discovery.hero.deliverTo")} · ${locationLabel}`}
					accessibilityHint={t("location.changeHelp")}
					style={[styles.coordinate, styles.coordinateAction]}
				>
					{/* The pin changes shape and ink between the two states (filled at
						    `primary`, outlined at `mutedForeground`), so the state is never
						    carried by colour alone. */}
					<Ionicons
						name="location"
						size={icon.inline}
						// The measured ink, and `foreground` where no band is drawn at all —
						// the page's own ink, light on a dark page and dark on a light one.
						// This used to be a four-case expression: lime light took
						// `foreground`, lime dark `primaryForeground`, and every other theme
						// drew `colors.primary` **on** the primary — roughly 1:1, invisible on
						// every one of the twelve. `activeInk` answers all of it with one
						// measurement, and what it gives lime is the ink lime already wore,
						// bar one step in dark.
						color={activeInk ?? colors.foreground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
					<Text
						variant="label"
						tone="muted"
						style={[
							styles.coordinateText,
							activeInk ? { color: activeInk } : null,
						]}
					>
						{lead}
						{/* Re-declares `variant="label"`: `./text` defaults a nested node to
							    `body` and would draw the value at 15/21 inside this 13/18 line. */}
						<Text
							variant="label"
							tone="default"
							style={activeInk ? { color: activeInk } : undefined}
						>
							{locationLabel}
						</Text>
					</Text>
					<Ionicons
						name="chevron-down"
						size={icon.inline}
						color={activeInk ?? colors.mutedForeground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			</View>

			<Pressable
				onPress={onAvatarPress}
				accessibilityRole="button"
				accessibilityLabel={name ?? t("account.title")}
				accessibilityHint={name ? t("home.greeting.avatar.help") : undefined}
				style={styles.avatarTarget}
			>
				<Image
					uri={avatarUrl}
					radiusToken="full"
					style={styles.avatar}
					// The box is one target, so the picture and the initials behind it are
					// announced by the `Pressable`'s own label and never on their own.
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					{/* Drawn only when there is no photo — `./image` keeps `children` under
					    the picture, so a loaded avatar covers it. The initials are the same
					    stand-in treatment `apps/web` gives a logo with no image: a letter, not
					    a generic glyph, because a grid of identical glyphs tells nobody whose
					    card is whose. */}
					{avatarUrl ? null : (
						<Text variant="caption" tone="action" bold>
							{initials}
						</Text>
					)}
				</Image>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		// Top, not centre: the avatar belongs to the *title* — the identity — and at 200%
		// text, or in the no-fix action state where `./pressable`'s 44pt floor grows the
		// meta row past the avatar's own height, the title still shares the avatar's line.
		// Centring floats the avatar between the two registers. At 100% with a fix the two
		// children are both 44 tall, so this and `center` agree.
		alignItems: "flex-start",
		gap: space.md,
		paddingHorizontal: space.lg,
		paddingTop: space.md,
	},
	// One text stack: title over meta at `TEXT_STACK_GAP`, the shape `./business-card`'s
	// identity stack draws — a gap *inside* one fact, not a `space.*` step between blocks.
	stack: {
		flex: 1,
		gap: TEXT_STACK_GAP,
	},
	title: { flexShrink: 1 },
	coordinate: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	// Only the action state's addition: a child of a column stretches by default, and a
	// stretched row would put half its press area over empty space beside the words —
	// stealing taps from the field below. The target is the link's own line.
	coordinateAction: { alignSelf: "flex-start" },
	// The lead yields and the value wraps inside its own box rather than pushing the pin off
	// the edge.
	coordinateText: { flexShrink: 1 },
	avatarTarget: {
		// The target is the floor's, and the circle fills it — the same square
		// `./business-card` reserves for its heart.
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
	},
	avatar: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		borderRadius: radius.full,
	},
});
