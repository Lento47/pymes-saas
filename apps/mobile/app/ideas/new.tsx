import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";

/**
 * Sending an idea.
 *
 * The ceilings are the contract's: `ideaCreateInput` bounds `subject` at 120 and
 * `body` at 2000. `Field`'s `maxLength` enforces them before the request is made.
 */
const SUBJECT_MAX = 120;
const BODY_MAX = 2000;

export default function NewIdea() {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const { t } = useT();

	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);

	const subjectError =
		subject.trim().length === 0
			? t("ideas.subjectRequired")
			: subject.length > SUBJECT_MAX
				? t("ideas.subjectTooLong")
				: null;
	const bodyError =
		body.trim().length === 0
			? t("ideas.bodyRequired")
			: body.length > BODY_MAX
				? t("ideas.bodyTooLong")
				: null;

	const create = useMutation(trpc.idea.create.mutationOptions());

	const submit = () => {
		if (create.isPending || subjectError || bodyError) return;
		setSaving(true);
		create.mutate(
			{
				subject: subject.trim(),
				body: body.trim(),
			},
			{
				onSuccess: async () => {
					setSaving(false);
					toast.show(t("ideas.submitDone"));
					await cache.invalidateQueries({ queryKey: trpc.idea.pathKey() });
					router.replace("/ideas");
				},
				onError: () => setSaving(false),
			},
		);
	};

	return (
		<View style={{ flex: 1 }}>
			<Screen
				title={t("ideas.newTitle")}
				leading={<BackButton to="/ideas" />}
				scroll
			>
				{create.error ? (
					<ErrorState error={create.error} onRetry={() => create.reset()} />
				) : (
					<>
						<ScreenSection title={t("ideas.subject")}>
							<Field
								label={t("ideas.subject")}
								value={subject}
								onChangeText={setSubject}
								maxLength={SUBJECT_MAX}
								counter
								help={t("ideas.subjectHelp")}
								error={subjectError}
								autoCapitalize="sentences"
								returnKeyType="next"
							/>
						</ScreenSection>
						<ScreenSection title={t("ideas.body")}>
							<Field
								label={t("ideas.body")}
								value={body}
								onChangeText={setBody}
								maxLength={BODY_MAX}
								counter
								multiline
								numberOfLines={6}
								help={t("ideas.bodyHelp")}
								error={bodyError}
								autoCapitalize="sentences"
							/>
						</ScreenSection>
					</>
				)}
			</Screen>
			{!create.error ? (
				<ActionBar
					docked
					primary={{
						label: t("ideas.submit"),
						onPress: submit,
						loading: saving,
						disabled: saving || subjectError !== null || bodyError !== null,
					}}
				/>
			) : null}
		</View>
	);
}
