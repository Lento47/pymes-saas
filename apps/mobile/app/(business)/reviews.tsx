import type { Review } from "@pymeshub/shared";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListEnd } from "@/components/list-end";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { formatDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

const PAGE_SIZE = 20;

export default function ReviewsScreen() {
	const trpc = useTRPC();
	const { t } = useT();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop = (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const query = useInfiniteQuery(
		trpc.reviews.listForBusiness.infiniteQueryOptions(
			{ businessId, limit: PAGE_SIZE },
			{
				enabled,
				getNextPageParam: (last) => last.nextCursor ?? undefined,
			},
		),
	);
	const reviews = query.data?.pages.flatMap((page) => page.items) ?? [];
	const failed = shops.error ?? query.error;
	const waiting =
		shops.isPending || (enabled && query.isPending && !query.data);

	if (failed) {
		return (
			<Screen title={t("biz.reviews.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void query.refetch();
					}}
				/>
			</Screen>
		);
	}

	return (
		<Screen title={t("biz.reviews.title")} scroll bottomInset>
			{waiting ? (
				<ReviewsSkeleton />
			) : reviews.length === 0 ? (
				<EmptyState
					icon="star-outline"
					title={t("biz.reviews.empty")}
					body={t("biz.more.feedback")}
				/>
			) : (
				reviews.map((review) => (
					<ReviewCard
						key={review.id}
						review={review}
						businessId={businessId}
						canReply={shop?.role === "OWNER" || shop?.role === "MANAGER"}
					/>
				))
			)}
			<ListEnd
				rows={reviews.length}
				hasNextPage={query.hasNextPage}
				loading={query.isFetchingNextPage}
				onPress={() => void query.fetchNextPage()}
			/>
		</Screen>
	);
}

function ReviewCard({
	review,
	businessId,
	canReply,
}: {
	review: Review;
	businessId: string;
	canReply: boolean;
}) {
	const { t, intlLocale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const [open, setOpen] = useState(false);
	const [reply, setReply] = useState(review.reply ?? "");
	const save = useMutation(
		trpc.reviews.reply.mutationOptions({
			onSuccess: async () => {
				toast.show(t("biz.reviews.reply.posted"));
				await cache.invalidateQueries({ queryKey: trpc.reviews.pathKey() });
				setOpen(false);
			},
		}),
	);
	const failure = useApiFailure(save.error);
	const submit = () => {
		if (!reply.trim()) return;
		save.mutate({
			businessId,
			reviewId: review.id,
			reply: reply.trim(),
		});
	};

	return (
		<Card style={styles.card}>
			<View style={styles.heading}>
				<View style={styles.authorBlock}>
					<Text bold>{review.authorName}</Text>
					<Text variant="caption" tone="muted">
						{t("biz.reviews.postedOn", {
							date: formatDay(review.createdAt, intlLocale),
						})}
					</Text>
				</View>
				<Text bold style={styles.rating}>
					{t("biz.reviews.breakdown", {
						count: review.rating,
						stars: 5,
					})}
				</Text>
			</View>
			<Text style={styles.comment}>
				{review.comment ?? t("biz.more.noWrittenReview")}
			</Text>
			{review.reply ? (
				<View style={styles.reply}>
					<Text variant="label" bold>
						{t("biz.reviews.reply.yours")}
					</Text>
					<Text tone="muted">{review.reply}</Text>
				</View>
			) : null}
			<View style={styles.actions}>
				<Button
					label={t("biz.reviews.order")}
					variant="ghost"
					size="sm"
					onPress={() =>
						router.push({
							pathname: "/merchant-order/[id]",
							params: { id: review.orderId },
						})
					}
				/>
				{canReply ? (
					<Button
						label={
							review.reply
								? t("biz.reviews.reply.edit")
								: t("biz.reviews.reply")
						}
						variant="secondary"
						size="sm"
						onPress={() => {
							setReply(review.reply ?? "");
							setOpen(true);
						}}
					/>
				) : null}
			</View>
			<Sheet
				open={open}
				onClose={() => setOpen(false)}
				title={
					review.reply ? t("biz.reviews.reply.edit") : t("biz.reviews.reply")
				}
				closeLabel={t("action.close")}
				snapPoints={[0.75, 1]}
				avoidKeyboard
				footer={
					<Button
						label={t("biz.reviews.reply")}
						loading={save.isPending}
						disabled={!reply.trim()}
						onPress={submit}
					/>
				}
			>
				<Field
					label={t("biz.reviews.reply")}
					value={reply}
					onChangeText={setReply}
					placeholder={t("biz.reviews.reply.placeholder")}
					multiline
					maxLength={1000}
					error={save.error ? failure.message : undefined}
				/>
			</Sheet>
		</Card>
	);
}

function ReviewsSkeleton() {
	return (
		<View style={styles.skeletonList}>
			{[0, 1, 2].map((index) => (
				<Card key={index} style={styles.card}>
					<Skeleton style={styles.skeletonTitle} />
					<Skeleton style={styles.skeletonLine} />
					<Skeleton style={styles.skeletonLineShort} />
				</Card>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	card: { marginBottom: space.md },
	skeletonList: { gap: space.md },
	skeletonTitle: { width: "58%", height: 22, marginBottom: space.md },
	skeletonLine: { height: 16, marginBottom: space.sm },
	skeletonLineShort: { width: "72%", height: 16 },
	heading: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: space.md,
	},
	authorBlock: { flex: 1, gap: space.xs },
	rating: { textAlign: "right" },
	comment: { marginTop: space.md },
	reply: {
		marginTop: space.md,
		paddingTop: space.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: space.xs,
	},
	actions: {
		marginTop: space.md,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.sm,
	},
});
