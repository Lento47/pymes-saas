import { formatMinuteOfDay, localizedName, weekdayName } from "@pymeshub/i18n";
import {
	type BusinessHoursEntry,
	formatMoney,
	type Review,
	roleCan,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityDashboard } from "@/components/merchant-activity-dashboard";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { Button } from "./button";
import { ListRow } from "./list-row";
import type { ManagementScope } from "./merchant-management-frame";
import {
	KeyValue,
	ManagementEmpty,
	ManagementError,
	ManagementSection,
	MetricGrid,
	TableHeader,
	TableRow,
} from "./merchant-management-ui";
import { Text } from "./text";

function SettingsSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { t, locale } = useT();
	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId: scope.businessId }),
	);
	const canEdit = roleCan(scope.role, "business:settings");

	if (settings.error) return <ManagementError error={settings.error} />;
	if (settings.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	const data = settings.data;
	const notSet = t("biz.manage.notSet");
	const address = [
		data.line1,
		data.line2,
		data.city,
		data.region,
		data.postalCode,
		data.country,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<>
			<ManagementSection title={t("biz.manage.storeProfile")}>
				<KeyValue label={t("biz.settings.name")} value={data.name} />
				<KeyValue
					label={t("biz.settings.category")}
					value={
						data.categoryName
							? localizedName(
									{ name: data.categoryName, nameEn: data.categoryNameEn },
									locale,
								)
							: notSet
					}
				/>
				<KeyValue
					label={t("biz.settings.email")}
					value={data.email ?? notSet}
				/>
				<KeyValue
					label={t("biz.settings.phone")}
					value={data.phone ?? notSet}
				/>
				<KeyValue label={t("biz.settings.address")} value={address || notSet} />
				<KeyValue
					label={t("biz.location.map")}
					value={
						data.lat != null && data.lng != null
							? t("biz.location.subtitle")
							: t("biz.location.unset")
					}
				/>
				<KeyValue
					label={t("biz.settings.description")}
					value={data.description || t("biz.manage.noDescription")}
				/>
				<KeyValue label={t("biz.settings.currency")} value={data.currency} />
				<KeyValue
					label={t("biz.more.verification")}
					value={
						data.isVerified
							? t("biz.more.verified")
							: t("biz.more.verificationPending")
					}
				/>
			</ManagementSection>
			{canEdit ? (
				<Button
					label={t("biz.order.dispatch.setPickupPin")}
					variant="secondary"
					fullWidth
					onPress={() => router.push("/(business)/shop-location")}
				/>
			) : null}
			<ManagementSection title={t("biz.manage.brandAssets")}>
				<KeyValue
					label={t("biz.settings.logo")}
					value={data.logoUrl || notSet}
				/>
				<KeyValue
					label={t("biz.settings.cover")}
					value={data.coverUrl || notSet}
				/>
			</ManagementSection>
			{canEdit ? (
				<Button
					label={t("biz.manage.editSettings")}
					variant="secondary"
					fullWidth
					onPress={() => router.push("/(business)/merchant-settings")}
				/>
			) : null}
		</>
	);
}

function BusinessHoursSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId: scope.businessId }),
	);
	const canEdit = roleCan(scope.role, "business:settings");

	if (settings.error) return <ManagementError error={settings.error} />;
	if (settings.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	const hours = [...settings.data.hours].sort((a, b) => a.day - b.day);
	return (
		<>
			<ManagementSection title={t("biz.manage.schedule")}>
				{hours.map((entry, index) => (
					<ListRow
						key={entry.day}
						title={weekdayName(entry.day, intlLocale) ?? String(entry.day)}
						subtitle={hoursSubtitle(entry, intlLocale, t)}
						divider={index < hours.length - 1}
					/>
				))}
			</ManagementSection>
			{canEdit ? (
				<Button
					label={t("biz.manage.editSettings")}
					variant="secondary"
					fullWidth
					onPress={() => router.push("/(business)/merchant-settings")}
				/>
			) : null}
		</>
	);
}

function hoursSubtitle(
	entry: BusinessHoursEntry,
	intlLocale: string,
	t: ReturnType<typeof useT>["t"],
): string {
	if (entry.isClosed) return t("biz.settings.hours.closed");
	const opens = formatMinuteOfDay(entry.opensMinute, intlLocale);
	const closes = formatMinuteOfDay(entry.closesMinute, intlLocale);
	return opens && closes ? `${opens} – ${closes}` : t("biz.manage.unavailable");
}

function LocationsSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t } = useT();
	const canManage = roleCan(scope.role, "business:settings");
	const refresh = async () => {
		await cache.invalidateQueries({
			queryKey: trpc.business.locations.pathKey(),
		});
	};
	const pause = useMutation(
		trpc.business.pauseLocation.mutationOptions({
			onSuccess: refresh,
		}),
	);
	const resume = useMutation(
		trpc.business.resumeLocation.mutationOptions({
			onSuccess: refresh,
		}),
	);

	return (
		<>
			<ManagementSection title={t("biz.manage.locationOperations")}>
				<TableHeader
					columns={[
						t("biz.manage.location"),
						t("biz.manage.city"),
						t("biz.manage.status"),
						t("biz.manage.action"),
					]}
				/>
				{scope.locations.map((location) => {
					const paused =
						location.status === "paused_manual" ||
						location.status === "paused_capacity";
					const manageable = paused || location.status === "open";
					return (
						<TableRow
							key={location.id}
							cells={[
								{
									key: "name",
									content: <Text bold>{location.name}</Text>,
								},
								{
									key: "city",
									content: <Text tone="muted">{location.city || "—"}</Text>,
								},
								{
									key: "status",
									content: (
										<Text tone="muted">
											{t(`biz.locations.status.${location.status}`)}
										</Text>
									),
								},
							]}
							actions={
								canManage && manageable ? (
									<Button
										label={t(
											paused ? "biz.locations.resume" : "biz.locations.pause",
										)}
										size="sm"
										variant="secondary"
										loading={pause.isPending || resume.isPending}
										onPress={() => {
											if (paused) {
												resume.mutate({
													businessId: scope.businessId,
													locationId: location.id,
												});
											} else {
												pause.mutate({
													businessId: scope.businessId,
													locationId: location.id,
													reason: "manual",
												});
											}
										}}
									/>
								) : null
							}
						/>
					);
				})}
				{scope.locations.length === 0 ? (
					<ManagementEmpty
						title={t("biz.manage.noLocations")}
						body={t("biz.locations.subtitle")}
					/>
				) : null}
			</ManagementSection>
			<Button
				label={t("biz.locations.title")}
				variant="secondary"
				fullWidth
				onPress={() => router.push("/(business)/locations")}
			/>
		</>
	);
}

function StaffSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t } = useT();
	const staff = useQuery(
		trpc.business.staff.queryOptions(
			{ businessId: scope.businessId },
			{ enabled: roleCan(scope.role, "staff:manage") },
		),
	);
	const updateRole = useMutation(
		trpc.business.updateStaffRole.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({ queryKey: trpc.business.pathKey() });
			},
		}),
	);

	if (!roleCan(scope.role, "staff:manage")) {
		return (
			<ManagementEmpty
				title={t("biz.permission.title")}
				body={t("biz.permission.body")}
			/>
		);
	}
	if (staff.error) return <ManagementError error={staff.error} />;
	if (staff.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	const rows = staff.data ?? [];
	return (
		<>
			<ManagementSection title={t("biz.manage.staffRoster")}>
				<TableHeader
					columns={[
						t("biz.manage.member"),
						t("biz.manage.email"),
						t("biz.manage.role"),
						t("biz.manage.action"),
					]}
				/>
				{rows.map((member) => (
					<TableRow
						key={member.userId}
						cells={[
							{
								key: "name",
								content: <Text bold>{member.name}</Text>,
							},
							{
								key: "email",
								content: <Text tone="muted">{member.email}</Text>,
							},
							{
								key: "role",
								content: <Text>{t(`biz.staff.role.${member.role}`)}</Text>,
							},
						]}
						actions={
							scope.role === "OWNER" && member.role !== "OWNER" ? (
								<Button
									label={t("biz.manage.changeRole")}
									size="sm"
									variant="secondary"
									loading={updateRole.isPending}
									onPress={() =>
										updateRole.mutate({
											businessId: scope.businessId,
											userId: member.userId,
											role: member.role === "STAFF" ? "MANAGER" : "STAFF",
										})
									}
								/>
							) : null
						}
					/>
				))}
				{rows.length === 0 ? (
					<ManagementEmpty
						title={t("biz.manage.noStaff")}
						body={t("biz.staff.empty")}
					/>
				) : null}
			</ManagementSection>
			<Button
				label={t("biz.staff.title")}
				variant="secondary"
				fullWidth
				onPress={() => router.push("/(business)/team")}
			/>
		</>
	);
}

function PromotionsSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const feed = useQuery(trpc.catalog.feed.queryOptions({ limit: 50 }));
	const promotions = (feed.data?.promotions ?? []).filter(
		(promotion) => promotion.business.id === scope.businessId,
	);

	if (feed.error) return <ManagementError error={feed.error} />;
	if (feed.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	return (
		<>
			<ManagementSection title={t("biz.manage.promotionControls")}>
				<MetricGrid
					metrics={[
						{ label: t("biz.manage.active"), value: String(promotions.length) },
						{ label: t("biz.manage.scheduled"), value: "—" },
					]}
				/>
			</ManagementSection>
			<ManagementSection title={t("biz.manage.promotionRecords")}>
				{promotions.map((promotion) => (
					<ListRow
						key={promotion.id}
						title={promotion.code}
						subtitle={`${promotionValue(promotion, intlLocale, t)} · ${promotion.business.name}`}
					/>
				))}
				{promotions.length === 0 ? (
					<ManagementEmpty
						title={t("biz.manage.noPromotions")}
						body={t("biz.manage.promotionReadOnly")}
					/>
				) : null}
			</ManagementSection>
		</>
	);
}

function promotionValue(
	promotion: {
		kind: "PERCENT" | "FIXED" | "FREE_DELIVERY";
		value: number;
		currency:
			| "CRC"
			| "USD"
			| "MXN"
			| "GTQ"
			| "HNL"
			| "NIO"
			| "PAB"
			| "DOP"
			| "COP"
			| "PEN"
			| "CLP"
			| "ARS"
			| "BRL"
			| "EUR"
			| "JPY";
	},
	intlLocale: string,
	t: ReturnType<typeof useT>["t"],
): string {
	if (promotion.kind === "PERCENT") return `${promotion.value}%`;
	if (promotion.kind === "FIXED") {
		return formatMoney(promotion.value, promotion.currency, {
			locale: intlLocale,
		});
	}
	return t("biz.settings.delivery");
}

/**
 * The merchant's support desk: the questions this shop still has open.
 *
 * ## Why this queries at all
 *
 * It used to not. `biz.manage.noTickets` was written into a `KeyValue` as a **fixed value**,
 * so a shop with five open tickets was told it had none, and the row beside it padded the
 * gap with `biz.manage.responseChannel` — a label reading "App guidance" whose value was the
 * word "Support", which states nothing about anything. The surface had everything it needed:
 * `support.list` exists, is mounted at `routers/index.ts`, and is one `businessId` away.
 *
 * ## Why `enabled` on a `businessId` that is normally set
 *
 * `MerchantManagementFrame` resolves the shop as `find(...) ?? shopList[0]` and falls back to
 * `""` when the operator belongs to none (`merchant-management-frame.tsx:42`). A merchant in
 * that state gets an empty string, `businessProcedure("orders:read")` refuses it at the
 * middleware, and the query becomes a guaranteed error rather than an empty desk. So the gate
 * is on the id being a real one. `ReviewsSurface` below does not do this and inherits the
 * failure; it is left alone rather than fixed here, because a second change to a surface this
 * commit does not otherwise touch is a diff nobody can review.
 *
 * ## Why only the live ones, and why `WAITING` is one of them
 *
 * No `status` is passed, and `supportTicketListInput` documents what that means: the list reads
 * the open tickets, which the service resolves as `OPEN` and `WAITING`
 * (`services/support.ts:66`). A resolved ticket is history. `WAITING` is included on purpose —
 * it is the state where PymesHub asked the merchant something and has not heard back, and a
 * queue that hides it is how a desk looks empty while it is not.
 */
function SupportSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { t, tp } = useT();
	const tickets = useQuery(
		trpc.support.list.queryOptions(
			{ businessId: scope.businessId },
			{ enabled: !!scope.businessId },
		),
	);

	if (tickets.error) return <ManagementError error={tickets.error} />;
	if (tickets.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	const rows = tickets.data ?? [];
	return (
		<ManagementSection
			title={t("biz.support.queue")}
			action={
				<Button
					label={t("biz.support.newTicket")}
					size="sm"
					onPress={() => router.push("/(business)/support/new")}
				/>
			}
		>
			{rows.map((ticket, index) => (
				<ListRow
					key={ticket.id}
					title={ticket.subject}
					subtitle={`${t(`biz.support.category.${ticket.category}`)} · ${tp("biz.support.messages", ticket.messageCount)}`}
					// A word rather than a chip: `ListRow.state` exists because colour must
					// never be the only signal, and the status is the one fact about a ticket
					// that decides whether it wants an answer.
					state={t(`biz.support.status.${ticket.status}`)}
					chevron
					// Univided last, as everywhere else: a hairline under the final row
					// delimits nothing.
					divider={index < rows.length - 1}
					onPress={() => router.push(`/(business)/support/${ticket.id}`)}
				/>
			))}
			{rows.length === 0 ? (
				<ManagementEmpty
					title={t("biz.support.emptyTitle")}
					body={t("biz.support.emptyBody")}
				/>
			) : null}
		</ManagementSection>
	);
}

function ActivitySurface({ scope }: { scope: ManagementScope }) {
	return <ActivityDashboard scope={scope} />;
}

function ReviewsSurface({ scope }: { scope: ManagementScope }) {
	const trpc = useTRPC();
	const { t } = useT();
	const reviews = useQuery(
		trpc.reviews.listForBusiness.queryOptions({
			businessId: scope.businessId,
			limit: 50,
		}),
	);

	if (reviews.error) return <ManagementError error={reviews.error} />;
	if (reviews.isPending) {
		return (
			<ManagementEmpty
				title={t("biz.manage.loading")}
				body={t("biz.manage.loadingScope")}
			/>
		);
	}

	const rows: Review[] = reviews.data?.items ?? [];
	return (
		<>
			<ManagementSection title={t("biz.more.feedback")}>
				{rows.map((review) => (
					<ListRow
						key={review.id}
						title={`${review.authorName} · ${t("biz.reviews.breakdown", {
							count: review.rating,
							stars: 5,
						})}`}
						subtitle={review.comment ?? t("biz.more.noWrittenReview")}
						state={
							review.reply
								? t("biz.reviews.reply.yours")
								: t("biz.reviews.reply")
						}
					/>
				))}
				{rows.length === 0 ? (
					<ManagementEmpty
						title={t("biz.reviews.empty")}
						body={t("biz.more.feedback")}
					/>
				) : null}
			</ManagementSection>
			<Button
				label={t("biz.more.viewReviews")}
				variant="secondary"
				fullWidth
				onPress={() => router.push("/reviews")}
			/>
		</>
	);
}

export {
	ActivitySurface,
	BusinessHoursSurface,
	LocationsSurface,
	PromotionsSurface,
	ReviewsSurface,
	SettingsSurface,
	StaffSurface,
	SupportSurface,
};
