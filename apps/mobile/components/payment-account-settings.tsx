import { sinpeAccountInput } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

export function PaymentAccountSettings({
	businessId,
	showTitle = true,
}: {
	businessId?: string;
	showTitle?: boolean;
}) {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const query = useQuery(
		trpc.orders.paymentAccount.queryOptions({ businessId }),
	);
	const [phone, setPhone] = useState("");
	const [name, setName] = useState("");
	const [invalid, setInvalid] = useState(false);
	const initialized = useRef<string | null>(null);
	useEffect(() => {
		const key = businessId ?? "personal";
		if (!query.data || initialized.current === key) return;
		initialized.current = key;
		setPhone(query.data.account?.phone.replace(/^\+506/, "") ?? "");
		setName(query.data.account?.recipientName ?? "");
	}, [businessId, query.data]);
	const save = useMutation(
		trpc.orders.savePaymentAccount.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
				toast.show(t("payments.accountSaved"));
			},
		}),
	);
	const failure = useApiFailure(save.error ?? query.error);
	return (
		<View style={{ gap: space.md }}>
			{showTitle ? (
				<Text variant="label" bold>
					{t("payments.accountTitle")}
				</Text>
			) : null}
			<Text variant="caption" tone="muted">
				{t("payments.accountHelp")}
			</Text>
			{query.isPending ? (
				<Text variant="caption">{t("state.loading")}</Text>
			) : query.data?.canEdit ? (
				<>
					<Field
						label={t("payments.accountPhone")}
						value={phone}
						onChangeText={(value) => {
							setPhone(value.replace(/[^\d+]/g, ""));
							setInvalid(false);
						}}
						keyboardType="phone-pad"
						maxLength={12}
					/>
					<Field
						label={t("payments.accountName")}
						value={name}
						onChangeText={(value) => {
							setName(value);
							setInvalid(false);
						}}
						maxLength={120}
					/>
					{invalid ? (
						<Text
							variant="caption"
							tone="destructive"
							accessibilityRole="alert"
						>
							{t("payments.accountInvalid")}
						</Text>
					) : null}
					<Button
						label={t("payments.accountSave")}
						variant="secondary"
						loading={save.isPending}
						onPress={() => {
							const parsed = sinpeAccountInput.safeParse({
								phone,
								recipientName: name,
							});
							if (!parsed.success) {
								setInvalid(true);
								return;
							}
							save.mutate({ businessId, account: parsed.data });
						}}
					/>
					{query.data.account ? (
						<Button
							label={t("payments.accountRemove")}
							variant="ghost"
							disabled={save.isPending}
							onPress={() =>
								save.mutate(
									{ businessId, account: null },
									{
										onSuccess: () => {
											setPhone("");
											setName("");
										},
									},
								)
							}
						/>
					) : null}
				</>
			) : query.data?.account ? (
				<Text variant="body">
					{query.data.account.recipientName} · {query.data.account.phone}
				</Text>
			) : null}
			{failure.message ? (
				<Text variant="caption" tone="destructive" accessibilityRole="alert">
					{failure.message}
				</Text>
			) : null}
		</View>
	);
}
