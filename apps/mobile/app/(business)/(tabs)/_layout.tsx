import { Tabs } from "expo-router";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";

/**
 * Four merchant tabs. Management screens sit on the parent stack.
 */
export default function BusinessTabs() {
	const { t } = useT();
	const capsule = useCapsuleScreenOptions();

	return (
		<Tabs screenOptions={capsule}>
			<Tabs.Screen
				name="index"
				options={{
					title: t("nav.home"),
					tabBarAccessibilityLabel: t("nav.home"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="home-outline" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="business"
				options={{
					title: t("biz.nav.orders"),
					tabBarAccessibilityLabel: t("biz.nav.orders"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="receipt-outline" color={color} />
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
			<Tabs.Screen
				name="menu"
				options={{
					title: t("biz.nav.menu"),
					tabBarAccessibilityLabel: t("biz.nav.menu"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="menu-outline" color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
