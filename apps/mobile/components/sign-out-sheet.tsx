import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRESS_SCALE_DIALOG } from "@/lib/motion";
import { merchantType, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Sheet } from "./sheet";
import { Spinner } from "./spinner";
import { Text } from "./text";

/**
 * "Are you sure you want to sign out?", asked in a panel that is trying to be calm.
 *
 * ## What it is replacing, and why it is not `./confirm-sheet`
 *
 * `ConfirmSheet` is the right component for the four places the app removes something —
 * cancelling an order, deleting an address, revoking sessions, deleting the account — and it
 * is the wrong one here for two reasons that are not taste.
 *
 * **It closes before it acts.** `ConfirmSheet`'s `confirm()` calls `onClose()` and then
 * `onConfirm()` in the same tap, deliberately: *"the question has been answered; the wait
 * belongs to the screen that asked it."* That is right when the answer cannot fail and the
 * screen behind has a loading control. Neither holds here — signing out is a network call
 * against two providers, it fails, and the only place a failure could be reported is the panel
 * that just disappeared.
 *
 * **It answers in red.** `ConfirmSheet`'s `confirmVariant` defaults to `destructive`, and the
 * merchant palette's `destructive` is `#D5493E`. Signing out ends a *session*. It destroys
 * nothing: the shop's catalogue, the codes, the orders and the account are all still there
 * afterwards, and the reader signs back in to the same board — which is the whole of
 * `lib/role.ts`'s argument for keeping the stored preference across a sign-out. A full-width
 * red surface would spend the app's one loud colour on the one action in it that is reversible,
 * and the colour is kept for the actions that are not.
 *
 * ## Why the controls are built here rather than borrowed from `./button`
 *
 * Three things this panel needs that `./button` does not have, and each is a fact about the
 * merchant palette rather than a preference. `Button`'s `primary` is `colors.primary`, which
 * under `(business)` is **lime** — the one colour this surface is specified not to carry, and
 * the reason a lime CTA is named as forbidden rather than merely unwanted. Its `rounded` shape
 * is `radius.sm` (6) and its `pill` is `radius.full`; this wants 14, and 14 is between two
 * steps of a scale `theme/tokens.ts` declares is a *copy* of the web's `globals.css` rather
 * than a local invention. And `Button` has no `scaleTo`, so `PRESS_SCALE_DIALOG` could not
 * reach the press at all.
 *
 * So the two controls are `Pressable` — which is where the app's press feedback actually
 * lives, so the spring, the ripple, the 44pt floor and the reduced-motion behaviour are all
 * still the shared ones — plus a `Text` and, for the busy state, the shared `Spinner`.
 *
 * ## The heights are fixed, and that is a deliberate trade
 *
 * 52 and 48 rather than `minHeight`, which is what every other control in this app uses and
 * what the 200%-Dynamic-Type rule asks for. At 200% the label wraps, and because React Native
 * does not clip text the second line leaves the button rather than being cut off — so the
 * label is held to one line here, which makes the overflow horizontal and bounded instead of
 * vertical and free. This was chosen over the app's own rule, and the cost is recorded here so
 * it is a decision rather than a surprise: the cost is a fixed box, and the mitigation is one
 * line.
 *
 * ## Nothing here is only movement
 *
 * The panel arrives, and under `useReducedMotion()` `./sheet` *places* it rather than playing
 * the arrival — the same rule every other sheet follows, and the reason the reduced-motion
 * branch was written to cover both exits. The busy state is a word, the error is a word, and
 * `accessibilityViewIsModal` is on the panel, so no part of this interaction is carried by the
 * animation alone.
 */

/** How long the sheet waits before showing the failure, so a fast refusal is not a flash. */
const ERROR_DELAY_MS = 400;

type SignOutSheetProps = {
	open: boolean;
	onClose: () => void;
	/** The question. `./sheet` announces it as the panel's label, so it is never only drawn. */
	title: string;
	/** The consequence, in one sentence. Omitted where the question is the whole of it. */
	body?: string;
	confirmLabel: string;
	/** What the button says while the round trip is out. The label is never replaced. */
	busyLabel: string;
	cancelLabel: string;
	/** The refusal. `destructive` ink, and the only colour on this surface that is not ink. */
	errorLabel: string;
	/**
	 * The call. It is a promise rather than a callback because this component is what has to
	 * know whether it worked: a rejection is the difference between a sheet that closes and a
	 * reader who is told nothing.
	 */
	onSignOut: () => Promise<void>;
	/**
	 * Ran because the sign-out succeeded. The caller owns where the reader goes, for the
	 * reason `./confirm-sheet` gives about its haptic: a component that navigated on its own
	 * would be navigating on behalf of a session it knows nothing about.
	 */
	onSignedOut?: () => void;
};

export function SignOutSheet({
	open,
	onClose,
	title,
	body,
	confirmLabel,
	busyLabel,
	cancelLabel,
	errorLabel,
	onSignOut,
	onSignedOut,
}: SignOutSheetProps) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	/**
	 * Close, and only close, when the reader is allowed to.
	 *
	 * A drag, a backdrop tap and the back key all arrive here while the round trip is out, and
	 * a panel that closes under a request it is still waiting on shows a spinner on a screen
	 * nobody is on. Refusing the dismissal is also what keeps the failure reportable: the
	 * error lives in this component's state, and an unmounted component cannot render it.
	 */
	const requestClose = useCallback(() => {
		if (busy) return;
		setError(false);
		onClose();
	}, [busy, onClose]);

	const confirm = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		setError(false);
		try {
			await onSignOut();
			// The panel's own exit, and then the caller's destination. Ordered this way because
			// the two are different concerns: the reader asked the question, the question is
			// answered, and only then is there anywhere to send them.
			onClose();
			onSignedOut?.();
		} catch {
			// **The reader stays signed in and the panel stays open.** That is what the next
			// three lines do and it is the whole of the reason this component exists.
			//
			// One honest limit, recorded rather than papered over: `signOut()` revokes the
			// marketplace session on the server *before* it clears the local token
			// (`packages/auth/src/marketplace-client.ts`), so a request that succeeds and a
			// device write that then fails leaves the session destroyed and this still signed
			// in. That window is narrow and it closes itself — the next API call answers 401,
			// and `request()` drops the stored token on a 401 before it throws (`:31-33`), so
			// the next session read finds nothing and the reader is signed out one request
			// later. No reconciliation pass is written for it: a second round trip here would
			// trade a rare wrong-looking state for a state that is wrong on every sign-out
			// whose network blips.
			//
			// The delay is the other half of "calm". A refusal that arrives in 80ms is not
			// something the reader did; showing a red sentence for it teaches them that the
			// message is noise. 400ms is past any local failure and inside any real round trip.
			setBusy(false);
			setTimeout(() => setError(true), ERROR_DELAY_MS);
		}
	}, [busy, onClose, onSignedOut, onSignOut]);

	return (
		<Sheet
			open={open}
			onClose={requestClose}
			variant="dialog"
			// `[1]` is the fraction that resolves to no translation on a panel shorter than the
			// screen — which this one is, and which is what keeps it drawn where it is. The
			// reading is `./confirm-sheet`'s and `./filter-sheet`'s; a fraction below it would
			// ask for an offset this panel's own height cannot reach.
			snapPoints={[1]}
			// The question, and it is passed as `title` as well as drawn below. `./sheet` puts
			// it on `accessibilityLabel` with `accessibilityViewIsModal` beside it, so it is the
			// modal's *name* to a screen reader; the drawn copy is this component's own because
			// the two sizes are a pair and `./sheet`'s `title` slot is the shared `title` step
			// with a fixed margin. Two renderings of one string, deliberately: `title` is what
			// VoiceOver announces, and the prompt step has negative tracking the shared step
			// does not.
			title={title}
			closeLabel={cancelLabel}
		>
			<View style={styles.body}>
				<Text
					variant="title"
					bold
					style={[merchantType.prompt, { color: colors.foreground }]}
				>
					{title}
				</Text>

				{body ? (
					<Text
						style={[
							merchantType.explain,
							styles.explain,
							{ color: colors.mutedForeground },
						]}
					>
						{body}
					</Text>
				) : null}
			</View>

			{/* The refusal, in the layout rather than floated over it, and only after a delay
			    so a fast local error is not a flash of red in a panel that was open for a
			    second. `minHeight` reserves the line whether or not it is there: a panel that
			    grows when the error appears moves the button the reader is looking at. */}
			<View style={styles.errorSlot}>
				{error ? (
					<Text
						style={[merchantType.explain, { color: colors.destructive }]}
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						{errorLabel}
					</Text>
				) : null}
			</View>

			<View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
				<Pressable
					onPress={() => void confirm()}
					disabled={busy}
					disabledOpacity={1}
					// The subtle third scale from `lib/motion`, for the one filled control in a
					// panel whose only job is to be still.
					scaleTo={PRESS_SCALE_DIALOG}
					// No ripple: this is a near-black pill on white and Android's bounded ripple
					// takes the button's rectangular frame, so every tap flashed a grey square
					// inside a shape that has no square in it.
					ripple={false}
					accessibilityRole="button"
					accessibilityLabel={busy ? busyLabel : confirmLabel}
					accessibilityState={{ busy, disabled: busy }}
					style={[
						styles.primary,
						{
							// `muted` while the call is out and `foreground` otherwise, which is
							// `./button`'s own rule for `loading` against `disabled` and the reason
							// the ink below follows the surface rather than staying put: near-black
							// words on `muted` are a control whose own name cannot be read.
							backgroundColor: busy ? colors.muted : colors.foreground,
						},
					]}
				>
					{/* One row, always: the spinner joins the label in the leading slot instead of
					    standing in for it, so the words the reader is waiting on are the words that
					    stay. This is `./button`'s §45 arrangement and the reason it is repeated
					    rather than reinvented. */}
					<View style={styles.primaryRow}>
						{busy ? (
							<Spinner
								color={busy ? colors.mutedForeground : colors.primaryForeground}
								size="small"
							/>
						) : null}
						<Text
							style={[
								styles.primaryLabel,
								{ color: busy ? colors.mutedForeground : colors.card },
							]}
							numberOfLines={1}
						>
							{busy ? busyLabel : confirmLabel}
						</Text>
					</View>
				</Pressable>

				{/* No border, and no fill: a hairline here is a second outline in a panel whose
				    only filled control is the answer, and a filled secondary would give the
				    safe choice the weight of the one that ends the session. The 48pt is under
				    the 44pt floor's neighbourhood on purpose — it is still over it, and the
				    difference is what says "this is the way out" rather than "this is an
				    action". */}
				<Pressable
					onPress={requestClose}
					disabled={busy}
					disabledOpacity={1}
					scaleTo={PRESS_SCALE_DIALOG}
					ripple={false}
					accessibilityRole="button"
					accessibilityLabel={cancelLabel}
					accessibilityState={{ disabled: busy }}
					style={styles.secondary}
				>
					<Text
						style={[styles.secondaryLabel, { color: colors.foreground }]}
						numberOfLines={1}
					>
						{cancelLabel}
					</Text>
				</Pressable>
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	// `Sheet`'s own body pays the 20pt gutter and the bottom inset; this is the space
	// *between* the question and the answer, which is the panel's own.
	body: { gap: 8 },
	// 320 rather than the panel's full width, because a sentence set to the width of a phone
	// in a 14pt face runs to a line and a half and the half is the part nobody reads twice.
	explain: { maxWidth: 320 },
	// One line of `merchantType.explain` held open whether or not the refusal is there, so
	// the button below it does not move when the error arrives. `minHeight` on an empty view
	// is the honest way to reserve it — an `opacity: 0` sibling would still be read.
	errorSlot: { minHeight: 20, justifyContent: "center" },
	actions: { paddingTop: 24, gap: 8 },
	// No `borderWidth`. The near-black fill against a white sheet is separated by more than
	// contrast, and a hairline around a dark pill on white is the edge-drawing habit this
	// panel exists to leave behind.
	primary: {
		height: 52,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	// The label's own line box is the row's floor, so the row is at least as tall as the words
	// in it and swapping the label for the busy one cannot change the button's height. This is
	// `./button`'s `styles.content` and the reason it is copied rather than imported: the
	// component that owns the button is the one that would have to grow a prop for it.
	primaryRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		minHeight: 24,
	},
	// `weight.bold` would say the same thing; the literal is here because the value is a
	// weight the type scale does not carry and `theme/tokens.ts`'s `font` object is the
	// named home for families, not for a weight this one step introduces.
	primaryLabel: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
	secondary: {
		height: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryLabel: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
});
