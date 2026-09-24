import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
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
	hasLocation,
	onRequestLocation,
	name,
	avatarUrl,
	onAvatarPress,
}: {
	/** Whether `useDeviceLocation()` has a fix. The header states two words, not numbers. */
	hasLocation: boolean;
	/** The location hook's explicit `request()` action. */
	onRequestLocation: () => void;
	/** The given name, or `null` when the profile has none and the email prefix is all there is. */
	name: string | null;
	/** `users.me.image`. Null draws the initials; a URL draws the photo over them. */
	avatarUrl: string | null;
	onAvatarPress: () => void;
}) {
	const { colors } = useTheme();
	const { t } = useT();

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
				{/* The title: this screen's `heading`, the register `./section-header` gives
				    its own titles, so the greeting names the page without out-shouting the
				    field below it (`docs/design-mobile.md` Rule 1). */}
				<Text variant="heading" bold style={styles.title}>
					{name ? t("home.greeting", { name }) : t("home.greeting.anon")}
				</Text>

				{hasLocation ? (
					// The fact. Inert on purpose — see the docblock: a tap that only re-asks
					// an answered question is a nag this app does not do.
					<View style={styles.coordinate}>
						{/* The pin changes shape and ink between the two states (filled at
						    `primary`, outlined at `mutedForeground`), so the state is never
						    carried by colour alone. */}
						<Ionicons
							name="location"
							size={icon.inline}
							color={colors.primary}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="label" tone="muted" style={styles.coordinateText}>
							{lead}
							{/* Re-declares `variant="label"`: `./text` defaults a nested node to
							    `body` and would draw the value at 15/21 inside this 13/18 line. */}
							<Text variant="label" tone="default">
								{t("discovery.hero.currentLocation")}
							</Text>
						</Text>
					</View>
				) : (
					// The action. The whole meta row is the target — pin included — so the
					// line's shape never changes between states, only its words, its ink and
					// its role. `./pressable`'s base already floors the box at
					// `MIN_TOUCH_TARGET`; there is no `hitSlop`, because nothing here is drawn
					// small enough to inflate and a horizontal one would reach the avatar.
					<Pressable
						onPress={onRequestLocation}
						accessibilityRole="button"
						accessibilityLabel={`${t("discovery.hero.deliverTo")} · ${t("location.use")}`}
						style={[styles.coordinate, styles.coordinateAction]}
					>
						<Ionicons
							name="location-outline"
							size={icon.inline}
							color={colors.mutedForeground}
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="label" tone="muted" style={styles.coordinateText}>
							{lead}
							<Text variant="label" tone="action">
								{t("location.use")}
							</Text>
						</Text>
					</Pressable>
				)}
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
						<Text variant="caption" tone="primary" bold>
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
