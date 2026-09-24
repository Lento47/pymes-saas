import { Stack } from "expo-router";

/**
 * The customer tree. It is also the fallback: a device that cannot prove another role draws
 * this one, which is why this layout guards nothing — `lib/role.ts` has already chosen it.
 */
export default function CustomerLayout() {
	return <Stack screenOptions={{ headerShown: false }} />;
}
