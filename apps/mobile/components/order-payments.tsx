import type { MessageKey } from "@pymeshub/i18n";
import { formatMoney, type OrderPayment } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Field } from "@/components/field";
import { Image } from "@/components/image";
import { MoneyLine } from "@/components/money-line";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { paymentProofImage } from "@/lib/payment-proof-image";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

type Audience = "CUSTOMER" | "BUSINESS" | "COURIER";
const stateKeys: Record<OrderPayment["status"], MessageKey> = {
	AWAITING_PAYMENT: "payments.status.AWAITING_PAYMENT",
	AWAITING_VERIFICATION: "payments.status.AWAITING_VERIFICATION",
	CONFIRMED: "payments.status.CONFIRMED",
	REJECTED: "payments.status.REJECTED",
	NOT_REQUIRED: "payments.status.NOT_REQUIRED",
};
const roleKeys = {
	CUSTOMER: "payments.role.CUSTOMER",
	MERCHANT: "payments.role.MERCHANT",
	COURIER: "payments.role.COURIER",
} as const;

export function OrderPayments({
	orderId,
	audience = "CUSTOMER",
	compact = false,
}: {
	orderId: string;
	audience?: Audience;
	compact?: boolean;
}) {
	const trpc = useTRPC();
	const { t } = useT();
	const query = useQuery(
		trpc.orders.payments.queryOptions(
			{ orderId },
			{
				refetchInterval: (state) =>
					state.state.data?.payments.some(
						(pay) => !["CONFIRMED", "NOT_REQUIRED"].includes(pay.status),
					)
						? 5000
						: false,
			},
		),
	);
	const failure = useApiFailure(query.error);
	if (query.isPending)
		return (
			<Text variant="caption" tone="muted">
				{t("state.loading")}
			</Text>
		);
	if (query.isError || !query.data)
		return (
			<View style={{ gap: space.sm }}>
				<Text variant="caption" tone="destructive">
					{failure.message}
				</Text>
				<Button
					variant="secondary"
					label={t("payments.retry")}
					onPress={() => query.refetch()}
				/>
			</View>
		);
	const data = query.data;
	return (
		<View style={{ gap: space.md }}>
			<Card>
				<View style={{ gap: space.md }}>
					<Text variant="heading" bold>
						{t("payments.title")}
					</Text>
					{!compact ? (
						<>
							<MoneyLine
								label={t("payments.merchantAmount")}
								amountMinor={data.merchantAmountMinor}
								currency={data.currency}
							/>
							<MoneyLine
								label={t("payments.deliveryAmount")}
								amountMinor={data.courierChargeMinor}
								currency={data.currency}
							/>
							<MoneyLine
								label={t("payments.orderTotal")}
								amountMinor={data.customerTotalMinor}
								currency={data.currency}
								strong
							/>
						</>
					) : null}
					<Text variant="body" tone="muted">
						{t(
							data.legacy
								? "payments.legacy"
								: data.cashAdvance
									? audience === "COURIER"
										? "payments.cashCourier"
										: audience === "BUSINESS"
											? "payments.cashBusiness"
											: "payments.cashCustomer"
									: data.courierChargeMinor > 0
										? "payments.sinpeCustomer"
										: "payments.payShop",
						)}
					</Text>
					{audience === "COURIER" ? (
						<MoneyLine
							label={t("payments.courierEarnings")}
							amountMinor={data.courierEarningsMinor}
							currency={data.currency}
							strong
						/>
					) : null}
				</View>
			</Card>
			{data.payments
				.filter(
					(pay) =>
						pay.amountMinor > 0 &&
						!(audience === "CUSTOMER" && pay.purpose === "MERCHANT_DELIVERY"),
				)
				.map((pay) => (
					<PaymentStep
						key={pay.id}
						orderId={orderId}
						payment={pay}
						cashAdvance={data.cashAdvance}
					/>
				))}
		</View>
	);
}
function PaymentStep({
	orderId,
	payment: pay,
	cashAdvance,
}: {
	orderId: string;
	payment: OrderPayment;
	cashAdvance: boolean;
}) {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t, intlLocale } = useT();
	const toast = useToast();
	const [showProof, setShowProof] = useState(false);
	const [reference, setReference] = useState("");
	const [reason, setReason] = useState("");
	const [rejecting, setRejecting] = useState(false);
	const [localError, setLocalError] = useState<MessageKey | null>(null);
	const refresh = async () => {
		setShowProof(false);
		setRejecting(false);
		await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
		await cache.invalidateQueries({ queryKey: trpc.deliveries.pathKey() });
	};
	const choose = useMutation(
		trpc.orders.choosePaymentMethod.mutationOptions({ onSuccess: refresh }),
	);
	const upload = useMutation(
		trpc.orders.submitPaymentProof.mutationOptions({
			onSuccess: async () => {
				await refresh();
				setReference("");
				toast.show(t("payments.sent"));
			},
		}),
	);
	const review = useMutation(
		trpc.orders.reviewPayment.mutationOptions({ onSuccess: refresh }),
	);
	const proof = useQuery(
		trpc.orders.paymentProof.queryOptions(
			{ orderId, purpose: pay.purpose, proofId: pay.proofId ?? "" },
			{
				enabled: showProof && pay.canViewProof && Boolean(pay.proofId),
				staleTime: 0,
			},
		),
	);
	const failure = useApiFailure(
		choose.error ?? upload.error ?? review.error ?? proof.error,
	);
	const busy = choose.isPending || upload.isPending || review.isPending;
	const target = {
		orderId,
		purpose: pay.purpose,
		expectedVersion: pay.version,
	};
	const amount = formatMoney(pay.amountMinor, pay.currency, {
		locale: intlLocale,
	});
	const title: MessageKey =
		pay.purpose === "MERCHANT_ORDER"
			? cashAdvance
				? "payments.courierAdvance"
				: "payments.merchantAmount"
			: pay.purpose === "MERCHANT_DELIVERY"
				? "payments.businessDelivery"
				: cashAdvance
					? "payments.courierCollection"
					: "payments.deliveryAmount";
	const paid = pay.status === "CONFIRMED" || pay.status === "NOT_REQUIRED";
	const pick = async () => {
		if (busy) return;
		upload.reset();
		setLocalError(null);
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				quality: 0.8,
				base64: true,
			});
			if (result.canceled) return;
			const asset = result.assets[0];
			const image = paymentProofImage(asset?.base64);
			if (!image) {
				setLocalError("payments.refusal.image");
				return;
			}
			setLocalError(null);
			upload.mutate({
				...target,
				...image,
				reference: reference.trim() || undefined,
			});
		} catch {
			setLocalError("payments.refusal.image");
		}
	};
	return (
		<Card>
			<View style={{ gap: space.md }}>
				<MoneyLine
					label={t(title)}
					amountMinor={pay.amountMinor}
					currency={pay.currency}
					strong
				/>
				<Text variant="caption" tone="muted">
					{t("payments.payer", { name: t(roleKeys[pay.payer]) })} ·{" "}
					{t("payments.recipient", {
						name: pay.payeeName || t(roleKeys[pay.payee]),
					})}
				</Text>
				<Text variant="label" bold accessibilityLiveRegion="polite">
					{t(stateKeys[pay.status])}
				</Text>
				{pay.rejectionReason ? (
					<Text variant="body" tone="destructive">
						{pay.rejectionReason}
					</Text>
				) : null}
				{!pay.unlocked && !paid ? (
					<Text variant="caption" tone="muted">
						{t(
							pay.purpose === "MERCHANT_ORDER"
								? "payments.awaitCourier"
								: "payments.wait",
						)}
					</Text>
				) : null}
				{pay.canPay &&
				pay.unlocked &&
				pay.status !== "AWAITING_VERIFICATION" ? (
					<>
						{!(pay.purpose === "MERCHANT_ORDER" && pay.payer === "CUSTOMER") ? (
							<View style={{ gap: space.sm }}>
								<Button
									variant={pay.method === "CASH" ? "primary" : "secondary"}
									label={t("payments.cash")}
									disabled={busy || pay.method === "CASH"}
									onPress={() => choose.mutate({ ...target, method: "CASH" })}
								/>
								<Button
									variant={
										pay.method === "SINPE_MOVIL" ? "primary" : "secondary"
									}
									label={t("payments.sinpe")}
									disabled={
										busy || pay.method === "SINPE_MOVIL" || !pay.sinpeAvailable
									}
									onPress={() =>
										choose.mutate({ ...target, method: "SINPE_MOVIL" })
									}
								/>
								{!pay.sinpeAvailable ? (
									<Text variant="caption" tone="muted">
										{t("payments.noSinpeShort")}
									</Text>
								) : null}
							</View>
						) : null}
						{pay.method === "SINPE_MOVIL" && pay.sinpePhone ? (
							<>
								<Text variant="heading" bold selectable>
									{pay.sinpePhone}
								</Text>
								<Text variant="body" bold>
									{pay.payeeName}
								</Text>
								<Field
									label={t("payments.reference")}
									value={reference}
									onChangeText={setReference}
									maxLength={120}
								/>
								<Button
									label={t("payments.upload")}
									loading={upload.isPending}
									disabled={busy}
									onPress={() => void pick()}
								/>
								<Text variant="caption" tone="muted">
									{t("payments.uploadHelp")}
								</Text>
							</>
						) : (
							<Text variant="body">
								{t("payments.cash")} · {amount}
							</Text>
						)}
					</>
				) : null}
				{pay.canViewProof ? (
					<Button
						variant="secondary"
						label={t("payments.viewProof")}
						onPress={() => setShowProof((shown) => !shown)}
					/>
				) : null}
				{showProof && proof.isFetching ? (
					<Text variant="caption">{t("state.loading")}</Text>
				) : null}
				{showProof && proof.data ? (
					<Image
						uri={`data:${proof.data.mimeType};base64,${proof.data.base64}`}
						style={{ height: 240, width: "100%" }}
						resizeMode="contain"
						accessibilityLabel={t("payments.proofLabel")}
					/>
				) : null}
				{pay.canVerify &&
				pay.unlocked &&
				(pay.method === "CASH" || pay.status === "AWAITING_VERIFICATION") ? (
					<>
						{pay.method === "SINPE_MOVIL" ? (
							<Text variant="body" tone="muted">
								{t("payments.verifyNote")}
							</Text>
						) : null}
						<Button
							label={t(
								pay.method === "CASH"
									? "payments.confirmCash"
									: "payments.confirmSinpe",
							)}
							disabled={busy || (pay.method === "SINPE_MOVIL" && !proof.data)}
							loading={review.isPending}
							onPress={() =>
								Alert.alert(
									t("payments.confirmTitle"),
									t("payments.confirmBody", { amount }),
									[
										{ text: t("payments.cancel"), style: "cancel" },
										{
											text: t("payments.confirm"),
											onPress: () =>
												review.mutate({
													...target,
													decision: "CONFIRM",
													proofId: pay.proofId ?? undefined,
												}),
										},
									],
								)
							}
						/>
						{pay.method === "SINPE_MOVIL" ? (
							<>
								{rejecting ? (
									<Field
										label={t("payments.rejectReason")}
										value={reason}
										onChangeText={setReason}
										maxLength={300}
										multiline
									/>
								) : null}
								<Button
									variant="ghost"
									label={t("payments.reject")}
									disabled={busy || (rejecting && !reason.trim())}
									onPress={() => {
										if (!rejecting) {
											setRejecting(true);
											return;
										}
										review.mutate({
											...target,
											decision: "REJECT",
											proofId: pay.proofId ?? undefined,
											reason: reason.trim(),
										});
									}}
								/>
							</>
						) : null}
					</>
				) : null}
				{localError || failure.message ? (
					<Text variant="caption" tone="destructive" accessibilityRole="alert">
						{localError ? t(localError) : failure.message}
					</Text>
				) : null}
			</View>
		</Card>
	);
}
