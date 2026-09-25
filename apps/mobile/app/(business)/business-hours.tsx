import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { BusinessHoursSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function BusinessHoursScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.businessHours")}>
			{(scope) => <BusinessHoursSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
