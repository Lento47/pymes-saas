import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { PaymentsSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function PaymentsScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.payments")}>
			{(scope) => <PaymentsSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
