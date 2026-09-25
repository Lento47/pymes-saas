import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { SettingsSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function StoreProfileScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.storeProfile")}>
			{(scope) => <SettingsSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
