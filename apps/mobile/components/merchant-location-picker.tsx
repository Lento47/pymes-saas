import type { MerchantLocation } from "@pymeshub/shared";
import { ScrollView, StyleSheet, View } from "react-native";

import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

import { Pressable } from "./pressable";
import { Text } from "./text";

export function MerchantLocationPicker({
	locations,
	selectedId,
	onPick,
}: {
	locations: MerchantLocation[];
	selectedId?: string;
	onPick: (locationId: string) => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const selected = locations.find((location) => location.id === selectedId);
	if (!selected) return null;

	return (
		<View style={styles.root}>
			<Text variant="caption" tone="muted" bold>
				{t("biz.locations.title")}
			</Text>
			{locations.length === 1 ? (
				<Text variant="label">
					{selected.name} · {t(`biz.locations.status.${selected.status}`)}
				</Text>
			) : (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.choices}
				>
					{locations.map((location) => {
						const chosen = location.id === selectedId;
						return (
							<Pressable
								key={location.id}
								onPress={() => {
									if (chosen) return;
									selection();
									onPick(location.id);
								}}
								accessibilityRole="tab"
								accessibilityState={{ selected: chosen }}
								accessibilityLabel={`${location.name}, ${t(`biz.locations.status.${location.status}`)}`}
								style={[
									styles.choice,
									{
										backgroundColor: chosen ? colors.primary : colors.muted,
									},
								]}
							>
								<Text variant="label" bold tone={chosen ? "inverse" : "muted"}>
									{location.name}
								</Text>
								<Text variant="caption" tone={chosen ? "inverse" : "muted"}>
									{t(`biz.locations.status.${location.status}`)}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: space.xs },
	choices: { gap: space.sm },
	choice: {
		minHeight: MIN_TOUCH_TARGET,
		justifyContent: "center",
		paddingHorizontal: space.md,
		paddingVertical: space.xs,
		borderRadius: radius.sm,
	},
});
