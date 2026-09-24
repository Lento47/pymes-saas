import type { MessageKey } from "@pymeshub/i18n";
import type { Cart } from "@pymeshub/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

import { ActionBar } from "./action-bar";
import { Button } from "./button";
import { Field } from "./field";
import { ListRow } from "./list-row";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

/**
 * The promo code: the row that shows what is on the cart, and the sheet that changes it.
 *
 * ## This control exists because the API takes a code
 *
 * A promo field is easy to draw and expensive to be wrong about — a customer types a code,
 * watches nothing happen, and concludes the app is broken — so nothing was built until
 * `cart.applyPromotion` was read. It is real: the code is stored on the cart row, `cart.get`
 * returns it as `promotionCode` with a `promotionError` beside it, and the discount it earns
 * is a `discountMinor` the server computed and the receipt prints. Nothing here decides
 * whether a code is good, and nothing here computes what it is worth.
 *
 * ## Two components, because a sheet is not a row
 *
 * `PromoInput` goes inside the cart's scroll — it is a line of the receipt block, above the
 * figures the code changes. `PromoSheet` has to be a *sibling* of that scroll rather than a
 * child of it: `./sheet` positions itself with `StyleSheet.absoluteFill`, which resolves
 * against its nearest parent view, so a sheet rendered inside a `ScrollView`'s content
 * would be laid out inside the content and scroll away from the screen it is covering. The
 * screen composes them; the hook below is what the two share.
 *
 * ## A refusal is the cart's own field, and it is a message key
 *
 * `applyPromotion` does not throw when a code is bad. It answers with the cart, carrying
 * `promotionError` beside the code, so the state survives a reload and the screen reads it
 * back from the same query everything else on the cart is read from. That is why the error
 * never lives in local state here: the customer can background the app, come back, and the
 * code they typed is still there with the same reason under it.
 *
 * That field is a **key** (`PROMOTION_ERROR_KEYS` in `@pymeshub/shared`), not the API's
 * sentence. It used to be Spanish prose written in the Worker, which is a file with no
 * translator and no dictionary — so an English reader read "El código no existe" and there
 * was nowhere to fix it. Both components below take the key and render `t(key)`; the words
 * are `cart.promotion.error.*` in `basket.ts`. Which of the six it was is still the part a
 * customer can act on, so `cart.promotion.invalid` is not used for any of them.
 *
 * `useApiFailure` remains for the other thing an attempt can produce — a request that never
 * arrived. A refused code is not that, and the two sentences sit next to each other on the
 * field with the refusal first, because it is what the last attempt actually got back.
 *
 * ## A code can be taken off now
 *
 * `cart.removePromotion` clears the code and leaves every line: before it existed the only
 * way to drop a coupon was `cart.clear`, which empties the basket, so a customer fixing a
 * typo in a code field had to delete everything they had chosen. The sheet's footer holds
 * the one action the sheet is for; the button that removes is in the body, beside the field
 * it is about.
 *
 * ## The two successes are announced, and the refusal is not
 *
 * Rule 5: a write is confirmed where it happened, through `./toast`. Both of these writes
 * succeed into a *cart* rather than into the control that caused them — the code is a row on
 * the cart screen, the discount is a line in the receipt above it, and neither is inside the
 * sheet that was open when the customer sent it — so the confirmation belongs to the screen
 * and lives in the hook that performs the writes, not in either component. A sheet may well
 * still be open when it fires, which is fine: `./toast` is mounted around the navigator rather
 * than inside a screen, so it draws after the screen that owns the sheet and the sentence is
 * on top of the panel rather than behind it (`./sheet` sets no `zIndex` and no `elevation` — it
 * is an `absoluteFill` host inside the screen — so there is no lift for it to hide behind).
 *
 * The predicate is the point, and it is not "no error was thrown". `applyPromotion` answers a
 * bad code with a **200 and a cart carrying `promotionError`** — a refusal is an answer, not a
 * failure — so `onSuccess` runs for refusals too, and a toast keyed on reaching `onSuccess`
 * would confirm a code the shop just refused. It is keyed on the answer's own field instead:
 * `promotionError === null` is exactly the state the server leaves a cart in when it took the
 * code (`services/cart.ts` writes `promotionCode` and returns the cart with no error), and the
 * `{code}` in the sentence is the server's stored, uppercased value rather than the draft the
 * customer typed. A refusal gets no toast at all: it has a sentence of its own, under the
 * field and in the row behind it, and a toast saying "that code did not work" next to the
 * sentence saying *why* would be the same news twice, the second time without the reason.
 */
export function usePromoCode() {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t } = useT();
	const { show } = useToast();

	/**
	 * The cart that comes back *is* the new state — every cart procedure answers with the
	 * whole cart — so a write's success is a cache write and not an invalidation. Used by
	 * both writes here for the same reason.
	 */
	const replaceCart = (cart: Cart) => {
		cache.setQueryData(trpc.cart.get.queryKey(undefined), cart);
	};

	const apply = useMutation(
		trpc.cart.applyPromotion.mutationOptions({
			// Not optimistic, and not rollback-able: whether a code is good is the server's
			// judgement, and a discount shown before it was granted would be a price the order
			// does not have.
			onSuccess: (cart) => {
				replaceCart(cart);
				// A refusal arrives here too — see the docblock — so the toast is keyed on the
				// answer's own field rather than on having reached this callback. `promotionCode`
				// is the second term because the sentence needs the code the *server* stored, and
				// it is the server's uppercase form rather than the customer's draft.
				if (!cart.promotionError && cart.promotionCode) {
					show(t("cart.promotion.applied", { code: cart.promotionCode }));
				}
			},
		}),
	);

	const remove = useMutation(
		trpc.cart.removePromotion.mutationOptions({
			// The discount leaves the totals in the same answer, so there is nothing to undo
			// and nothing to guess at while it is in flight.
			onSuccess: (cart) => {
				replaceCart(cart);
				// The answer is the evidence, exactly as above and from the other side: the removal
				// is confirmed when the cart comes back without a code, which is the state the toast
				// claims. A cart that still carries one — another device applied a code between the
				// tap and the answer — gets no toast rather than a sentence that contradicts the row
				// behind it.
				if (!cart.promotionCode) show(t("cart.promotion.removed"));
			},
		}),
	);

	return {
		/** Send a code. Clears any previous transport failure first, so a retry starts clean. */
		apply: (code: string) => {
			apply.reset();
			remove.reset();
			apply.mutate({ code });
		},
		/** The request is in flight. Drives a word — "Guardando…" — never a spinner here. */
		pending: apply.isPending,
		/** A request that did not arrive. A *refused* code is the cart's `promotionError`. */
		failure: apply.error,
		/** Take the code off the cart, keeping the lines. */
		remove: () => {
			apply.reset();
			remove.reset();
			remove.mutate();
		},
		/** The removal is in flight. Drives the same word the apply button uses. */
		removing: remove.isPending,
		/** A removal that did not arrive — a different failure from a refused code. */
		removeFailure: remove.error,
	};
}

/**
 * The receipt's promo line: "Código de descuento" with what happened to it underneath.
 *
 * A row rather than a field, because the code is not edited here — it is opened, in a sheet
 * with room for the keyboard and the reason that comes back. The line shows the *result*:
 * the applied code when one is on the cart, the refusal when the last attempt failed.
 *
 * The refusal wins over the applied sentence when both exist, which is the only ordering
 * that can be right: it is the newest thing the customer caused, and it is what the sheet
 * they just closed was about. It is *not* a claim that the discount is gone — since a
 * refused code no longer overwrites a working one, a cart can hold a code that works and a
 * refusal of a code that did not, and the discount is drawn in the receipt above this row.
 */
export function PromoInput({
	code,
	error,
	onPress,
}: {
	code?: string | null;
	/** The cart's `promotionError`: a key, rendered here — never a sentence from the API. */
	error?: MessageKey | null;
	onPress: () => void;
}) {
	const { t } = useT();
	const detail =
		(error ? t(error) : undefined) ??
		(code ? t("cart.promotion.applied", { code }) : undefined);

	return (
		<ListRow
			title={t("cart.promotion")}
			subtitle={detail}
			// The detail is the whole point of the row and a subtitle is not read as part of its
			// label, so it is joined here the way `./list-row` joins a state: name first, fact
			// after, comma between. Without it a reader hears "Código de descuento, botón" and
			// has no way to know whether the code on the cart worked.
			accessibilityLabel={
				detail ? `${t("cart.promotion")}, ${detail}` : undefined
			}
			onPress={onPress}
			chevron
		/>
	);
}

/** The API's own floor on a code — `applyPromotionInput` trims, then requires three. */
const MIN_CODE_LENGTH = 3;
/** The API's own ceiling. Longer than this and the server refuses it unread. */
const MAX_CODE_LENGTH = 40;

/**
 * The sheet the promo row opens.
 *
 * ## One snap point, full height
 *
 * `./sheet` resolves a fraction against the panel's own height —
 * `Math.max(0, height * (1 - fraction) - (height - panelHeight))` — so `[1]` is that
 * expression's zero: the panel rests exactly where `bottom: 0` draws it, top edge at
 * `height − panelHeight`. It is the value that means "one resting place, at the height the
 * content asks for", and this sheet is a field and a button, so a lower fraction would
 * resolve to the same 0 today and start pushing the panel down the moment its content grew
 * past that share of the screen — with the footer's action that far down and nothing to bring
 * it back. `./sheet`'s own docblock says a sheet *taller* than its snap point wants a taller
 * snap; this one is shorter, and `[1]` is what a content-height sheet asks for.
 *
 * This section used to argue the opposite, and the primitive changed under it: a fraction was
 * once `height * (1 - fraction)` flat, so a half point pushed a short panel half a screen
 * down — off the bottom — and `[1]` was the only value that left it on screen. That fix is in
 * `./sheet` now, with the old form and the arithmetic recorded there; the reason `[1]` is here
 * is no longer a workaround but this sheet's own shape.
 *
 * ## The button says what it is doing, in words
 *
 * Both writes on this sheet are in flight at some point, so both buttons are disabled while
 * theirs is and both change their label — but not to the same sentence. The primary button
 * carries `state.saving` ("Guardando…"), because applying a code is a save; the remove button
 * carries `cart.promotion.removing` ("Quitando…"), because taking a code off is the opposite of
 * saving one. It said `state.saving` too until that key landed, which put the wrong verb on the
 * one control that is mid-flight. The app's one spinner is a payment, and neither a code being
 * checked nor a code being removed is a payment, so the progress indication is the label — which
 * is also the only one a screen reader gets for free, because a changed label is re-announced.
 *
 * The primary button is disabled until the code could possibly be accepted — three characters,
 * trimmed, the API's own rule — so the first thing a customer sees is not a button that
 * fails. It is *not* disabled for any other reason: what a code is worth and whether it is
 * still valid are the server's answers, and a client that guessed at them would be a client
 * that refuses a code the shop would have honoured.
 */
export function PromoSheet({
	open,
	onClose,
	code,
	error,
	pending,
	failure,
	removing,
	onApply,
	onRemove,
}: {
	open: boolean;
	onClose: () => void;
	/**
	 * The code currently on the cart, if any — read *once*, when the sheet mounts, which is
	 * what makes it the starting point of the field rather than a value that chases what is
	 * being typed. The draft's docblock below has both cases.
	 */
	code?: string | null;
	/** The cart's `promotionError`, as a key. See `PromoInput`. */
	error?: MessageKey | null;
	pending: boolean;
	/** A request that did not arrive; distinct from a code that was refused. */
	failure: unknown;
	/** A removal is in flight. Drives the label of the button that removes. */
	removing: boolean;
	onApply: (code: string) => void;
	/** Take the code off the cart. Hidden, not disabled, when there is no code. */
	onRemove: () => void;
}) {
	const { t } = useT();
	const { message } = useApiFailure(failure);

	/**
	 * The draft, and the two cases it has to get right.
	 *
	 * The field is a draft of the code on the cart, so re-opening the sheet shows what is
	 * actually *there* rather than the last thing that was typed and abandoned — and while the
	 * customer is typing, the code arriving from outside is ignored. Both halves matter,
	 * because the cart query polls every 15 seconds and a code set on another device lands on
	 * that poll. Re-seed the draft then and the customer watches a stranger's code replace the
	 * one under their cursor.
	 *
	 * `useState(code ?? "")` runs when this component mounts and never again, which is exactly
	 * re-seed-on-open and never-while-typing — provided the mount is a *fresh* one per opening.
	 * That is the caller's job: `app/cart.tsx` passes a `key` that changes on open, and its
	 * docblock has the arithmetic. The effect that used to live here depended on `[open, code]`,
	 * so it was the second case it got wrong: any change to `code` while the sheet was open,
	 * including its own poll, overwrote the draft mid-keystroke.
	 */
	const [text, setText] = useState(code ?? "");
	const trimmed = text.trim();

	function submit() {
		if (pending || trimmed.length < MIN_CODE_LENGTH) return;
		onApply(trimmed);
	}

	return (
		<Sheet
			open={open}
			onClose={onClose}
			closeLabel={t("action.close")}
			// `[1]`, for the section above: the fraction that resolves to no translation on a
			// panel shorter than the screen. Not because the form is tall — it is two controls.
			snapPoints={[1]}
			avoidKeyboard
			footer={
				// An `ActionBar` as the sheet's footer, which is what `./sheet`'s own docblock asks
				// for: the footer slot has no horizontal padding and no bottom inset, and the bar
				// carries both — so the button lands on the same line as every other primary
				// action in the app, including over the home indicator.
				<ActionBar
					docked
					primary={{
						label: pending
							? t("state.saving")
							: code
								? t("cart.promotion.change")
								: t("cart.promotion.apply"),
						onPress: submit,
						disabled: trimmed.length < MIN_CODE_LENGTH || pending,
					}}
				/>
			}
		>
			<View style={styles.body}>
				<Field
					label={t("cart.promotion")}
					value={text}
					onChangeText={setText}
					// Codes are printed in capitals and read back by a person; the API uppercases
					// them itself, so this is only the keyboard agreeing with the server.
					autoCapitalize="characters"
					autoCorrect={false}
					returnKeyType="done"
					onSubmitEditing={submit}
					maxLength={MAX_CODE_LENGTH}
					// A refusal and a failed request are two sentences saying two different things —
					// "this code is not valid" versus "we could not reach the shop" — and the error
					// slot is where both belong, with the refusal first because it is what the last
					// attempt actually got back. The refusal is a key; `t` is applied here, at the
					// one place the sentence is drawn.
					error={error ? t(error) : failure ? message : undefined}
					help={
						code && !error ? t("cart.promotion.applied", { code }) : undefined
					}
				/>

				{/* A control, not a footnote: `cart.removePromotion` is the API's, and this is the
				    only place in the app that offers it. `ghost` because it is the way out of the
				    sheet rather than the thing the sheet is for, and the label changes while the
				    request is in flight — the same progress indication the primary button gives. */}
				{code ? (
					<Button
						label={
							removing
								? t("cart.promotion.removing")
								: t("cart.promotion.remove")
						}
						variant="ghost"
						onPress={onRemove}
						disabled={removing || pending}
					/>
				) : null}
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	// The field and the button that removes it are one form, so they are one block with one gap.
	body: { gap: space.md },
});
