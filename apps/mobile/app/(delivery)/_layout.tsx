import { Redirect, Stack } from "expo-router";
import { useResolvedRole } from "@/lib/role";

/**
 * The delivery tree. The board and account are tabs; a run and the profile editor
 * push on this stack so Back returns to the previous page.
 */
export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function DeliveryLayout() {
	const resolved = useResolvedRole();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "delivery") return <Redirect href="/(customer)" />;

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
		</Stack>
	);
}
