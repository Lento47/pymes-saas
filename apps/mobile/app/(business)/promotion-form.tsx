import {
	type Currency,
	currencyExponent,
	formatMoney,
	type PromotionDetail,
	type PromotionKind,
	parseMoney,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";

import { ActionBar, useActionBarClearance } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * One code: "add" and "edit" are the same screen, told apart by `id` in the route.
 *
 * interface.md §39 puts "Create promotion" in the **full-screen** tier rather than in a
 * sheet — a form with a kind, a value and two optional limits is a workflow, and the
 * small-sheet tier is for choosing one thing. So this is a pushed route with its own
 * title and its own `ActionBar`, the same shape as `./product-form`.
 *
 * ## Five things written, and two that are not
 *
 * The form writes **code, kind, value, a minimum order and a maximum number of uses** —
 * the whole of `promotionFields` except the two date columns.
 *
 * - **`startsAt` / `endsAt` are never written here, and the form does not show them.**
 *   There is no date picker in `apps/mobile/package.json` and inventing one for this
 *   form is not worth the dependency. A code created here is open-ended (both columns
 *   null) and a code that already has a window keeps it on edit — which is the one
 *   consequence worth stating out loud, because the window is then invisible to the
 *   person editing the code. `packages/shared/src/schemas/promotions.ts` and
 *   `services/promotions.ts` already carry both fields, so whoever adds the picker adds
 *   two `Field`s here and nothing else.
 * - **`isActive` is not a field.** Opening and closing a live code is
 *   `promotions.setActive`'s own procedure and `./(business)/promotions` is the screen
 *   that calls it — a form saving a typo must not be able to pause a code people are
 *   holding in a cart.
 *
 * ## `value` is typed in the kind's own unit, and stored that way
 *
 * `PERCENT` is a whole percent and `FIXED` is minor units of the shop's currency
 * (`packages/db/src/schema.ts`'s own comment on the column). So the box under
 * "Porcentaje" takes `15` and the box under "Monto fijo" takes `1.500`, which
 * `parseMoney` reads as fifteen hundred colones. The two are not normalised into one
 * unit here for the same reason the schema does not: a client that multiplied a percent
 * by a subtotal it does not have would be inventing an amount the shop never agreed to.
 *
 * The money boxes pre-fill with `editableOf` rather than `formatMoney`, the decision
 * `./product-form` documents at length — a currency symbol in front of what the owner
 * is editing is a character `parseMoney` then has to strip.
 *
 * Because the unit belongs to the kind, changing the kind empties the box: `1.500`
 * colones and `1.500` percent are not the same number wearing two hats, and carrying
 * the digits across would be a discount the owner did not type.
 *
 * ## The rules are checked here first
 *
 * `promotionCreateInput` refines the same two checks and the sentences under the boxes
 * are the ones its `message`s are written for, so the refusal arrives before the round
 * trip instead of as a red line at the top of a form that has to be read back to find
 * the offending box. The one refusal this form cannot make for itself — a code this
 * shop already opened — lands on the code box rather than in the banner, because the
 * API says *which* field it refused (`details.field`) and a sentence under the box that
 * owns the problem is worth more than one above a form the reader then has to search.
 */
export default function MerchantPromotionForm() {
	const { t } = useT();
	const trpc = useTRPC();
	const scope = useMerchantScope();
	const params = useLocalSearchParams<{ id?: string }>();
	const promotionId = typeof params.id === "string" ? params.id : undefined;

	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";

	// The currency's two sources, the same split `./product-form` draws: an "add" has no
	// code to carry one yet, while an "edit" takes it from the code — the shop's currency
	// is fixed at creation and the two cannot disagree.
	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId },
			{ enabled: !!businessId && promotionId === undefined },
		),
	);
	const detail = useQuery(
		trpc.promotions.detail.queryOptions(
			{ businessId, id: promotionId ?? "" },
			{ enabled: !!businessId && promotionId !== undefined },
		),
	);

	const currency =
		promotionId === undefined ? settings.data?.currency : detail.data?.currency;

	const title =
		promotionId === undefined
			? t("biz.promotions.add")
			: t("biz.promotions.edit");
	const leading = <BackButton to="/(business)/promotions" />;

	const failed = shops.error ?? settings.error ?? detail.error;
	if (failed) {
		return (
			<Screen title={title} leading={leading}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void settings.refetch();
						void detail.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (
		shops.isPending ||
		!businessId ||
		!currency ||
		(promotionId !== undefined && detail.isPending)
	) {
		return (
			<Screen title={title} leading={leading}>
				<Text>{t("state.loading")}</Text>
			</Screen>
		);
	}

	// `initial` is a new object every render and `Fields` reads it exactly once. The point
	// is the split itself: a refetch landing mid-form must not put fresh digits into boxes
	// the owner is already typing in, and the only way to guarantee that is for the draft
	// to be born after the reads have settled and never be replaced.
	return (
		<Fields
			businessId={businessId}
			promotionId={promotionId}
			currency={currency}
			initial={draftOf(
				promotionId === undefined ? null : (detail.data ?? null),
				currency,
			)}
		/>
	);
}

type Draft = {
	code: string;
	kind: PromotionKind;
	/** Percent digits for `PERCENT`, major-unit money for `FIXED`, empty for `FREE_DELIVERY`. */
	value: string;
	minOrder: string;
	maxRedemptions: string;
};

function Fields({
	businessId,
	promotionId,
	currency,
	initial,
}: {
	businessId: string;
	promotionId?: string;
	currency: Currency;
	initial: Draft;
}) {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const bar = useActionBarClearance();

	const [draft, setDraft] = useState(initial);
	const [submitted, setSubmitted] = useState(false);
	// A guard rather than a disabled button alone: two taps inside one frame both pass an
	// `isPending` check that has not re-rendered yet, and a second code is a row the owner
	// then has to find and close. Reset on settle so a refusal leaves the form usable.
	const inFlight = useRef(false);

	const code = draft.code.trim();
	const codeUpper = code.toUpperCase();
	const valueText = draft.value.trim();
	const minOrderBlank = draft.minOrder.trim() === "";
	const minOrderMinor = minOrderBlank
		? null
		: parseMoney(draft.minOrder, currency);
	const maxBlank = draft.maxRedemptions.trim() === "";
	const maxParsed = maxBlank ? null : Number(draft.maxRedemptions.trim());

	const done = (message: string) => {
		// Both reads, through the router's own key: the list is one of them and the code
		// the form just wrote is the other, and `promotions` is small enough that naming
		// the two separately would be naming the same subtree twice.
		void cache.invalidateQueries({ queryKey: trpc.promotions.pathKey() });
		toast.show(message);
		router.back();
	};

	const create = useMutation(
		trpc.promotions.create.mutationOptions({
			onSuccess: () => done(t("biz.promotions.created")),
			onError: () => warning(),
		}),
	);

	const update = useMutation(
		trpc.promotions.update.mutationOptions({
			onSuccess: () => done(t("biz.promotions.saved")),
			onError: () => warning(),
		}),
	);

	const failure = useApiFailure(create.error ?? update.error);
	const pending = create.isPending || update.isPending;
	const refusedField = refusedFieldOf(create.error ?? update.error);

	const problems = useMemo(() => {
		const found: Partial<Record<keyof Draft, string>> = {};
		if (code.length < 3) {
			found.code = t("biz.promotions.code.required");
		} else if (refusedField === "code") {
			// The one refusal this form cannot make for itself: one code per shop. It is
			// shown on the box rather than in the banner, and `edited` below clears it on
			// the first keystroke by resetting the mutation.
			found.code = t("biz.promotions.code.taken");
		}

		if (draft.kind === "PERCENT") {
			const asNumber = Number(valueText);
			if (!Number.isInteger(asNumber) || asNumber < 1 || asNumber > 100) {
				found.value = t("biz.promotions.value.percent.rule");
			}
		} else if (draft.kind === "FIXED") {
			const minor = parseMoney(valueText, currency);
			if (minor === null || minor < 1) {
				found.value = t("biz.promotions.value.fixed.rule");
			}
		}

		if (!minOrderBlank && minOrderMinor === null) {
			found.minOrder = t("biz.promotions.number.rule");
		}
		if (
			!maxBlank &&
			(maxParsed === null || !Number.isInteger(maxParsed) || maxParsed < 1)
		) {
			found.maxRedemptions = t("biz.promotions.number.rule");
		}
		return found;
	}, [
		code,
		refusedField,
		draft.kind,
		valueText,
		minOrderBlank,
		minOrderMinor,
		maxBlank,
		maxParsed,
		currency,
		t,
	]);

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone, so the assertion on the
	 * failure line below is the whole of Android's announcement and iOS, which ignores the
	 * prop, has to be told. Guarded by the platform rather than announced on both: a
	 * sentence a live region has already spoken is not read twice, it is read as two
	 * sentences.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !failure.message) return;
		AccessibilityInfo.announceForAccessibility(failure.message);
	}, [failure.message]);

	const edited = (apply: () => void) => {
		apply();
		if (create.isError || create.isSuccess) create.reset();
		if (update.isError || update.isSuccess) update.reset();
	};

	const submit = () => {
		if (inFlight.current) return;
		setSubmitted(true);
		if (Object.keys(problems).length > 0) return;
		inFlight.current = true;

		const terms = {
			businessId,
			// Uppercased here as well as in `promotionCodeSchema`, idempotently: the cart
			// looks a typed code up with an exact match, so what is written has to be what
			// it can produce. The schema's transform agrees and would not change it.
			code: codeUpper,
			kind: draft.kind,
			value: storedValueOf(draft.kind, valueText, currency),
			// `null` is a write, not an omission — `services/promotions.ts`'s `assign`
			// skips `undefined` and copies a `null` it was given, which is the difference
			// between "any order" and "leave the stored minimum alone".
			minOrderMinor,
			maxRedemptions: maxBlank ? null : maxParsed,
		};

		if (promotionId === undefined) {
			create.mutate(terms, { onSettled: () => (inFlight.current = false) });
		} else {
			update.mutate(
				{ ...terms, id: promotionId },
				{ onSettled: () => (inFlight.current = false) },
			);
		}
	};

	const showBanner = failure.message !== "" && refusedField === null;

	return (
		<>
			<Screen
				title={
					promotionId === undefined
						? t("biz.promotions.add")
						: t("biz.promotions.edit")
				}
				leading={<BackButton to="/(business)/promotions" />}
				scroll
				keyboardInsets
				contentStyle={{ paddingBottom: bar.clearance }}
			>
				<AnimateIn index={0}>
					<View style={styles.content}>
						<Field
							label={t("biz.promotions.code")}
							value={draft.code}
							onChangeText={(next) =>
								edited(() => setDraft((was) => ({ ...was, code: next })))
							}
							error={submitted ? (problems.code ?? null) : null}
							help={t("biz.promotions.code.help")}
							autoCapitalize="characters"
							autoCorrect={false}
							maxLength={40}
						/>

						{/* The kind's own visible name, drawn the way `./field` draws its
						    label: `./segmented` is named for a screen reader through `label`
						    and a name that only exists in that tree is invisible to the
						    person who cannot see the control. */}
						<View style={styles.group}>
							<Text variant="label" bold>
								{t("biz.promotions.kind")}
							</Text>
							<Segmented
								label={t("biz.promotions.kind")}
								value={draft.kind}
								// The box empties with the kind: the two units are not the same
								// number wearing two hats, and carrying the digits across would
								// be a discount the owner did not type.
								onChange={(next) =>
									edited(() =>
										setDraft((was) => ({
											...was,
											kind: next as PromotionKind,
											value: "",
										})),
									)
								}
								options={[
									{
										value: "PERCENT",
										label: t("biz.promotions.kind.PERCENT"),
									},
									{ value: "FIXED", label: t("biz.promotions.kind.FIXED") },
									{
										value: "FREE_DELIVERY",
										label: t("biz.promotions.kind.FREE_DELIVERY"),
									},
								]}
							/>
						</View>

						{/* Hidden rather than disabled when the kind has no number to give:
						    a box that cannot be filled is a question the form should not ask. */}
						{draft.kind !== "FREE_DELIVERY" ? (
							<Field
								label={t("biz.promotions.value")}
								value={draft.value}
								onChangeText={(next) =>
									edited(() => setDraft((was) => ({ ...was, value: next })))
								}
								error={submitted ? (problems.value ?? null) : null}
								help={
									draft.kind === "PERCENT"
										? t("biz.promotions.value.percent")
										: parseMoney(valueText, currency) === null
											? t("biz.promotions.value.fixed")
											: formatMoney(
													parseMoney(valueText, currency) as number,
													currency,
													{ locale: intlLocale },
												)
								}
								keyboardType={
									draft.kind === "PERCENT" ? "number-pad" : "decimal-pad"
								}
								inputMode={draft.kind === "PERCENT" ? "numeric" : "decimal"}
							/>
						) : null}

						<Field
							label={t("biz.promotions.minOrder")}
							value={draft.minOrder}
							onChangeText={(next) =>
								edited(() => setDraft((was) => ({ ...was, minOrder: next })))
							}
							error={submitted ? (problems.minOrder ?? null) : null}
							help={
								minOrderMinor === null
									? t("biz.promotions.minOrder.help")
									: formatMoney(minOrderMinor, currency, {
											locale: intlLocale,
										})
							}
							keyboardType="decimal-pad"
							inputMode="decimal"
						/>

						<Field
							label={t("biz.promotions.maxRedemptions")}
							value={draft.maxRedemptions}
							onChangeText={(next) =>
								edited(() =>
									setDraft((was) => ({ ...was, maxRedemptions: next })),
								)
							}
							error={submitted ? (problems.maxRedemptions ?? null) : null}
							help={t("biz.promotions.maxRedemptions.help")}
							keyboardType="number-pad"
							inputMode="numeric"
						/>
					</View>
				</AnimateIn>

				{showBanner ? (
					<View style={styles.failure}>
						<Text
							variant="body"
							tone="destructive"
							accessibilityRole="alert"
							accessibilityLiveRegion="polite"
						>
							{failure.message}
						</Text>
						{failure.supportLine ? (
							<Text variant="caption" tone="muted">
								{failure.supportLine}
							</Text>
						) : null}
					</View>
				) : null}
			</Screen>
			{/* A sibling of `</Screen>` rather than a child of it: a docked bar is a footer,
			    and a footer inside a scroller scrolls away — see `./action-bar`. */}
			<ActionBar
				docked
				onHeightChange={bar.onHeightChange}
				primary={{
					label: t("biz.settings.save"),
					onPress: submit,
					loading: pending,
					disabled: pending,
				}}
			/>
		</>
	);
}

/**
 * What the API refused, when it named the box that owns the problem.
 *
 * `ValidationError` puts the field on `details`, which is what that slot is for — "which
 * field failed, what the minimum is". A refusal that names a field is the form's to
 * place; a refusal that does not is the banner's. Returning `null` for both "no error"
 * and "no field named" is deliberate: the banner is the fallback either way.
 */
function refusedFieldOf(error: unknown): string | null {
	if (!error) return null;
	const details = (error as { data?: { details?: unknown } }).data?.details;
	const field = (details as { field?: unknown } | null)?.field;
	return typeof field === "string" && field.length > 0 ? field : null;
}

/**
 * The discount, in the unit the kind names — and zero for the kind that has none.
 *
 * `FREE_DELIVERY` is zero rather than a hole because the column is an integer and the
 * delivery fee is decided at checkout from the fulfilment mode; `valueFitsKind` accepts
 * anything there for the same reason.
 */
function storedValueOf(
	kind: PromotionKind,
	valueText: string,
	currency: Currency,
): number {
	if (kind === "PERCENT") return Number(valueText);
	if (kind === "FIXED") return parseMoney(valueText, currency) ?? 0;
	return 0;
}

/**
 * How a stored amount is spelled back into an editable box.
 *
 * Not `formatMoney`: a currency symbol in front of what the owner is editing is a
 * character `parseMoney` then has to strip, and the same decision is documented at
 * length in `./product-form`.
 */
function editableOf(amountMinor: number, currency: Currency): string {
	return String(amountMinor / 10 ** currencyExponent(currency));
}

function draftOf(detail: PromotionDetail | null, currency: Currency): Draft {
	if (detail === null) {
		// `PERCENT` is the kind most codes are, and it is the one whose box is a whole
		// number — the easiest thing to type into a form that just opened.
		return {
			code: "",
			kind: "PERCENT",
			value: "",
			minOrder: "",
			maxRedemptions: "",
		};
	}
	return {
		code: detail.code,
		kind: detail.kind,
		value:
			detail.kind === "PERCENT"
				? String(detail.value)
				: detail.kind === "FIXED"
					? editableOf(detail.value, currency)
					: "",
		minOrder:
			detail.minOrderMinor === null
				? ""
				: editableOf(detail.minOrderMinor, currency),
		maxRedemptions:
			detail.maxRedemptions === null ? "" : String(detail.maxRedemptions),
	};
}

const styles = StyleSheet.create({
	content: { gap: space.lg },
	// `./field`'s own `wrap` gap: the name of a control, then the control.
	group: { gap: space.sm },
	failure: { marginTop: space.lg, gap: space.sm },
});
