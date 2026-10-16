import { useLocalSearchParams } from "expo-router";
import { BackButton } from "@/components/back-button";
import { OrderPayments } from "@/components/order-payments";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { useT } from "@/lib/i18n";
export default function PaymentScreen() {
	const { orderId } = useLocalSearchParams<{ orderId: string }>();
	const { t } = useT();
	return (
		<SignedIn>
			<Screen
				scroll
				title={t("payments.title")}
				leading={<BackButton to="/delivery" />}
				keyboardInsets
				bottomInset
			>
				{orderId ? (
					<OrderPayments orderId={orderId} audience="COURIER" />
				) : null}
			</Screen>
		</SignedIn>
	);
}
