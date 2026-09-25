import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { SettlementsSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function SettlementsScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.settlements")}>
			{(scope) => <SettlementsSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
