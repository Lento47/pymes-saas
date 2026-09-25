import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { SupportSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function SupportScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.support")}>
			{(scope) => <SupportSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
