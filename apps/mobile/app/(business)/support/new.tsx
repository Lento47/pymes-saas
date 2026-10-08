import { TICKET_CATEGORY } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";

/**
 * Opening a ticket.
 *
 * ## The ceilings are the contract's, not this screen's
 *
 * `supportTicketCreateInput` bounds `subject` at 120 and `body` at 2000. They are declared
 * here rather than read from the schema because a Zod bound is not a `maxLength` prop, and a
 * field with `maxLength` is one the phone enforces before the request is made — the reader
 * sees the count stop rather than discovering the ceiling from a rejection. Both come from
 * `SCHEMA_MAX_*` below, and `Field`'s `counter` draws them off the same numbers, so the
 * counter and the limit cannot disagree.
 *
 * The server still validates. This is not a trust boundary, it is a courtesy.
 */
const SUBJECT_MAX = 120;
const BODY_MAX = 2000;

/**
 * A merchant asking for help.
 *
 * ## Why this is its own route and not a sheet on the desk
 *
 * A sheet over a list is right when the thing being made is small and the list behind it is
 * worth keeping in view. A ticket is three fields and a decision, but it is also the act that
 * commits the merchant to waiting for an answer — and it deserves a screen with its own
 * heading, because "escribiendo" and "enviando" are different states and a reader who cannot
 * see which one they are in cannot tell whether pressing twice files two tickets.
 *
 * ## Why the category is a segmented control and not a menu
 *
 * Five values, all one or two words, and the desk triages on exactly this field
 * (`supportTicketSchema` calls it "the one field a support desk triages on"). `Segmented` is
 * a `radiogroup` to a screen reader, which is the correct role for one-of-N; a picker button
 * opening a sheet would be a menu, which is a different promise and hides the choice behind
 * a second tap.
 */
export default function NewSupportTicket() {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const { t } = useT();
	const scope = useMerchantScope();

	/**
	 * The shop, resolved the way `shop-location.tsx` and `merchant-management-frame.tsx` both
	 * resolve it: the merchant's chosen branch, else the first shop they own.
	 *
	 * `scope.businessId` is optional by type, so it is a *preference* and not the answer. The
	 * `""` fallback is what every screen downstream of here has to survive, and this one
	 * refuses to submit rather than sending a request the middleware will reject.
	 */
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const owned = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		owned.find((one) => one.businessId === scope.businessId) ?? owned[0];
	const businessId = shop?.businessId ?? "";

	const [category, setCategory] = useState<string>(TICKET_CATEGORY[0]);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);

	/**
	 * Trimmed before measuring, because the contract trims too
	 * (`supportTicketCreateInput` is `.trim().min(1)`). A subject of three spaces is one the
	 * server refuses, and a reader who typed it deserves to be told at the field rather than
	 * by a rejection that names no field.
	 */
	const subjectError =
		subject.trim().length === 0
			? t("biz.support.subjectRequired")
			: subject.length > SUBJECT_MAX
				? t("biz.support.subjectTooLong")
				: null;
	const bodyError =
		body.trim().length === 0
			? t("biz.support.bodyRequired")
			: body.length > BODY_MAX
				? t("biz.support.bodyTooLong")
				: null;

	const create = useMutation(trpc.support.create.mutationOptions());

	const submit = () => {
		if (create.isPending || !businessId || subjectError || bodyError) return;
		setSaving(true);
		create.mutate(
			{
				businessId,
				category: category as (typeof TICKET_CATEGORY)[number],
				subject: subject.trim(),
				body: body.trim(),
			},
			{
				onSuccess: async (created) => {
					setSaving(false);
					toast.show(t("biz.support.submit"));
					await cache.invalidateQueries({
						queryKey: trpc.support.pathKey(),
					});
					// Straight to the ticket rather than back to the desk: the merchant just
					// asked something, and the screen that answers whether anyone has seen it
					// is the thread. `replace` and not `push`, so Back from there returns to
					// the desk instead of to a form already sent.
					router.replace(`/(business)/support/${created.id}`);
				},
				onError: () => setSaving(false),
			},
		);
	};

	const failed = shops.error ?? create.error;

	return (
		<View style={{ flex: 1 }}>
			<Screen
				title={t("biz.support.newTitle")}
				leading={<BackButton to="/(business)/support" surface />}
				scroll
			>
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void shops.refetch();
							create.reset();
						}}
					/>
				) : (
					<>
						<ScreenSection title={t("biz.support.category")}>
							<Segmented
								label={t("biz.support.category")}
								options={TICKET_CATEGORY.map((one) => ({
									value: one,
									label: t(`biz.support.category.${one}`),
								}))}
								value={category}
								onChange={setCategory}
							/>
						</ScreenSection>

						<ScreenSection title={t("biz.support.subject")}>
							<Field
								label={t("biz.support.subject")}
								value={subject}
								onChangeText={setSubject}
								maxLength={SUBJECT_MAX}
								counter
								help={t("biz.support.subjectHelp")}
								error={subjectError}
								autoCapitalize="sentences"
								returnKeyType="next"
							/>
						</ScreenSection>

						<ScreenSection title={t("biz.support.body")}>
							<Field
								label={t("biz.support.body")}
								value={body}
								onChangeText={setBody}
								maxLength={BODY_MAX}
								counter
								multiline
								numberOfLines={6}
								help={t("biz.support.bodyHelp")}
								error={bodyError}
								autoCapitalize="sentences"
							/>
						</ScreenSection>
					</>
				)}
			</Screen>

			{!failed && shop ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.support.submit"),
						onPress: submit,
						loading: saving,
						disabled: saving || !subjectError || !bodyError,
					}}
				/>
			) : null}
		</View>
	);
}
