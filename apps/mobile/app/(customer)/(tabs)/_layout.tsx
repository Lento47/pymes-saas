import { Tabs } from "expo-router";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";
import { useMobileConfiguration } from "@/lib/mobile-configuration";

/**
 * The four customer tabs. Browse screens sit on the parent stack, not here: a tab
 * switch has no history, and Back from a store used to dump the reader on home.
 */
export default function CustomerTabs() {
	const { t } = useT();
	const { enabled } = useMobileConfiguration();

	return (
		<Tabs screenOptions={useCapsuleScreenOptions()}>
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
			<Tabs.Protected guard={enabled("customer.search")}>
				<Tabs.Screen
					name="search"
					options={{
						title: t("nav.search"),
						tabBarAccessibilityLabel: t("nav.search"),
						tabBarIcon: ({ focused, color }) => (
							<TabMark focused={focused} name="search-outline" color={color} />
						),
					}}
				/>
			</Tabs.Protected>
			<Tabs.Screen
				name="orders"
				options={{
					title: t("nav.orders"),
					tabBarAccessibilityLabel: t("nav.orders"),
					tabBarIcon: ({ focused, color }) => (
						<TabMark focused={focused} name="receipt-outline" color={color} />
					),
				}}
			/>
			<Tabs.Protected guard={enabled("customer.cart")}>
				<Tabs.Screen
					name="cart"
					options={{
						title: t("nav.cart"),
						tabBarAccessibilityLabel: t("nav.cart"),
						tabBarIcon: ({ focused, color }) => (
							<TabMark focused={focused} name="cart-outline" color={color} />
						),
					}}
				/>
			</Tabs.Protected>
		</Tabs>
	);
}
