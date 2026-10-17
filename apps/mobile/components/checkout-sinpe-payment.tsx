import type { Currency } from "@pymeshub/shared";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "@/lib/i18n";
import { paymentProofImage } from "@/lib/payment-proof-image";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";
import { Button } from "./button";
import { ErrorState } from "./error-state";
import { Image } from "./image";
import { MoneyLine } from "./money-line";
import { Text } from "./text";

export function CheckoutSinpePayment({
	businessId,
	amountMinor,
	currency,
	account,
	scope,
	ready,
	onUploaded,
	onBusyChange,
}: {
	businessId: string;
	amountMinor: number;
	currency: Currency;
	account: { phone: string; recipientName: string };
	scope: string;
	ready: boolean;
	onUploaded: (proofId: string, scope: string) => void;
	onBusyChange: (busy: boolean) => void;
}) {
	const { t } = useT();
	const trpc = useTRPC();
	const [picking, setPicking] = useState(false);
	const [localError, setLocalError] = useState(false);
	const [preview, setPreview] = useState<{ uri: string; scope: string } | null>(
		null,
	);
	const upload = useMutation(trpc.orders.uploadCheckoutProof.mutationOptions());
	const busy = picking || upload.isPending;
	useEffect(() => {
		onBusyChange(busy);
		return () => onBusyChange(false);
	}, [busy, onBusyChange]);
	async function pick() {
		if (busy) return;
		setPicking(true);
		setLocalError(false);
		upload.reset();
		const selectedScope = scope;
		let uploading = false;
		try {
			const selection = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				quality: 0.8,
				base64: true,
			});
			if (selection.canceled) return;
			const asset = selection.assets[0];
			const image = paymentProofImage(asset?.base64);
			if (!image || !asset) {
				setLocalError(true);
				return;
			}
			onUploaded("", selectedScope);
			uploading = true;
			const result = await upload.mutateAsync({
				businessId,
				amountMinor,
				account,
				...image,
			});
			setPreview({ uri: asset.uri, scope: selectedScope });
			onUploaded(result.proofId, selectedScope);
		} catch {
			if (!uploading) setLocalError(true);
		} finally {
			setPicking(false);
		}
	}
	return (
		<View style={{ gap: space.md }}>
			<Text variant="body">{t("payments.checkoutHelp")}</Text>
			<MoneyLine
				label={t("payments.merchantAmount")}
				amountMinor={amountMinor}
				currency={currency}
				strong
			/>
			<Text variant="body" selectable>
				{account.recipientName} · {account.phone}
			</Text>
			<Text variant="caption" tone="muted">
				{t("payments.uploadHelp")}
			</Text>
			<Button
				label={t("payments.upload")}
				loading={busy}
				disabled={busy}
				onPress={() => void pick()}
			/>
			{ready && preview?.scope === scope ? (
				<Image
					uri={preview.uri}
					style={{ width: "100%", height: 180 }}
					accessibilityLabel={t("payments.proofLabel")}
				/>
			) : null}
			{ready ? (
				<Text variant="label" accessibilityLiveRegion="polite">
					{t("payments.checkoutReady")}
				</Text>
			) : null}
			{localError ? (
				<Text variant="body" tone="destructive">
					{t("payments.refusal.image")}
				</Text>
			) : null}
			{upload.error ? <ErrorState error={upload.error} /> : null}
		</View>
	);
}
