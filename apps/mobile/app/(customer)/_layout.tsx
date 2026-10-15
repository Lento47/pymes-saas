import { Stack } from "expo-router";

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
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="account-hub" />
			<Stack.Screen name="edit-profile" />
		</Stack>
	);
}
