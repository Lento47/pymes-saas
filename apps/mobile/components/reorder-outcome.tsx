import { isReorderErrorKey, type ReorderResult } from "@pymeshub/shared";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";

import {
	type FailureOverrides,
	messageFor,
	toApiFailure,
} from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { ErrorState } from "./error-state";
import { Text } from "./text";

/**
 * What a reorder did not bring back, under the control that asked for it.
 *
 * `orders.reorder` answers with the lines it could not copy — `reorderSkippedLineSchema` is
 * `{ productId, name, quantity, reason }`, and each reason's literal *is* a message key — so
 * this block is the client's half of a contract written to stop a reorder from producing a
 * short cart without saying so. Rendering the cart and dropping the return value would put
 * that defect back one layer up, where the customer approves an order they think is complete.
 *
 * ## The two copies this replaced, and the one thing that was not a difference
 *
 * `app/orders.tsx` and `app/order/[id].tsx` each held their own `ReorderOutcome`.
 * Diffed line by line, the two **bodies were identical** — every difference between them was
 * inside a comment, and two of those comments contradicted each other about which screen's
 * re-render the `signature` guard below exists for. So there was no per-screen divergence to
 * express as a prop: `result` and `error` are the whole interface, and they are what both
 * screens already passed. A prop added here to "keep" a difference would have been this
 * component inventing one.
 *
 * **The canonical copy is `app/order/[id].tsx`'s**, and the reason it can be named at all is
 * that the code gave no basis for choosing: its prose is what stands below, with the list
 * screen's two screen-specific claims returned to the caller they are true of — the grouping
 * note (why this block carries no border of its own inside a row's cell) is now a comment at
 * that call site, since placement is the screen's, and the ten-second poll is named here
 * because it is one of the two re-render paths the guard exists for. Deleted from both: the
 * paragraph that said the duplication was deliberate, which was honest when it was written
 * and is what this file ends.
 *
 * `[id].tsx` still wraps this in `styles.reportBlock`, and the list still drops it into the
 * row's own cell under the reorder button. Neither wrapper is a difference in this component:
 * **the block draws its own internal rhythm (`styles.report`) and no outer padding**, which is
 * the same rule `./error-state` states for its gutter — the block owns what is inside it, the
 * screen owns where it lands.
 *
 * ## The refusal, and why it is read from the sentence and not the code
 *
 * The refusal takes the other branch, and it is the one answer with no lines in it: the shop
 * is not taking orders, so nothing was attempted. It arrives as a `BAD_REQUEST` whose
 * `serverMessage` **is** `order.reorder.error.businessUnavailable`, which is why the override
 * is built from `isReorderErrorKey` rather than from the code — `code` and `domainCode` are
 * both the generic `BAD_REQUEST`, so the code cannot tell this refusal from a malformed request
 * and the sentence can.
 *
 * `CONFLICT` is overridden for a different reason. It is what a cart holding another shop's
 * items answers, and `lib/api-error.ts`'s default for it is "it is on our side, not yours" —
 * false here, because the other cart is the customer's own. `cart.otherBusiness.title` says the
 * true thing without offering the "start a new cart" button neither screen has anywhere to put.
 *
 * ## One announcement per appearance, and one per *answer* rather than per render
 *
 * The block carries `accessibilityLiveRegion="polite"` — Android's half, the platform's own
 * notice that the view changed — and iOS, which ignores that prop, is told by the effect
 * below. The two are alternatives and not layers, so the gate is `Platform.OS !== "ios"`: the
 * pairing `./toast`, `./rollback-notice` and `./error-state` all state, and asking twice is a
 * sentence read twice. `polite` and not `assertive` because this is news about a write that
 * already happened rather than an interruption, and the customer is still on the screen with a
 * cart to go and read — nothing here is an alert, which is why no `accessibilityRole` is set.
 *
 * The `failure` branch is excluded from that effect, and it is the one exclusion that is not a
 * platform gate. `ErrorState` announces its own sentence on iOS
 * (`components/error-state.tsx:139`, `Platform.OS !== "ios"`)
 * and that sentence *is* this one: the hook builds it as `t(messageFor(failure, overrides).key,
 * params)` (`lib/api-error.ts:224`), the same expression a few lines up. Announcing from both
 * places reads the refusal out twice on one screen — and on Android it nested a live region
 * inside a live region — so the failure branch belongs to the component that knows its block
 * arrived and the effect is left for the report below, which only this component knows about.
 *
 * The `announced` ref is what makes it once per *answer*. Both callers re-render for reasons
 * that have nothing to do with the reorder: the list re-reads itself every ten seconds while
 * anything in it is unfinished (`POLL_MS`, `app/orders.tsx:259` — the `refetchInterval`),
 * and the detail screen
 * re-renders after a pull-to-refresh even though its own five-second poll has stopped by the
 * time this block can exist (a reorder is offered only on a terminal order). Every value the
 * sentence is built from is a fresh object on each of those renders, so an effect keyed on the
 * sentence would say the same refusal out loud, unprompted, twice a minute on one screen and
 * after an unrelated pull on the other. Keying on the answer's *identity* — a request id for a
 * refusal, the skipped lines' own product-and-reason pairs for a partial one — is what fixes
 * that without either screen having to know.
 */
export function ReorderOutcome({
	result,
	error,
}: {
	result: ReorderResult | undefined;
	error: unknown;
}) {
	const { t } = useT();
	const skipped = result?.skipped ?? [];
	const failure = error ? toApiFailure(error) : null;

	const overrides: FailureOverrides = {
		CONFLICT: "cart.otherBusiness.title",
		...(failure && isReorderErrorKey(failure.serverMessage)
			? { BAD_REQUEST: "order.reorder.error.businessUnavailable" as const }
			: {}),
	};

	// The answer's identity, and the sentence to say about it. See the docblock above: the ref
	// below is keyed on this and never on the sentence, because the sentence is rebuilt from
	// fresh objects on every render of either screen.
	const signature = failure
		? `error:${failure.requestId}`
		: skipped.map((line) => `${line.productId}:${line.reason}`).join("|");

	const message = failure ? messageFor(failure, overrides) : null;
	const sentence = message
		? t(message.key, message.params)
		: skipped.length > 0
			? // A colon and commas rather than a key: the lines are already sentences and the
				// join between them is punctuation. `sentence` is spoken to a screen reader and
				// never drawn, so it does not need the em dash the visible lines carry.
				`${t("order.reorder.skipped.title")}: ${skipped.map((line) => `${line.quantity} ${line.name}, ${t(line.reason)}`).join(". ")}`
			: null;

	const announced = useRef<string | null>(null);

	useEffect(() => {
		if (!signature || announced.current === signature) return;
		announced.current = signature;
		if (Platform.OS !== "ios" || !sentence || failure) return;
		AccessibilityInfo.announceForAccessibility(sentence);
	}, [failure, sentence, signature]);

	if (failure) {
		// No wrapper, and no role added here: `ErrorState` carries `accessibilityRole="alert"`
		// and `accessibilityLiveRegion="polite"` on its own root
		// (`components/error-state.tsx:146-147`), so a `View` with a live region around it is a
		// second live region over the same sentence.
		return <ErrorState error={error} overrides={overrides} />;
	}

	if (skipped.length === 0) return null;

	// A key per line that is unique without being a position. `reorderSkippedLineSchema` carries
	// no line id, and the same product can genuinely appear twice — two lines of it at checkout,
	// both refused for the same reason — so a key made only from the line's own fields would
	// collide, and React resolves a collision by silently dropping one of the two children.
	// Counting identical predecessors fixes that without an index, which React would read as a
	// new row on every render of a list that is replaced wholesale rather than edited.
	const counted = new Map<string, number>();
	const lines = skipped.map((line) => {
		const base = `${line.productId}:${line.reason}`;
		const nth = counted.get(base) ?? 0;
		counted.set(base, nth + 1);
		return { key: `${base}#${nth}`, line };
	});

	return (
		<View style={styles.report} accessibilityLiveRegion="polite">
			<Text variant="label" bold>
				{t("order.reorder.skipped.title")}
			</Text>
			{lines.map(({ key, line }) => (
				// The em dash is punctuation between a name and the sentence that follows it, not
				// copy — the dictionary writes each reason to follow a name and not to start a
				// sentence, and the quantity sits in front of both so the line reads as
				// "2 × Café chorreado — ya no está disponible".
				// `tabular`, because the quantity opens every line of the group and the group is a
				// column (`styles.report`, `gap: space.xs`): proportional digits make "1 ×" and
				// "10 ×" different widths, so the names below the first do not start together. The
				// same construct carries the same prop in `app/checkout.tsx` and `app/order/[id].tsx`
				// — `{quantity} × {name}` — and `./quantity-stepper` records the reason. The em dash
				// and the reason clause that follow carry no digits, so the variant costs them
				// nothing.
				<Text key={key} variant="caption" tone="muted" tabular>
					{`${line.quantity} × ${line.name} — ${t(line.reason)}`}
				</Text>
			))}
		</View>
	);
}

// The block's own rhythm, one step tighter than the container it lands in: a heading and its
// lines are one group, and `space.xs` is the gap `./text`'s own docblock names for lines about
// a thing. No padding — that is the caller's, and the two callers pay different ones.
const styles = StyleSheet.create({
	report: { gap: space.xs },
});
