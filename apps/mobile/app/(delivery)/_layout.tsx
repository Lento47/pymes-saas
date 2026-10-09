import { Redirect, Tabs } from "expo-router";

import { deliveryBarlessOptions } from "@/components/tab-bar";
import { TabMark, useCapsuleScreenOptions } from "@/components/tab-capsule";
import { useT } from "@/lib/i18n";
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
 *
 * ## Two tabs, and the third role's shell
 *
 * `(customer)` and `(business)` each draw the same floating capsule, and this tree grew none
 * — it was one screen with a form behind a button, which is not a role a courier can live in
 * the way the other two are. `./tab-capsule` is the single copy of the bar and the only thing
 * that differs between trees is which routes turn it off, so the third tree is two more tab
 * declarations rather than a second shape.
 *
 * **The board's tab is `delivery`, not `index`.** `app/(delivery)/index.tsx` is
 * `<Redirect href="/delivery" />`, so an `index` tab would render a screen whose only job is
 * redirect to the board one file over. `app/(business)/index.tsx` is a real screen — the feed
 * — which is exactly what makes `index` the right name there and the wrong one here.
 *
 * **Every route file in this group is declared below.** Tabs auto-registers an undeclared
 * file as a visible tab with a file-name label and no icon, which is how six managed screens
 * once crowded the merchant bar.
 */
export default function DeliveryLayout() {
	const { t } = useT();
	const resolved = useResolvedRole();

	/**
	 * Above the two early returns, not inside the JSX.
	 *
	 * The capsule's options read the theme and two device measurements, so they are a hook
	 * call; a hook below a `return` runs on the courier's frame and not on the boot frame, and
	 * a component that calls a different number of hooks on two renders of the same instance
	 * is the crash `rules-of-hooks` is named after. `app/(business)/_layout.tsx:63` is the
	 * precedent and the reasoning.
	 */
	const capsule = useCapsuleScreenOptions();

	if (resolved.state === "boot") return null;
	if (resolved.role !== "delivery") return <Redirect href="/(customer)" />;

	return (
		<Tabs screenOptions={capsule}>
			<Tabs.Screen
				name="delivery"
				options={{
					title: t("delivery.board.title"),
					tabBarAccessibilityLabel: t("delivery.board.title"),
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

			{/* The group's root, and `href: null` rather than a tab: it is the redirect every
		    group href resolves to, so removing it makes `/(delivery)` match no route at all —
		    its own docblock records the Unmatched screen that produced. */}
			<Tabs.Screen name="index" options={deliveryBarlessOptions("index")} />
			{/* The editor, which pins its own docked `ActionBar`, and the far end of a run.
			    Both take the list from `@/components/tab-bar` rather than a bare `href: null`,
			    so declaring a screen here and listing it there cannot drift. */}
			<Tabs.Screen
				name="courier-profile"
				options={deliveryBarlessOptions("courier-profile")}
			/>
			<Tabs.Screen
				name="delivery/[id]"
				options={deliveryBarlessOptions("delivery/[id]")}
			/>
		</Tabs>
	);
}
