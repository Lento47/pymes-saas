import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	findNodeHandle,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/lib/i18n";
import { markMerchantGuideSeen } from "@/lib/merchant-guide";
import { useReducedMotion } from "@/lib/reduced-motion";
import { radius, space, useTheme } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";

type GuideDestination = "orders" | "pin" | "delivery" | "products" | "plans";

type GuideStep = {
	icon: React.ComponentProps<typeof Ionicons>["name"];
	title:
		| "biz.guide.orders.title"
		| "biz.guide.delivery.title"
		| "biz.guide.products.title";
	body:
		| "biz.guide.orders.body"
		| "biz.guide.delivery.body"
		| "biz.guide.products.body";
	actions: GuideDestination[];
};

const STEPS: [GuideStep, GuideStep, GuideStep] = [
	{
		icon: "receipt-outline",
		title: "biz.guide.orders.title",
		body: "biz.guide.orders.body",
		actions: ["orders"],
	},
	{
		icon: "location-outline",
		title: "biz.guide.delivery.title",
		body: "biz.guide.delivery.body",
		actions: ["pin", "delivery"],
	},
	{
		icon: "storefront-outline",
		title: "biz.guide.products.title",
		body: "biz.guide.products.body",
		actions: ["products", "plans"],
	},
];

const ACTION_LABELS = {
	orders: "biz.guide.openOrders",
	pin: "biz.guide.setPin",
	delivery: "biz.guide.deliverySettings",
	products: "biz.guide.openProducts",
	plans: "biz.guide.viewPlans",
} as const;

function openDestination(
	destination: GuideDestination,
	businessId: string,
): void {
	switch (destination) {
		case "orders":
			router.push("/(business)/business");
			break;
		case "pin":
			router.push({
				pathname: "/(business)/shop-location",
				params: { businessId },
			});
			break;
		case "delivery":
			router.push({ pathname: "/business-delivery", params: { businessId } });
			break;
		case "products":
			router.push({ pathname: "/(business)/products", params: { businessId } });
			break;
		case "plans":
			router.push({ pathname: "/(business)/payouts", params: { businessId } });
			break;
	}
}

export function MerchantGuide({
	open,
	businessId,
	onClose,
}: {
	open: boolean;
	businessId: string;
	onClose: () => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const { width, height, fontScale } = useWindowDimensions();
	const stackFooter = width < 350 || fontScale >= 2;
	const reducedMotion = useReducedMotion();
	const [stepIndex, setStepIndex] = useState(0);
	const titleRef = useRef<View>(null);
	const step = STEPS[stepIndex] ?? STEPS[0];
	const stepTitle = t(step.title);

	useEffect(() => {
		if (!open) {
			setStepIndex(0);
			return;
		}
		const handle = setTimeout(() => {
			const node = findNodeHandle(titleRef.current);
			if (node) AccessibilityInfo.setAccessibilityFocus(node);
		}, 250);
		return () => clearTimeout(handle);
	}, [open]);

	const close = () => {
		void markMerchantGuideSeen(businessId);
		onClose();
	};
	const goTo = (destination: GuideDestination) => {
		close();
		requestAnimationFrame(() => openDestination(destination, businessId));
	};
	const next = () => {
		if (stepIndex === STEPS.length - 1) {
			close();
			return;
		}
		const nextIndex = stepIndex + 1;
		setStepIndex(nextIndex);
		AccessibilityInfo.announceForAccessibility(
			`${t("biz.guide.progress", { current: nextIndex + 1, total: STEPS.length })}. ${t(STEPS[nextIndex]?.title ?? STEPS[0].title)}`,
		);
	};

	return (
		<Modal
			visible={open}
			transparent
			presentationStyle="overFullScreen"
			statusBarTranslucent
			navigationBarTranslucent
			animationType={reducedMotion ? "none" : "fade"}
			onRequestClose={close}
		>
			<View
				style={[
					styles.root,
					{
						paddingTop: insets.top + space.md,
						paddingBottom: insets.bottom + space.md,
					},
				]}
			>
				<Pressable
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: colors.scrim, opacity: 0.32 },
					]}
					onPress={close}
					accessibilityRole="button"
					accessibilityLabel={t("biz.guide.skip")}
				/>
				<View
					style={[
						styles.dialog,
						{
							width: Math.min(width - space.lg * 2, 420),
							maxHeight: height - insets.top - insets.bottom - space.md * 2,
							backgroundColor: colors.card,
							borderColor: colors.border,
						},
					]}
					accessibilityViewIsModal
					accessibilityLabel={t("biz.guide.title")}
					accessibilityRole="none"
					accessibilityLiveRegion="polite"
					onAccessibilityEscape={close}
				>
					<ScrollView contentContainerStyle={styles.content}>
						<Text variant="caption" tone="muted" bold>
							{t("biz.guide.progress", {
								current: stepIndex + 1,
								total: STEPS.length,
							})}
						</Text>
						<Ionicons
							name={step.icon}
							size={40}
							color={colors.primary}
							accessible={false}
						/>
						<View ref={titleRef} accessible accessibilityRole="header">
							<Text variant="title" bold>
								{stepTitle}
							</Text>
						</View>
						<Text>{t(step.body)}</Text>
						<View style={styles.actions}>
							{step.actions.map((destination, index) => (
								<Button
									key={destination}
									label={t(ACTION_LABELS[destination])}
									variant={index === 0 ? "primary" : "secondary"}
									fullWidth
									onPress={() => goTo(destination)}
								/>
							))}
						</View>
						<View
							style={[styles.footer, stackFooter ? styles.footerStack : null]}
						>
							<Button
								label={t("biz.guide.skip")}
								variant="ghost"
								fullWidth={stackFooter}
								onPress={close}
							/>
							<Button
								label={t(
									stepIndex === STEPS.length - 1
										? "biz.guide.done"
										: "biz.guide.next",
								)}
								variant="secondary"
								fullWidth={stackFooter}
								onPress={next}
							/>
						</View>
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, alignItems: "center", justifyContent: "center" },
	dialog: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: radius.lg,
		overflow: "hidden",
	},
	content: { padding: space.lg, gap: space.md },
	actions: { gap: space.sm, marginTop: space.xs },
	footer: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: space.sm,
	},
	footerStack: { flexDirection: "column-reverse" },
});
