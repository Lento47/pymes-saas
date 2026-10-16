import { MOBILE_CONTROLS } from "@pymeshub/shared";
import { Redirect, Stack } from "expo-router";
import { NewOrderBannerProvider } from "@/components/new-order-banner";
import { MerchantScopeProvider } from "@/lib/merchant-scope";
import { useMobileConfiguration } from "@/lib/mobile-configuration";
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
	const { enabled } = useMobileConfiguration();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "business") return <Redirect href="/(customer)" />;

	return (
		<MerchantScopeProvider>
			<NewOrderBannerProvider>
				<Stack screenOptions={{ headerShown: false }}>
					<Stack.Screen name="(tabs)" />
					{MOBILE_CONTROLS.filter(
						(control) =>
							control.role === "merchant" && control.routes.length > 0,
					).map((control) => (
						<Stack.Protected key={control.id} guard={enabled(control.id)}>
							{control.routes.map((route) => (
								<Stack.Screen key={route} name={route} />
							))}
						</Stack.Protected>
					))}
				</Stack>
			</NewOrderBannerProvider>
		</MerchantScopeProvider>
	);
}
