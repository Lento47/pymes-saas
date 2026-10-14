import { useState } from "react";
import { ListRow } from "@/components/list-row";
import { MerchantGuide } from "@/components/merchant-guide";
import { MerchantManagementFrame } from "@/components/merchant-management-frame";
import { SupportSurface } from "@/components/merchant-management-surfaces";
import { ManagementSection } from "@/components/merchant-management-ui";
import { useT } from "@/lib/i18n";

export default function SupportScreen() {
	const { t } = useT();
	const [guideOpen, setGuideOpen] = useState(false);
	return (
		<MerchantManagementFrame title={t("biz.more.support")}>
			{(scope) => (
				<>
					<ManagementSection title={t("biz.guide.title")}>
						<ListRow
							title={t("biz.guide.view")}
							chevron
							divider={false}
							onPress={() => setGuideOpen(true)}
						/>
					</ManagementSection>
					<SupportSurface scope={scope} />
					<MerchantGuide
						open={guideOpen}
						businessId={scope.businessId}
						onClose={() => setGuideOpen(false)}
					/>
				</>
			)}
		</MerchantManagementFrame>
	);
}
