import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import {
	ManagementEmpty,
	ManagementSection,
	managementRowStyle,
} from "@/components/merchant-management-ui";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * The contract's ceiling for a reply, which is the same 2000 a new ticket's body carries.
 *
 * `supportTicketReplyInput` bounds `body` at 2000, and `Field`'s `maxLength` is what makes
 * the counter and the limit the same number: the phone refuses the keystroke, so the
 * "too long" branch below is unreachable and is deliberately not written.
 */
const BODY_MAX = 2000;

/**
 * One ticket, its thread, and the two things a merchant can do about it.
 *
 * ## Why answering can empty the desk, and why the screen says so
 *
 * `support.reply` reopens. `services/support.ts` reads `reopening = ticket.resolvedAt !==
 * null` and, when that holds, writes `status: "OPEN"` and clears `resolvedAt` in the same
 * batch as the new message. It is deliberate — a merchant whose last word on a closed
 * question has gone unanswered has asked something nobody will read.
 *
 * The cost lands here: the desk lists `OPEN` and `WAITING`, so replying to a resolved ticket
 * takes it **off that list**. A reply box that silently empties the queue is the worst
 * possible reading of "sent", so a terminal ticket carries `biz.support.terminalNotice`
 * above the box, naming the state and saying that replying brings it back. Nothing is being
 * asked of the merchant; they are being told what the button will do.
 *
 * ## Why the waiting toggle is absent on a terminal ticket
 *
 * `setWaiting` returns early for `RESOLVED` and `CLOSED` (`services/support.ts:309`) — a
 * no-op, not an error. A control that takes a tap and changes nothing is worse than an
 * absent one, so it is not drawn. The reply box stays, because replying is still the way
 * back.
 */
export default function SupportTicketDetail() {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t } = useT();
	const scope = useMerchantScope();
	const { ticketId } = useLocalSearchParams<{ ticketId: string }>();

	/**
	 * The shop, resolved the way `new.tsx` and `shop-location.tsx` resolve it: the merchant's
	 * chosen branch, else the first shop they own. `scope.businessId` is optional by type, so
	 * it is a preference and not the answer.
	 */
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const owned = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		owned.find((one) => one.businessId === scope.businessId) ?? owned[0];
	const businessId = shop?.businessId ?? "";

	/**
	 * Gated on both ids being real. `ticketId` arrives from the URL, so a hand-typed path is
	 * as possible as an absent shop — and `support.get` answers a ticket belonging to another
	 * shop with a 404 rather than a row (`ticketOf` scopes on the membership).
	 */
	const ticket = useQuery(
		trpc.support.get.queryOptions(
			{ businessId, ticketId: ticketId ?? "" },
			{ enabled: !!businessId && !!ticketId },
		),
	);

	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);

	const reply = useMutation(trpc.support.reply.mutationOptions());
	const setWaiting = useMutation(trpc.support.setWaiting.mutationOptions());

	/**
	 * The **list** is invalidated, not only this ticket.
	 *
	 * Because a reply can change the status, and because a reply to a resolved ticket moves
	 * the row out of `OPEN`/`WAITING` entirely — invalidating just the detail query would
	 * leave the desk showing a ticket that is no longer in it.
	 */
	const refresh = async () => {
		await cache.invalidateQueries({ queryKey: trpc.support.pathKey() });
	};

	const replyError =
		body.trim().length === 0 ? t("biz.support.replyRequired") : null;

	const send = () => {
		if (reply.isPending || !businessId || !ticketId || replyError) return;
		setSending(true);
		reply.mutate(
			{ businessId, ticketId, body: body.trim() },
			{
				onSuccess: async () => {
					setSending(false);
					setBody("");
					await refresh();
				},
				onError: () => setSending(false),
			},
		);
	};

	const move = (waiting: boolean) => {
		if (setWaiting.isPending || !businessId || !ticketId) return;
		setWaiting.mutate(
			{ businessId, ticketId, waiting },
			{ onSuccess: refresh },
		);
	};

	const failed = shops.error ?? ticket.error ?? reply.error ?? setWaiting.error;
	const row = ticket.data;
	const live = row?.status === "OPEN" || row?.status === "WAITING";

	return (
		<View style={{ flex: 1 }}>
			<Screen
				title={row?.subject ?? t("biz.support.thread")}
				subtitle={
					row
						? `${t(`biz.support.status.${row.status}`)} · ${t(`biz.support.category.${row.category}`)}`
						: undefined
				}
				leading={<BackButton to="/(business)/support" surface />}
				scroll
				keyboardInsets
			>
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void ticket.refetch();
							reply.reset();
							setWaiting.reset();
						}}
					/>
				) : !row ? (
					<ManagementEmpty
						title={t("biz.manage.loading")}
						body={t("biz.manage.loadingScope")}
					/>
				) : (
					<>
						<ManagementSection title={t("biz.support.thread")}>
							{row.messages.map((message, index) => (
								<View
									key={message.id}
									// The section's own hairline, undivided on the last row for the
									// reason `ListRow` does it everywhere: a divider under the
									// final message delimits nothing.
									style={[
										styles.message,
										index < row.messages.length - 1 ? managementRowStyle : null,
									]}
								>
									<Text variant="caption" tone="muted" bold>
										{message.fromSupport
											? t("biz.support.fromSupport")
											: t("biz.support.you")}
									</Text>
									<Text>{message.body}</Text>
								</View>
							))}
							{/* A ticket always has one message — `create` writes the body as the
							    opening message in the same batch as the row — so this cannot
							    happen through this screen. Drawn anyway: a thread that reads as
							    empty for a reason nobody can see is the failure this whole screen
							    exists to remove. */}
							{row.messages.length === 0 ? (
								<ManagementEmpty
									title={t("biz.support.neverActivity")}
									body={t("biz.support.thread")}
								/>
							) : null}
						</ManagementSection>

						{/* Said before the box, not after the send: the reader has to know what
						    pressing the button will do while they are deciding whether to. */}
						{live === false ? (
							<Text variant="label" tone="muted">
								{t("biz.support.terminalNotice", {
									status: t(`biz.support.status.${row.status}`),
								})}
							</Text>
						) : null}

						{row.messages.length > 0 ? (
							<Text variant="caption" tone="muted">
								{row.lastMessageAt
									? `${t("biz.support.lastActivity")}: ${row.lastMessageAt.toLocaleDateString()}`
									: t("biz.support.neverActivity")}
							</Text>
						) : null}

						{/* Offered only where it would do something: `setWaiting` is a no-op on a
						    terminal ticket, and a toggle that snaps back is a lie about state. */}
						{live ? (
							<View style={styles.block}>
								<Text variant="label" tone="muted">
									{t("biz.support.waitingExplain")}
								</Text>
								<Button
									label={
										row.status === "WAITING"
											? t("biz.support.markOpen")
											: t("biz.support.markWaiting")
									}
									variant="secondary"
									fullWidth
									loading={setWaiting.isPending}
									onPress={() => move(row.status !== "WAITING")}
								/>
							</View>
						) : null}

						<View style={styles.block}>
							<Field
								label={t("biz.support.replyLabel")}
								value={body}
								onChangeText={setBody}
								maxLength={BODY_MAX}
								counter
								multiline
								numberOfLines={5}
								error={replyError}
								autoCapitalize="sentences"
							/>
						</View>
					</>
				)}
			</Screen>

			{row && !failed ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.support.replySend"),
						onPress: send,
						loading: sending,
						disabled: sending || !!replyError,
					}}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	/** One message: its author above, its body under, and the room two need to not collide. */
	message: { gap: space.xs, paddingVertical: space.md },
	/** A control that stands on its own below the thread rather than inside its card. */
	block: { gap: space.sm, marginTop: space.xl },
});
