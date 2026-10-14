import type { MessageKey } from "@pymeshub/i18n";
import { View } from "react-native";
import { useT } from "@/lib/i18n";
import { space } from "@/theme";
import { Button } from "./button";
import { Text } from "./text";

export function moveItem<T>(
	items: readonly T[],
	index: number,
	direction: -1 | 1,
): T[] {
	const next = [...items];
	const target = index + direction;
	if (target < 0 || target >= next.length) return next;
	const current = next[index];
	const neighbor = next[target];
	if (current === undefined || neighbor === undefined) return next;
	next[index] = neighbor;
	next[target] = current;
	return next;
}

export function CustomizationRows<T extends string>({
	items,
	hidden,
	labels,
	onReorder,
	onToggle,
}: {
	items: readonly T[];
	hidden: readonly T[];
	labels: Record<T, MessageKey>;
	onReorder: (next: T[]) => void;
	onToggle: (item: T) => void;
}) {
	const { t } = useT();
	return (
		<View style={{ gap: space.md }}>
			{items.map((item, index) => (
				<View key={item} style={{ gap: space.xs }}>
					<Text variant="body" bold>
						{t(labels[item])}
					</Text>
					<View
						style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}
					>
						<Button
							variant="secondary"
							label={
								hidden.includes(item)
									? t("customize.show")
									: t("customize.hide")
							}
							onPress={() => onToggle(item)}
							selected={!hidden.includes(item)}
							choiceRole="checkbox"
						/>
						<Button
							variant="secondary"
							label={t("customize.up")}
							disabled={index === 0}
							onPress={() => onReorder(moveItem(items, index, -1))}
							accessibilityHint={t(labels[item])}
						/>
						<Button
							variant="secondary"
							label={t("customize.down")}
							disabled={index === items.length - 1}
							onPress={() => onReorder(moveItem(items, index, 1))}
							accessibilityHint={t(labels[item])}
						/>
					</View>
				</View>
			))}
		</View>
	);
}
