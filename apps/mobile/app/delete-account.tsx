import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { ErrorState } from "@/components/error-state";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

export default function DeleteAccountScreen() {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const query = useQuery(trpc.users.deletionStatus.queryOptions());
	const request = useMutation(
		trpc.users.requestDeletion.mutationOptions({
			onSuccess: () =>
				cache.invalidateQueries({ queryKey: trpc.users.pathKey() }),
		}),
	);
	const cancel = useMutation(
		trpc.users.cancelDeletion.mutationOptions({
			onSuccess: () =>
				cache.invalidateQueries({ queryKey: trpc.users.pathKey() }),
		}),
	);

	const pending = request.isPending || cancel.isPending;
	const failure = request.error ?? cancel.error;
	const scheduled = query.data;

	return (
		<>
			<Screen
				title={t("account.deletion.title")}
				scroll
				contentStyle={styles.gap}
			>
				<SignedIn>
					{query.isPending ? (
						<Spinner label={t("state.loading")} centered />
					) : query.isError ? (
						<ErrorState
							error={query.error}
							onRetry={() => void query.refetch()}
						/>
					) : (
						<>
							<Card>
								<View style={styles.copy}>
									<Text variant="body" bold>
										{t(
											scheduled
												? "account.deletion.scheduled"
												: "account.deletion.heading",
										)}
									</Text>
									<Text variant="body" tone="muted">
										{scheduled
											? t("account.deletion.scheduledBody", {
													date: new Intl.DateTimeFormat(intlLocale, {
														dateStyle: "long",
													}).format(scheduled.scheduledFor),
												})
											: t("account.deletion.body")}
									</Text>
								</View>
							</Card>

							{failure ? <ErrorState error={failure} /> : null}

							<Button
								label={t(
									scheduled
										? "account.deletion.cancel"
										: "account.deletion.request",
								)}
								variant={scheduled ? "secondary" : "destructive"}
								loading={pending}
								disabled={pending}
								fullWidth
								onPress={() => {
									if (scheduled) cancel.mutate();
									else setConfirming(true);
								}}
							/>
						</>
					)}
				</SignedIn>
			</Screen>
			<ConfirmSheet
				open={confirming}
				onClose={() => setConfirming(false)}
				title={t("account.deletion.confirm")}
				body={t("account.deletion.confirmBody")}
				confirmLabel={t("account.deletion.request")}
				onConfirm={() => request.mutate()}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	gap: { gap: space.lg },
	copy: { gap: space.sm },
});
