import { Redirect, Stack } from "expo-router";
import { NewOrderBannerProvider } from "@/components/new-order-banner";
import { MerchantScopeProvider } from "@/lib/merchant-scope";
import { useResolvedRole } from "@/lib/role";

/**
 * The business tree. Tabs live in `(tabs)`; settings, customize and forms push on
 * this stack so Back returns to the previous page instead of Home.
 */
export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function BusinessLayout() {
	const resolved = useResolvedRole();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "business") return <Redirect href="/(customer)" />;

	return (
		<MerchantScopeProvider>
			<NewOrderBannerProvider>
				<Stack screenOptions={{ headerShown: false }}>
					<Stack.Screen name="(tabs)" />
				</Stack>
			</NewOrderBannerProvider>
		</MerchantScopeProvider>
	);
}
