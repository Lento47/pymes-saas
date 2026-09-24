import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { Button } from "./button";
import { Sheet } from "./sheet";
import { Text } from "./text";

/**
 * A question with two answers, asked in the app's own surface.
 *
 * This replaced `Alert.alert` at the four places the app asks before it removes something:
 * signing out, revoking the other sessions, deleting an address, cancelling an order. The
 * system alert is not broken and not the platform's fault — it is *the platform's*, which is
 * the whole problem. It is the one surface in this app that no token reaches: the buttons come
 * back in the OS colour, the corner is the OS corner, the type is the OS type, and the same
 * `destructive` intent renders as a red *word* on iOS and a red *filled* button on Android. The
 * identical question therefore looked like a different app on each platform and like neither one
 * on either, and it sat outside everything `theme/tokens.ts` and `lib/motion.ts` decide.
 *
 * ## The panel carries the weight, and the screen's own control does not
 *
 * An alert is summoned by a control that already shouted: `app/account` drew "Cerrar sesión" in
 * `variant="destructive"` — a filled red pill at the foot of the screen — and *then* asked. Two
 * warnings for one decision, and the one on screen was the louder, which spends the alarm on the
 * row instead of on the consequence. So the screen-level control goes quiet (`secondary`) and the
 * destructive weight lives here, in the answer that actually does the thing: the confirm is the
 * only filled control in the panel and the cancel is a `ghost` beneath it.
 *
 * `ghost` is reachable here where `./action-bar` refuses it (:216-219), and the reason is the
 * difference between the two components rather than a relaxation: a bar is a screen's floor and
 * holds its one forward action, so a hairline button there is a bar with no weight; this panel's
 * *action* is the filled one, and the cancel is the way out beside it, which is what a ghost
 * button is for.
 *
 * ## The haptic is not here
 *
 * `warning()` belongs to the tap that does the thing, so it stays at the call site inside
 * `onConfirm` — the same place `app/order/[id]` already argues for it. A component that buzzed
 * on its own confirm would be a haptic with no owner, and the panel has no idea whether what it
 * was asked about is destructive.
 *
 * ## Close-then-act, and why the panel does not wait
 *
 * `onConfirm` runs and the panel closes in the same tap rather than staying up with a spinner.
 * The question has been answered; the wait belongs to the screen that asked it, which already
 * has a loading control and the toast or the rollback notice for whatever the server says. An
 * alert behaves this way too, and keeping it means no call site needed a `busy` prop.
 *
 * ## No new strings
 *
 * `action.close`, `action.cancel` and the four questions are landed keys, and the labels arrive
 * as props — this file reads `action.cancel` only as the default. `packages/i18n` is a closed
 * union and a lane does not add to it (`docs/design-mobile.md:484-489`).
 */
export function ConfirmSheet({
	open,
	onClose,
	title,
	body,
	confirmLabel,
	cancelLabel,
	onConfirm,
}: {
	open: boolean;
	onClose: () => void;
	/** The question. `./sheet` draws it and announces it as the modal's label. */
	title: string;
	/** The consequence, in one sentence. Omitted where the question is the whole of it. */
	body?: string;
	/** The answer that acts — `auth.signOut.confirm`'s "Cerrar sesión", not "Aceptar". */
	confirmLabel: string;
	/** Defaults to `action.cancel`. The order screen says "Volver" and passes its own. */
	cancelLabel?: string;
	onConfirm: () => void;
}) {
	const { t } = useT();
	const insets = useSafeAreaInsets();

	const confirm = () => {
		onClose();
		onConfirm();
	};

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={title}
			closeLabel={t("action.close")}
			// `[1]` is the fraction that resolves to no translation on a panel shorter than the
			// screen — which this one is, and which is what keeps it drawn where it is. The
			// reading is `./filter-sheet`'s and `./promo-input`'s; a fraction below it would ask
			// for an offset this panel's own height cannot reach.
			snapPoints={[1]}
			footer={
				<View
					style={[styles.actions, { paddingBottom: insets.bottom + space.md }]}
				>
					<Button
						label={confirmLabel}
						variant="destructive"
						size="lg"
						shape="pill"
						fullWidth
						onPress={confirm}
					/>
					{/* Under the action, not beside it: the safe answer is the one a thumb reaches
					    without aiming, and a row of two pills at 200% text wraps into the same
					    column anyway. */}
					<Button
						label={cancelLabel ?? t("action.cancel")}
						variant="ghost"
						size="lg"
						shape="pill"
						fullWidth
						onPress={onClose}
					/>
				</View>
			}
		>
			{body ? (
				<Text variant="body" tone="muted">
					{body}
				</Text>
			) : null}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	// The footer slot carries no horizontal padding and no bottom inset — `./sheet`'s own
	// docblock says so and `./promo-input` pays both at its call site for the same reason. The
	// inset is the caller's to add because only the caller has the insets.
	actions: { paddingHorizontal: space.lg, gap: space.sm },
});
