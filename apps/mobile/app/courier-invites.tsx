import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { setAccountProfile } from "@/lib/device-prefs";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

export default function CourierInvitesScreen() {
	const { t } = useT();
	return (
		<Screen
			title={t("biz.courier.invitesTitle")}
			subtitle={t("biz.courier.invitesSubtitle")}
			scroll
			contentStyle={styles.content}
		>
			<SignedIn>
				<Invites />
			</SignedIn>
		</Screen>
	);
}

function Invites() {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const { status } = useSession();
	const [busyId, setBusyId] = useState<string | null>(null);
	const invites = useQuery(trpc.couriers.myInvites.queryOptions());
	const respond = useMutation(
		trpc.couriers.respond.mutationOptions({
			onSuccess: async (invite) => {
				setBusyId(null);
				await cache.invalidateQueries({
					queryKey: trpc.couriers.pathKey(),
				});
				if (invite.status === "ACCEPTED") {
					await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
					await cache.invalidateQueries({ queryKey: trpc.business.pathKey() });
					await setAccountProfile("delivery");
					toast.show(t("biz.courier.invite.accepted"));
					router.replace("/(delivery)");
				} else {
					toast.show(t("biz.courier.invite.declined"));
				}
			},
			onError: () => setBusyId(null),
		}),
	);
	const failure = useApiFailure(respond.error);
	const waiting = useSkeletonHold(status === "loading" || invites.isPending);

	if (waiting) {
		return (
			<View style={styles.list}>
				<Skeleton style={styles.card} />
				<Skeleton style={styles.card} />
			</View>
		);
	}
	if (invites.isError) {
		return (
			<ErrorState error={invites.error} onRetry={() => invites.refetch()} />
		);
	}

	const rows = invites.data ?? [];
	const pending = rows.filter((invite) => invite.status === "PENDING");
	if (rows.length === 0) {
		return (
			<EmptyState
				icon="mail-outline"
				title={t("biz.courier.invites.empty.title")}
				body={t("biz.courier.invites.empty.body")}
			/>
		);
	}

	return (
		<View style={styles.content}>
			{pending.length === 0 ? (
				<Text tone="muted">{t("biz.courier.noPendingInvites")}</Text>
			) : null}
			{rows.map((invite) => {
				const isPending = invite.status === "PENDING";
				const busy = busyId === invite.id;
				return (
					<Card key={invite.id} style={styles.card}>
						<ListRow
							title={invite.businessName}
							subtitle={t("biz.courier.invite.pending")}
							state={t(
								isPending
									? "biz.courier.invite.pending"
									: invite.status === "ACCEPTED"
										? "biz.courier.invite.accepted"
										: invite.status === "DECLINED"
											? "biz.courier.invite.declined"
											: "biz.courier.invite.expired",
							)}
							divider={isPending}
						/>
						{isPending ? (
							<View style={styles.actions}>
								<Button
									label={t("biz.courier.invite.decline")}
									variant="ghost"
									size="sm"
									disabled={busy}
									onPress={() => {
										setBusyId(invite.id);
										respond.mutate({
											inviteId: invite.id,
											response: "DECLINED",
										});
									}}
								/>
								<Button
									label={t("biz.courier.invite.accept")}
									size="sm"
									loading={busy}
									disabled={busy}
									onPress={() => {
										setBusyId(invite.id);
										respond.mutate({
											inviteId: invite.id,
											response: "ACCEPTED",
										});
									}}
								/>
							</View>
						) : null}
					</Card>
				);
			})}
			{failure.message ? (
				<Text tone="destructive" accessibilityRole="alert">
					{failure.message}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	content: { gap: space.md },
	list: { gap: space.md },
	card: { gap: space.sm },
	actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
});
