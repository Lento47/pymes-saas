import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DeliveryCompletionOverlay } from "@/components/delivery-completion-overlay";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import type { FluidMotion } from "@/components/top-fluid-gradient";
import { deliveryFluidColor, purchaseBand } from "@/lib/purchase-colors";
import type { PurchaseStage } from "@/lib/purchase-state";
import { useReducedMotion } from "@/lib/reduced-motion";
import { MIN_TOUCH_TARGET, palette, radius, space, useTheme } from "@/theme";

const STEPS = [
	{
		stage: "browsing",
		label: "Discover",
		detail: "Browse products on the lime home feed.",
	},
	{
		stage: "basket",
		label: "Added to basket",
		detail: "The first item changes the accent while you keep browsing.",
	},
	{
		stage: "inCart",
		label: "Review cart",
		detail:
			"A brighter lime-olive band keeps the cart and its lime actions together.",
	},
	{
		stage: "checkout",
		label: "Checkout",
		detail:
			"Review the order before placing it; this preview cannot submit it.",
	},
	{
		stage: "confirmed",
		label: "Order placed",
		detail: "The order is confirmed and the accent changes to blue.",
	},
	{
		stage: "paid",
		label: "Payment confirmed",
		detail: "A green band marks a successful payment.",
	},
	{
		stage: "delivery",
		label: "Out for delivery",
		detail:
			"The blue is attached to the top; its soft plumes drift and breathe independently.",
	},
] as const satisfies readonly {
	stage: PurchaseStage;
	label: string;
	detail: string;
}[];

export default function PurchasePreview() {
	if (!__DEV__) return <Redirect href="/" />;
	return <DevelopmentPreview />;
}

function DevelopmentPreview() {
	const { stage: requestedStage } = useLocalSearchParams<{ stage?: string }>();
	const [stepIndex, setStepIndex] = useState(() => {
		const requestedIndex = STEPS.findIndex(
			(step) => step.stage === requestedStage,
		);
		return Math.max(0, requestedIndex);
	});
	const [fluidMotion, setFluidMotion] = useState<FluidMotion>("normal");
	const [completionActive, setCompletionActive] = useState(false);
	const [previewDelivered, setPreviewDelivered] = useState(false);
	useEffect(() => {
		const requestedIndex = STEPS.findIndex(
			(step) => step.stage === requestedStage,
		);
		if (requestedIndex >= 0) setStepIndex(requestedIndex);
	}, [requestedStage]);
	const { colors, scheme } = useTheme();
	const { height } = useWindowDimensions();
	const reduceMotion = useReducedMotion();
	const current = STEPS[stepIndex] ?? STEPS[0];

	return (
		<Screen
			title="Purchase journey"
			subtitle="Color and motion preview"
			purchaseStage={previewDelivered ? null : current.stage}
			fluidMotion={fluidMotion}
			scroll
			bottomInset
			contentStyle={{
				paddingTop: height * (current.stage === "delivery" ? 0.26 : 0.22),
			}}
		>
			<Card style={styles.card}>
				<Text variant="caption" tone="muted">
					Visual preview only · no order or payment is created
				</Text>
				<View style={styles.steps} accessibilityRole="radiogroup">
					{STEPS.map((step, index) => {
						const band = purchaseBand(step.stage, colors, scheme);
						const selected = index === stepIndex;
						return (
							<Pressable
								key={step.stage}
								onPress={() => {
									setPreviewDelivered(false);
									setStepIndex(index);
								}}
								accessibilityRole="radio"
								accessibilityLabel={`${index + 1} of ${STEPS.length}: ${step.label}`}
								accessibilityState={{ checked: selected }}
								style={[
									styles.step,
									{
										backgroundColor: band?.color ?? colors.primary,
										borderColor: selected ? colors.foreground : "transparent",
									},
								]}
							>
								<Text
									variant="label"
									bold
									style={{ color: band?.ink ?? colors.primaryForeground }}
								>
									{index + 1}
								</Text>
							</Pressable>
						);
					})}
				</View>
				<Text variant="label" tone="muted">
					Step {stepIndex + 1} of {STEPS.length}
				</Text>
				<Text variant="heading" bold>
					{previewDelivered ? "Delivered" : current.label}
				</Text>
				<Text tone="muted">
					{previewDelivered
						? "The completion wash has finished; the real order now reveals both feedback actions."
						: current.detail}
				</Text>
				{current.stage === "delivery" ? (
					<>
						{previewDelivered ? null : (
							<>
								<Segmented
									label="Fluid motion preview"
									value={fluidMotion}
									onChange={(value) => setFluidMotion(value as FluidMotion)}
									options={[
										{ value: "normal", label: "Animated" },
										{ value: "still", label: "Static" },
										{ value: "reduced", label: "Reduced" },
									]}
								/>
								<Text variant="caption" tone="muted">
									{reduceMotion
										? "System reduced motion is on; the fluid stays still."
										: fluidMotion === "normal"
											? "Independent plumes are moving above."
											: "The fluid keeps its shape without movement."}
								</Text>
							</>
						)}
						<Button
							label="Replay delivered transition"
							onPress={() => {
								setPreviewDelivered(true);
								setCompletionActive(true);
							}}
						/>
						<Button
							label={`Open theme settings (${scheme})`}
							variant="secondary"
							onPress={() => router.push("/settings")}
						/>
					</>
				) : null}
				<View style={styles.actions}>
					<Button
						label="Previous"
						variant="secondary"
						disabled={stepIndex === 0}
						onPress={() => {
							setPreviewDelivered(false);
							setStepIndex((index) => index - 1);
						}}
						style={styles.action}
					/>
					<Button
						label={stepIndex === STEPS.length - 1 ? "Start again" : "Next"}
						onPress={() => {
							setPreviewDelivered(false);
							setStepIndex((index) =>
								index === STEPS.length - 1 ? 0 : index + 1,
							);
						}}
						style={styles.action}
					/>
				</View>
			</Card>
			<DeliveryCompletionOverlay
				active={completionActive}
				color={deliveryFluidColor(colors.info, palette.light.primary, scheme)}
				ink={colors.infoForeground}
				title="Delivered"
				onComplete={() => setCompletionActive(false)}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	card: { gap: space.sm },
	steps: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: space.xs,
		marginVertical: space.md,
	},
	step: {
		width: MIN_TOUCH_TARGET,
		height: MIN_TOUCH_TARGET,
		borderRadius: radius.full,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
	action: { flex: 1 },
});
