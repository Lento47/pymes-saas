import { MOBILE_CONTROLS } from "@pymeshub/shared";
import { Stack } from "expo-router";
import { useMobileConfiguration } from "@/lib/mobile-configuration";

/**
 * The customer tree. Tabs live in `(tabs)`; everything else — a store, a product, a
 * category — is a stack screen, so Back returns to the page that opened it.
 *
 * `initialRouteName` is `(tabs)` so a cold store link still has a home behind it.
 */
export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function CustomerLayout() {
	const { enabled } = useMobileConfiguration();
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="account-hub" />
			<Stack.Screen name="edit-profile" />
			{MOBILE_CONTROLS.filter(
				(control) => control.role === "customer" || control.id === "categories",
			).map((control) => (
				<Stack.Protected key={control.id} guard={enabled(control.id)}>
					{control.routes
						.filter((route) => route !== "search" && route !== "cart")
						.map((route) => (
							<Stack.Screen key={route} name={route} />
						))}
				</Stack.Protected>
			))}
		</Stack>
	);
}
