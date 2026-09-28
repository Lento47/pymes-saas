import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { ActivitySurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function ActivityScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.activity")}>
			{(scope) => <ActivitySurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
