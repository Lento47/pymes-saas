import { Tabs } from "expo-router";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/reduced-motion";

/**
 * Two courier tabs. The waiting board hides the capsule; account keeps it.
 */
export default function DeliveryTabs() {
	const { t } = useT();
	const reduceMotion = useReducedMotion();
	const capsule = useCapsuleScreenOptions();

	return (
		<Tabs screenOptions={capsule}>
			<Tabs.Screen
				name="delivery"
				options={{
					title: t("delivery.board.title"),
					tabBarAccessibilityLabel: t("delivery.board.title"),
					tabBarStyle: { display: "none" },
					animation: reduceMotion ? "none" : "shift",
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="bicycle-outline" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="account"
				options={{
					title: t("account.title"),
					tabBarAccessibilityLabel: t("account.title"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark
							focused={focused}
							name="person-circle-outline"
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
