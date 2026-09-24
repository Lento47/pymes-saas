import { Redirect, Stack } from "expo-router";

import { useResolvedRole } from "@/lib/role";

/**
 * The delivery tree, guarded for the same reason `./_layout.tsx` under `(business)` is: the
 * group is reachable by URL whatever the resolved role, and a courier board drawn for someone
 * the platform has deactivated is a screen of 403s.
 *
 * **The one question this guard deliberately does not answer** is what the tree *contains*:
 * one shop's runs, or a merged pool across every shop this person couriers for.
 * `docs/architecture.md` §8 names it as open. The guard ships without it; the delivery
 * screens cannot.
 */
export default function DeliveryLayout() {
	const resolved = useResolvedRole();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "delivery") return <Redirect href="/(customer)" />;

	return <Stack screenOptions={{ headerShown: false }} />;
}
