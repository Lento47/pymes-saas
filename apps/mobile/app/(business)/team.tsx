import { roleCan } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP } from "@/theme";

const STAFF_ROLES = ["OWNER", "MANAGER", "STAFF", "COURIER"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
type StaffMemberView = {
	userId: string;
	name: string;
	role: StaffRole;
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TeamScreen() {
	const trpc = useTRPC();
	const { t, intlLocale } = useT();
	const cache = useQueryClient();
	const toast = useToast();
	const { session } = useSession();
	const insets = useSafeAreaInsets();
	const merchantScope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop =
		(shops.data ?? []).find(
			(one) =>
				one.role !== "COURIER" && one.businessId === merchantScope.businessId,
		) ?? (shops.data ?? []).find((one) => one.role !== "COURIER");
	const businessId = shop?.businessId ?? "";
	const enabled = !!businessId;
	const canManage = !!shop && roleCan(shop.role, "staff:manage");
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<StaffRole>("STAFF");
	const [inviteSubmitted, setInviteSubmitted] = useState(false);
	const [courierSearch, setCourierSearch] = useState("");
	const [directorySearch, setDirectorySearch] = useState("");
	const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
		null,
	);
	const [roleMember, setRoleMember] = useState<StaffMemberView | null>(null);
	const [nextRole, setNextRole] = useState<StaffRole>("STAFF");
	const [removeMember, setRemoveMember] = useState<StaffMemberView | null>(
		null,
	);

	const staff = useQuery(
		trpc.business.staff.queryOptions(
			{ businessId },
			{ enabled: enabled && canManage },
		),
	);
	const courierDirectory = useQuery(
		trpc.couriers.directory.queryOptions(
			{ businessId, search: directorySearch },
			{
				enabled:
					enabled &&
					canManage &&
					inviteOpen &&
					inviteRole === "COURIER" &&
					directorySearch.length >= 2,
			},
		),
	);
	const pendingInvites = useQuery(
		trpc.couriers.pendingForBusiness.queryOptions(
			{ businessId },
			{ enabled: enabled && canManage },
		),
	);

	const refreshStaff = async () => {
		await cache.invalidateQueries({ queryKey: trpc.business.pathKey() });
	};
	const invite = useMutation(
		trpc.business.inviteStaff.mutationOptions({
			onSuccess: async (member) => {
				toast.show(
					t("biz.staff.invite.added", {
						name: member.name,
					}),
				);
				await refreshStaff();
				setInviteOpen(false);
				setInviteEmail("");
				setInviteSubmitted(false);
			},
		}),
	);
	const inviteCourier = useMutation(
		trpc.couriers.invite.mutationOptions({
			onSuccess: async (row) => {
				toast.show(t("biz.courier.invite.sent", { name: row.courierName }));
				await cache.invalidateQueries({
					queryKey: trpc.couriers.pathKey(),
				});
				setInviteOpen(false);
				setCourierSearch("");
				setDirectorySearch("");
				setSelectedCourierId(null);
				setInviteSubmitted(false);
			},
		}),
	);
	const cancelInvite = useMutation(
		trpc.couriers.cancelInvite.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({
					queryKey: trpc.couriers.pathKey(),
				});
			},
		}),
	);
	const updateRole = useMutation(
		trpc.business.updateStaffRole.mutationOptions({
			onSuccess: async () => {
				await refreshStaff();
				setRoleMember(null);
			},
		}),
	);
	const remove = useMutation(
		trpc.business.removeStaff.mutationOptions({
			onSuccess: async () => {
				await refreshStaff();
				setRemoveMember(null);
			},
		}),
	);
	const inviteFailure = useApiFailure(invite.error);
	const courierInviteFailure = useApiFailure(inviteCourier.error);
	const directoryFailure = useApiFailure(courierDirectory.error);
	const cancelFailure = useApiFailure(cancelInvite.error);
	const roleFailure = useApiFailure(updateRole.error);
	const removeFailure = useApiFailure(remove.error);

	const waiting = useSkeletonHold(
		shops.isPending || (enabled && canManage && staff.isPending),
	);
	const failed = shops.error ?? (canManage ? staff.error : null);
	const isOwner = shop?.role === "OWNER";
	const emailValid = EMAIL_SHAPE.test(inviteEmail.trim());
	const inviteRoles: readonly StaffRole[] = isOwner
		? ["OWNER", "MANAGER", "STAFF", "COURIER"]
		: ["STAFF", "COURIER"];

	const submitInvite = () => {
		setInviteSubmitted(true);
		if (!businessId || !inviteRoles.includes(inviteRole)) return;
		if (inviteRole === "COURIER") {
			if (!selectedCourierId) return;
			inviteCourier.mutate({ businessId, profileId: selectedCourierId });
			return;
		}
		if (!emailValid) return;
		invite.mutate({
			businessId,
			email: inviteEmail.trim(),
			role: inviteRole,
		});
	};

	const roleHelp = (role: StaffRole) => {
		switch (role) {
			case "OWNER":
				return t("biz.staff.role.OWNER.help");
			case "MANAGER":
				return t("biz.staff.role.MANAGER.help");
			case "STAFF":
				return t("biz.staff.role.STAFF.help");
			case "COURIER":
				return t("biz.onboarding.delivery.courierHelp");
		}
	};

	if (failed) {
		return (
			<Screen title={t("biz.staff.title")}>
				<ErrorState
					error={failed}
					onRetry={() => {
						void shops.refetch();
						void staff.refetch();
					}}
				/>
			</Screen>
		);
	}

	if (waiting) {
		return (
			<Screen title={t("biz.staff.title")}>
				<TeamSkeleton loadingLabel={t("state.loading")} />
			</Screen>
		);
	}

	if (!shop) {
		return (
			<Screen title={t("biz.staff.title")}>
				<Text tone="muted">{t("state.empty")}</Text>
			</Screen>
		);
	}

	if (!canManage) {
		return (
			<Screen title={t("biz.staff.title")} subtitle={shop.businessName} scroll>
				<EmptyState
					icon="people-outline"
					title={t("biz.permission.title")}
					body={t("biz.permission.body")}
				/>
			</Screen>
		);
	}

	return (
		<>
			<Screen
				title={t("biz.staff.title")}
				subtitle={shop?.businessName}
				scroll
				bottomInset
			>
				<Button
					label={t("biz.staff.add")}
					onPress={() => setInviteOpen(true)}
					disabled={!businessId}
					fullWidth
				/>
				<View style={styles.cards}>
					{staff.data?.length ? (
						staff.data.map((member) => {
							const isSelf = member.userId === session?.userId;
							return (
								<Card key={member.userId}>
									<ListRow
										title={member.name}
										subtitle={member.email}
										state={t(`biz.staff.role.${member.role}`)}
										divider={false}
									/>
									<View style={styles.memberMeta}>
										<Text tone="muted">
											{isSelf
												? t("biz.staff.you")
												: t("biz.staff.joinedAt", {
														date: formatDay(member.joinedAt, intlLocale),
													})}
										</Text>
									</View>
									{isOwner ? (
										<View style={styles.memberActions}>
											<Button
												label={t("biz.staff.changeRole")}
												onPress={() => {
													setRoleMember(member);
													setNextRole(member.role);
												}}
												size="sm"
												variant="ghost"
											/>
											<Button
												label={t("biz.staff.remove")}
												onPress={() => setRemoveMember(member)}
												disabled={isSelf}
												accessibilityHint={
													isSelf ? t("biz.staff.cantRemoveOwner") : undefined
												}
												size="sm"
												variant="ghost"
											/>
										</View>
									) : null}
								</Card>
							);
						})
					) : (
						<EmptyState title={t("biz.staff.empty")} />
					)}
				</View>
				{pendingInvites.data?.length ? (
					<ScreenSection title={t("biz.courier.invitesForBusiness")}>
						<View style={styles.cards}>
							{pendingInvites.data.map((pending) => (
								<Card key={pending.id} style={styles.pendingCard}>
									<ListRow
										title={pending.courierName}
										subtitle={t("biz.courier.invite.pending")}
										divider={false}
									/>
									<Button
										label={t("biz.courier.invite.cancel")}
										variant="ghost"
										size="sm"
										loading={
											cancelInvite.isPending &&
											cancelInvite.variables?.inviteId === pending.id
										}
										disabled={cancelInvite.isPending}
										onPress={() =>
											cancelInvite.mutate({
												businessId,
												inviteId: pending.id,
											})
										}
									/>
								</Card>
							))}
						</View>
					</ScreenSection>
				) : null}
				{cancelFailure.message ? (
					<Text tone="destructive" accessibilityRole="alert">
						{cancelFailure.message}
					</Text>
				) : null}
			</Screen>

			<Sheet
				open={inviteOpen}
				onClose={() => setInviteOpen(false)}
				title={t("biz.staff.add")}
				closeLabel={t("action.close")}
				avoidKeyboard
				footer={
					<View
						style={[
							styles.sheetActions,
							{ paddingBottom: insets.bottom + space.md },
						]}
					>
						<Button
							label={
								inviteRole === "COURIER"
									? selectedCourierId
										? t("biz.courier.invite.send")
										: t("action.close")
									: t("biz.staff.invite.send")
							}
							onPress={() => {
								if (inviteRole === "COURIER" && !selectedCourierId) {
									setInviteOpen(false);
									return;
								}
								submitInvite();
							}}
							loading={invite.isPending || inviteCourier.isPending}
							disabled={!businessId}
							fullWidth
						/>
					</View>
				}
			>
				<View style={styles.sheetFields}>
					{inviteRole === "COURIER" ? (
						<>
							<Field
								label={t("biz.courier.search")}
								value={courierSearch}
								onChangeText={(value) => {
									setCourierSearch(value);
									setSelectedCourierId(null);
									setInviteSubmitted(false);
									if (value.trim().length < 2) setDirectorySearch("");
								}}
								onSubmitEditing={() => setDirectorySearch(courierSearch.trim())}
								help={t("biz.courier.search.help")}
								autoCapitalize="words"
								clearButtonMode="while-editing"
							/>
							<Button
								label={t("biz.courier.search.action")}
								variant="secondary"
								size="sm"
								fullWidth
								onPress={() => setDirectorySearch(courierSearch.trim())}
								disabled={courierSearch.trim().length < 2}
							/>
							{directorySearch.length < 2 ? (
								<Text tone="muted">{t("biz.courier.search.hint")}</Text>
							) : courierDirectory.isPending ? (
								<Skeleton style={styles.directoryCard} />
							) : courierDirectory.isError ? (
								<Text tone="destructive" accessibilityRole="alert">
									{directoryFailure.message}
								</Text>
							) : courierDirectory.data?.length ? (
								<View style={styles.directoryResults}>
									{courierDirectory.data.map((courier) => (
										<Card key={courier.profileId} style={styles.directoryCard}>
											<ListRow
												title={courier.displayName}
												subtitle={courier.serviceArea}
												state={t("biz.courier.directoryVerified")}
												divider={false}
											/>
											<Button
												label={
													courier.isMember
														? t("biz.courier.invite.alreadyMember")
														: courier.isInvited
															? t("biz.courier.invite.alreadySent")
															: t("biz.courier.invite.send")
												}
												disabled={courier.isMember || courier.isInvited}
												selected={selectedCourierId === courier.profileId}
												onPress={() => {
													setSelectedCourierId(courier.profileId);
													setInviteSubmitted(false);
												}}
												size="sm"
												variant="ghost"
											/>
										</Card>
									))}
								</View>
							) : (
								<Text tone="muted">{t("biz.courier.search.empty")}</Text>
							)}
							{courierInviteFailure.message ? (
								<Text tone="destructive" accessibilityRole="alert">
									{courierInviteFailure.message}
								</Text>
							) : null}
						</>
					) : (
						<Field
							label={t("biz.staff.invite.email")}
							value={inviteEmail}
							onChangeText={setInviteEmail}
							error={
								inviteSubmitted && !emailValid ? t("form.invalidEmail") : null
							}
							help={t("biz.staff.invite.help")}
							keyboardType="email-address"
							autoCapitalize="none"
							autoComplete="email"
						/>
					)}
					<Text variant="label" bold>
						{t("biz.staff.invite.role")}
					</Text>
					<View style={styles.roleChoices}>
						{inviteRoles.map((role) => (
							<Button
								key={role}
								label={t(`biz.staff.role.${role}`)}
								onPress={() => {
									if (role === inviteRole) return;
									selection();
									setInviteRole(role);
									setInviteSubmitted(false);
									setInviteEmail("");
									setCourierSearch("");
									setDirectorySearch("");
									setSelectedCourierId(null);
									invite.reset();
									inviteCourier.reset();
								}}
								selected={inviteRole === role}
								choiceRole="radio"
								size="sm"
								variant="ghost"
							/>
						))}
					</View>
					<Text tone="muted">{roleHelp(inviteRole)}</Text>
					{inviteRole !== "COURIER" && inviteFailure.message ? (
						<Text tone="destructive" accessibilityRole="alert">
							{inviteFailure.message}
						</Text>
					) : null}
				</View>
			</Sheet>

			<Sheet
				open={roleMember !== null}
				onClose={() => setRoleMember(null)}
				title={t("biz.staff.changeRole")}
				closeLabel={t("action.close")}
				footer={
					<View
						style={[
							styles.sheetActions,
							{ paddingBottom: insets.bottom + space.md },
						]}
					>
						<Button
							label={t("action.save")}
							onPress={() => {
								if (!roleMember || !businessId) return;
								updateRole.mutate({
									businessId,
									userId: roleMember.userId,
									role: nextRole,
								});
							}}
							loading={updateRole.isPending}
							disabled={!roleMember || nextRole === roleMember.role}
							fullWidth
						/>
					</View>
				}
			>
				<View style={styles.sheetFields}>
					<Text bold>{roleMember?.name}</Text>
					<View style={styles.roleChoices}>
						{STAFF_ROLES.filter((role) => role !== "COURIER").map((role) => (
							<Button
								key={role}
								label={t(`biz.staff.role.${role}`)}
								// The same picker rule as the invite sheet's roles above: the
								// haptic is for the value that changes, not for every tap.
								onPress={() => {
									if (role === nextRole) return;
									selection();
									setNextRole(role);
								}}
								selected={nextRole === role}
								choiceRole="radio"
								size="sm"
								variant="ghost"
							/>
						))}
					</View>
					<Text tone="muted">{roleHelp(nextRole)}</Text>
					{roleFailure.message ? (
						<Text tone="destructive" accessibilityRole="alert">
							{roleFailure.message}
						</Text>
					) : null}
				</View>
			</Sheet>

			<ConfirmSheet
				open={removeMember !== null}
				onClose={() => setRemoveMember(null)}
				title={t("biz.staff.remove.confirm", {
					name: removeMember?.name ?? "",
				})}
				body={removeFailure.message ?? undefined}
				confirmLabel={t("biz.staff.remove")}
				onConfirm={() => {
					if (!removeMember || !businessId) return;
					remove.mutate({ businessId, userId: removeMember.userId });
				}}
			/>
		</>
	);
}

/**
 * The hairline `./button` draws on every variant, at `borderWidth: 1` — the same two
 * points `./skeletons`' own `HAIRLINE` counts into the control boxes it mirrors,
 * restated here because that constant is private to that file.
 */
const HAIRLINE = 1;

/** Three grey cards, named so a key never falls to array position. */
const SKELETON_MEMBERS = ["first", "second", "third"] as const;

/**
 * The roster's wait: three member cards, at the card's own stack.
 *
 * One card is `./list-row`'s two-line row over its touch floor, then the joined-on line
 * and the owner's two `sm` controls at the paddings this screen's own rules pay — the
 * `memberMeta` and `memberActions` boxes are the real ones, composed rather than
 * restated. Every text height goes through `./skeletons`' `line()` at the reader's
 * `fontScale`, because a height frozen at 100% metrics is exact at 100% and short of the
 * real card at 200% by the growth of its own lines. The action row is drawn although the
 * reader may not be the owner — the common shape rather than the floor, which is the
 * direction this app's waits choose: a page that lands taller than its skeleton does not
 * pull content up under a thumb that has already scrolled. `Skeleton`'s `label` on the
 * first row is the one announcement for the whole wait.
 */
function TeamSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();

	// One `./list-row`: the title's `body` line and the role's `label` line under it at
	// the stack's own gap, `space.md` of vertical padding twice, over the row's own
	// touch floor (`components/list-row.tsx`'s `row`) — the sum a two-line row pays.
	const memberRow = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 +
			line("body", fontScale).height +
			TEXT_STACK_GAP +
			line("label", fontScale).height,
	);

	// One `./button` at its `sm` size: the label's `heading` line at the reader's scale,
	// `space.sm` of vertical padding twice and the hairline twice, over the touch floor
	// — the same sum `./skeletons`' `buttonHeight` states for the control it mirrors.
	const actionButton = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.sm * 2 + line("heading", fontScale).height,
	);

	return (
		<View style={styles.cards}>
			{SKELETON_MEMBERS.map((member) => (
				<Card key={member}>
					<Skeleton
						label={member === "first" ? loadingLabel : undefined}
						style={{ height: memberRow }}
					/>
					<View style={styles.memberMeta}>
						<Skeleton style={[styles.skeletonMeta, line("body", fontScale)]} />
					</View>
					<View style={styles.memberActions}>
						<Skeleton
							style={[styles.skeletonAction, { height: actionButton }]}
						/>
						<Skeleton
							style={[styles.skeletonAction, { height: actionButton }]}
						/>
					</View>
				</Card>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	// The two widths the wait stands in for: the joined-on sentence and either action's
	// word. Both are words the read does not carry, so both are shares and not measures.
	skeletonMeta: { width: "45%" },
	skeletonAction: { width: "35%" },
	// One step under the button above, the same stack the payouts screen pays
	// (`app/(business)/payouts.tsx`'s `cards`) — a twin screen keeps its twin's rhythm.
	cards: { gap: space.md, marginTop: space.lg },
	memberMeta: { paddingTop: space.sm },
	memberActions: {
		flexDirection: "row",
		gap: space.sm,
		paddingTop: space.sm,
	},
	sheetFields: { gap: space.md },
	directoryResults: { gap: space.sm },
	directoryCard: { minHeight: MIN_TOUCH_TARGET, gap: space.sm },
	pendingCard: { gap: space.sm },
	roleChoices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	sheetActions: { paddingHorizontal: space.lg, gap: space.sm },
});
