import { useCallback, useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";

import { type FailureOverrides, useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";

/**
 * A screen that could not load, and the code to quote.
 *
 * The `requestId` line is the whole reason this component exists rather than each screen
 * writing its own. The API logs that id against the failure, so a customer who has it is a
 * support conversation that starts with a lookup instead of "what did you tap?" — and it
 * only survives if it is rendered everywhere, which a shared component guarantees and nine
 * copy-pasted error blocks do not.
 *
 * `error` is the raw throw. The translation from tRPC's shape into a sentence happens in
 * `useApiFailure`, which also calls `refresh()` when the failure is a 401 — so mounting an
 * ErrorState after a token expired is what starts the recovery, rather than a retry that
 * resends the same dead token.
 *
 * The sentence is the API's own, chosen by code: `useApiFailure` maps the failure's
 * `domainCode` first and its tRPC code second, so a rate limit reads "Demasiados intentos
 * seguidos" and an expired session reads "Tu sesión venció" instead of one grey "algo
 * salió mal" that hides the only part a customer could act on.
 *
 * Whatever `onRetry` returns is waited on, so the button goes busy until it settles — a
 * query's `refetch()` returns a promise and a plain state setter does not, and both are
 * retries the reader should only be able to start once. Five taps is five identical requests
 * racing each other, and on a metered phone connection that is the customer's money spent on
 * our indecision.
 *
 * ## The gutter is this component's, not the caller's
 *
 * It pays its own `paddingHorizontal`, like `./empty-state` and a labelled `./spinner` do,
 * so the three message blocks in this app agree about who owns the inset: the block does.
 * Every call site used to wrap this in a local `paddingHorizontal` instead, which is the
 * arrangement that holds right up until a screen forgets — and `padded={false}` screens are
 * the majority here, because their lists are edge-to-edge and this is not a row. A screen
 * that adds a wrapper anyway only narrows a centred block, which `wrap`'s measurement below
 * already caps.
 *
 * ## One announcement per appearance, and one mechanism per platform
 *
 * The block carries `accessibilityLiveRegion="polite"` and `accessibilityRole="alert"`, which
 * is Android's half: the live region is the platform's own notice that the view changed, and
 * TalkBack reads the sentence when it appears. That prop is Android's alone — RN declares it
 * on `AccessibilityPropsAndroid` with `@platform android`
 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:105-109`) — so iOS, which
 * ignores it, is told by the effect below instead.
 *
 * The two are alternatives and not layers. Announcing on Android as well speaks a sentence the
 * live region has already spoken, which a reader hears twice — so the effect's gate is
 * `Platform.OS !== "ios"`, the identical one at `components/toast.tsx:201` and in
 * `components/rollback-notice.tsx`, whose docblock states the rule: **on Android the live
 * region announces; on iOS the explicit call does.** An unconditional call here is that
 * defect, and it is the reason this note is longer than the branch it explains.
 *
 * ## The wrappers this replaced, and the double announce they became
 *
 * `app/orders.tsx` and `app/order/[id].tsx` each wrapped this component in a `View` with
 * a live region of its own *and* announced on iOS themselves, because they were written when
 * this file declared no accessibility at all — their own comments said so. Both halves went
 * redundant the moment the two props and the effect above landed, and the second was worse than
 * redundant: their iOS announce fired the same sentence `message` carries, because the hook
 * builds it as `t(messageFor(failure, overrides).key, params)` (`lib/api-error.ts:224`) — the
 * very expression those screens hold as `sentence`. So this component's accessibilty work
 * *created* an iOS double announcement in two screens until both were fixed in the same pass:
 * the wrappers are gone and each screen's effect now excludes the failure branch
 * (`orders.tsx` and `[id].tsx`, both commented at the exclusion).
 *
 * The sequence is worth keeping because of what it shows: adding the announce here was right
 * and still made the app worse somewhere else, and no type, lint or test in this repo connects
 * "this component now announces" to "that screen already does". The link was found by reading
 * the two call sites, which is also the only way it could have been.
 *
 * There is nothing decorative to hide from the tree. `./toast` sets
 * `accessibilityElementsHidden` + `importantForAccessibility="no"` on its checkmark because a
 * mark beside the message is a second thing a reader would land on; this component draws no
 * icon at all, so it has no such node — and adding one to justify the pair of props is how a
 * component grows decoration. The retry `Button` is a real control and stays in the tree.
 */
export function ErrorState({
	error,
	onRetry,
	/**
	 * Per-screen sentences for codes whose meaning depends on the call.
	 *
	 * A value is a key, or a key with the parameters its copy needs — `biz.board.conflict.body`
	 * names `{status}`, and the status is a fact only the screen holds.
	 */
	overrides,
	title,
	style,
}: {
	error: unknown;
	onRetry?: () => unknown;
	overrides?: FailureOverrides;
	title?: string;
	/**
	 * Placement, and only placement: `flex: 1` beside a dismiss control, an `alignSelf`.
	 *
	 * The gutter, the measure and the centring stay here, where the docblock above says they
	 * belong — the same line `./screen` draws for its `contentStyle`, and for the same reason:
	 * a block dropped into a row needs its share of the row and nothing else.
	 */
	style?: ViewStyle;
}) {
	const { t } = useT();
	const { message, supportLine } = useApiFailure(error, overrides);
	const [retrying, setRetrying] = useState(false);
	// A ref as well as the state: the state is what the button renders and the ref is what
	// the guard reads, because two taps inside one frame both see the pre-update value.
	const inFlight = useRef(false);

	const retry = useCallback(() => {
		if (!onRetry || inFlight.current) return;
		inFlight.current = true;
		setRetrying(true);
		void Promise.resolve(onRetry()).finally(() => {
			inFlight.current = false;
			setRetrying(false);
		});
	}, [onRetry]);

	// iOS only, because the live region on the block below is the whole of Android's
	// announcement and asking twice is a sentence read twice. `message` is empty when there is
	// no error, and nothing is said then.
	useEffect(() => {
		if (!message || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(message);
	}, [message]);

	return (
		<View
			style={[styles.wrap, style]}
			accessibilityRole="alert"
			accessibilityLiveRegion="polite"
		>
			<Text variant="heading" bold style={styles.centered}>
				{title ?? t("state.error.title")}
			</Text>
			<Text variant="body" tone="muted" style={styles.centered}>
				{message}
			</Text>
			{supportLine ? (
				// Rendered smaller and muted: it is a thing to read *if* the problem comes
				// back, and a customer who does not need it should not have to read past it.
				// Selectable, because the only use for it is being copied into a message.
				<Text variant="caption" tone="muted" selectable style={styles.centered}>
					{supportLine}
				</Text>
			) : null}
			{onRetry ? (
				<Button
					label={t("action.retry")}
					onPress={retry}
					variant="secondary"
					loading={retrying}
					style={styles.action}
				/>
			) : null}
		</View>
	);
}

/**
 * The centred block's measure, exported for the message surfaces that agree with it.
 *
 * A centred sentence read across a tablet's full width is a head that turns to follow the
 * line, and one file spelling the cap a second time is how two message blocks drift apart —
 * `./empty-state` reads this instead of writing its own `space.huge * 10`. Derived from the
 * spacing scale so it stays a token decision rather than a number that was typed once.
 */
export const MEASURE = space.huge * 10;

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: space.huge,
		paddingHorizontal: space.lg,
		gap: space.sm,
	},
	// A measure, not a breakpoint — see `MEASURE` above for the derivation.
	centered: { textAlign: "center", maxWidth: MEASURE },
	action: { marginTop: space.md },
});
