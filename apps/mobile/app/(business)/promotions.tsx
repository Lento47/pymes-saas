import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { PromotionsSurface } from "@/components/merchant-management-surfaces";
import { useT } from "@/lib/i18n";

export default function PromotionsScreen() {
	const { t } = useT();
	return (
		<MerchantManagementFrame title={t("biz.more.promotions")}>
			{(scope) => <PromotionsSurface scope={scope} />}
		</MerchantManagementFrame>
	);
}
