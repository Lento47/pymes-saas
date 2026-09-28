import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { icon, MIN_TOUCH_TARGET, space, useTheme } from "@/theme";

/**
 * What this app is, and the two ways into it.
 *
 * The auth group's front door — the base route of `(auth)/_layout.tsx`'s stack, and a
 * real route of its own, so a shared `pymeshub://welcome` link resolves without anything
 * else naming it. It is deliberately **not** the app's cold start:
 * `app/index.tsx` answers a signed-out reader in full (the feed, storefronts, categories,
 * search all read without a session) and a wall in front of that would be spending the top
 * of the funnel the public pages exist to feed. What lives here is the moment after that
 * reader has decided they want an account — from the account hub, from a gate that really
 * does need a session, or from a promo link — and at that point the question "which one?"
 * is worth a screen of its own, because both answers are equally real and neither is the
 * default in a product whose other half is the shop.
 *
 * ## One loud thing, and where the second door went
 *
 * **Create is the only filled control on this screen.** It used to be two full-width
 * buttons and a chevron, which is three things competing and the loudest one is then a
 * guess: Rule 1 of `docs/design-mobile.md` is one loud thing, and `./back-button`'s
 * docblock makes the sharper version of the same point — a screen whose loudest control is
 * "leave" argues against its own content. So the second door is **a sentence with the
 * action inside it**, the shape `./empty-state`'s `actionLabel` and the sign-up form's own
 * consent links already use in this app:
 *
 *     Already have an account? **Sign in**
 *
 * The cost is nil and the reason is worth stating, because "demote the second button" is
 * usually a real loss: a returning reader still gets to `/sign-in` in exactly one tap, on
 * the same one row that used to be the second button. What is lost is the *weight* — and
 * weight is what a returning reader does not need, since they are not deciding anything.
 *
 * ## The way out is chrome, so it is at the top
 *
 * `BackButton` sits top-left, which is where every platform puts a back control and what
 * its own docblock says it should be. It was below the buttons here, and that was two
 * mistakes at once: it borrowed the weight of an action from the only action on the screen,
 * and it made "leave this flow" the last thing a thumb reaches for. The forms below still
 * draw theirs at the foot of their scroll — they have to, because their content is taller
 * than the screen and the control has to survive the scroll — so this is the one screen in
 * the group where the chevron is chrome rather than the last row of a form, and that
 * difference is the point of it. A reader who arrived from a link has no gesture for this,
 * which is the case `./back-button` exists for and `lib/leave` makes real.
 *
 * ## No artwork
 *
 * There is no hero image here and this screen does not add one, for the reason
 * `app/(auth)/sign-in.tsx`'s docblock gives for its mark: a bundled image is a file to keep
 * in a density per platform and a second thing that can disagree with the palette, while
 * the palette and the type scale are already the two things this app composes its identity
 * from. The mark beside the wordmark is the same composition, from the same tokens, and the
 * space below the claim is left empty rather than filled with a line about how many shops
 * are nearby: there is no API behind that number yet, and a claim the app cannot make is
 * worse than an empty screen.
 *
 * ## Dynamic Type, since this screen does not scroll
 *
 * A non-scrolling screen is a promise that its content fits, so here is the arithmetic at
 * the 200% setting, which is the one that has to hold: the wordmark row is `icon.action`
 * tall (20), the claim is `display` at two lines (34 × 2), the subtitle is `label` at two
 * (18 × 2), and the gaps pay `space.lg` twice and `space.xl` twice — about 180pt of
 * content. The action and the sentence under it are a further 58 + 44 plus one `space.sm`,
 * or 110. Some 290pt of a screen that is well over 600 on every phone this app runs on,
 * which is why nothing is cut off and nothing needs a drag. The text is also allowed to
 * wrap rather than be measured: the claim and the subtitle are the only strings that can
 * grow, and both are inside a column wide enough for three words fewer.
 *
 * The identity block is the one that takes the slack (`flex: 1`), and the block at the
 * foot is `flexShrink: 0` — so on a short screen the *claim* gives up its centring before
 * the action is ever squeezed, which is the order those two should ever be dealt in.
 */
export default function Welcome() {
	const { t } = useT();
	const { colors } = useTheme();

	return (
		<View style={styles.root}>
			{/* `bottomInset` and not left to the default, for the prop's own reason: this screen's
			    content ends at the screen's edge, and every screen that ends at the edge asks
			    for the inset (`app/profile.tsx`, `app/inbox.tsx`, `app/addresses.tsx`,
			    `app/admin.tsx`). The other way round is a docked `ActionBar`, which pays the
			    inset in its own padding — and there is no bar here, so without this the
			    sentence under the action sits under the gesture bar. */}
			<Screen bottomInset contentStyle={styles.content}>
				<View style={styles.chrome}>
					<BackButton to="/" />
				</View>

				<View style={styles.identity}>
					<View style={styles.mark}>
						<Ionicons
							name="storefront-outline"
							size={icon.action}
							color={colors.primary}
							// Decoration: the wordmark beside it is the name, and a glyph carrying
							// no label of its own is announced as nothing at all.
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="heading" bold>
							{t("app.name")}
						</Text>
					</View>
					<View>
						{/* `header`: the claim is this screen's one heading, and a screen reader's
						    rotor navigates by heading. Without the role it is announced as one
						    more string, and the screen becomes a name, a sentence and two
						    controls with no shape. */}
						<Text variant="display" bold accessibilityRole="header">
							{t("auth.welcome.title")}
						</Text>
						<Text variant="label" tone="muted" style={styles.subtitle}>
							{t("auth.welcome.subtitle")}
						</Text>
					</View>
				</View>

				<View style={styles.doors}>
					<Button
						label={t("auth.welcome.signUp")}
						onPress={() => router.push("/sign-up")}
					/>

					{/* The whole row is the target, not the two words at its end — the same
					    argument `./consent-check` makes about a sentence wider than its box, and
					    a large thumb aiming at the words it is reading must not miss because
					    the words are 60 points wide. `action` is this app's *ink* token (the one
					    `theme/tokens.ts` documents for text that is read), and the underline is
					    what marks the row as live for the reader who cannot see a link. */}
					<Pressable
						onPress={() => router.push("/sign-in")}
						accessibilityRole="button"
						style={styles.switch}
					>
						<Text variant="label" tone="muted">
							{`${t("auth.welcome.hasAccount")} `}
						</Text>
						<Text
							variant="label"
							tone="action"
							bold
							style={styles.switchAction}
						>
							{t("action.signIn")}
						</Text>
					</Pressable>
				</View>
			</Screen>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	// **Not a scrolling screen**, and that is a decision rather than an omission: this is the
	// only screen in the app whose whole content is four short strings, so there is nothing
	// here to scroll *to* — and the reason is mechanical. `Screen`'s scroll branch hands
	// `contentStyle` to the body wrapper (`components/screen.tsx:150`) while the
	// `ScrollView`'s own `contentContainerStyle` is fixed at `styles.scrollContent`
	// (`screen.tsx:176`, `screen.tsx:226`), which carries a bottom pad and no `flexGrow`.
	// A column inside a content container sized to its content has no slack to distribute,
	// so "identity centred, action at the bottom" is not expressible through that branch —
	// and the wrong answer to that is to reach for `Screen` with a taller wrapper. Off, the
	// body is a direct child of the `flex: 1` safe area and `flex: 1` here fills the screen.
	//
	// What the reader loses is a gesture that had nothing to do: at 200% Dynamic Type the
	// whole column is still shorter than the screen (see the numbers in the docblock), so
	// the action never leaves the thumb's reach and nothing is ever cut off.
	content: { flex: 1, gap: space.xl },
	// The back control, on its own row so the identity block below it can take the slack
	// without moving the chrome: `gap: space.xl` would otherwise sit between them too.
	chrome: { flexDirection: "row" },
	// The block that takes the slack: the mark and the claim sit in the middle of the screen
	// rather than at the top of it, which is what leaves the action at the bottom where the
	// thumb already is.
	identity: { gap: space.lg, flex: 1, justifyContent: "center" },
	// The glyph and the wordmark on one line, as `app/(auth)/sign-in.tsx` composes it.
	mark: { flexDirection: "row", alignItems: "center", gap: space.sm },
	// `Screen`'s strip pays this between the title and its subtitle
	// (`components/screen.tsx:220-225`); the strip is composed here now, so the number is
	// paid here too — the same line as `app/(auth)/sign-in.tsx`, because these two screens
	// are one design.
	subtitle: { marginTop: space.xs },
	// `flexShrink: 0` and the reason is in the docblock: the action is the one control on
	// this screen, and it is the last thing allowed to give up room.
	doors: { gap: space.sm, flexShrink: 0 },
	// One row, centred under a full-width action, and `MIN_TOUCH_TARGET` tall so the target
	// is the sentence and not the two words inside it.
	switch: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	switchAction: { textDecorationLine: "underline" },
});
