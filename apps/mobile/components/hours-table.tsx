import { weekdayName } from "@pymeshub/i18n";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { memo, useState } from "react";
import {
	ScrollView,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { formatMinuteOfDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { openingWindowsForDay } from "@/lib/opening-windows";
import { MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";
import { Pressable } from "./pressable";
import { Text } from "./text";

const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** One day at a time, showing only the intervals when customers can visit. */
export const HoursTable = memo(function HoursTable({
	hours,
	isOpen,
	style,
}: {
	hours: readonly BusinessHoursEntry[];
	isOpen: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();
	const today = new Date().getDay();
	const [selectedDay, setSelectedDay] = useState(today);
	if (hours.length === 0) return null;
	const days = WEEK.map((day) => ({ day, name: weekdayName(day, intlLocale) }));
	if (days.some(({ name }) => name === null)) return null;
	const selectedName = days.find(({ day }) => day === selectedDay)?.name ?? "";
	const dayLabel =
		selectedDay === today
			? `${selectedName} · ${t("store.today")}`
			: selectedName;
	const ranges = openingWindowsForDay(hours, selectedDay).flatMap(
		({ opensMinute, closesMinute }) => {
			const opens = formatMinuteOfDay(opensMinute, intlLocale);
			const closes = formatMinuteOfDay(closesMinute, intlLocale);
			return opens && closes ? [`${opens}–${closes}`] : [];
		},
	);
	const schedule = ranges.length > 0 ? ranges.join(" · ") : t("store.closed");
	return (
		<View style={style}>
			<View style={styles.head}>
				<Text variant="heading" bold>
					{t("store.hours")}
				</Text>
				<Text variant="caption" tone="muted">
					{isOpen ? t("store.hours.openNow") : t("store.hours.closedNow")}
				</Text>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={[styles.week, { backgroundColor: colors.muted }]}
				contentContainerStyle={styles.days}
			>
				{days.map(({ day, name }) => {
					const selected = day === selectedDay;
					return (
						<Pressable
							key={day}
							onPress={() => setSelectedDay(day)}
							accessibilityRole="tab"
							accessibilityLabel={
								day === today ? `${name}, ${t("store.today")}` : (name ?? "")
							}
							accessibilityState={{ selected }}
							style={[
								styles.day,
								{
									backgroundColor: selected ? colors.card : "transparent",
									borderColor: selected ? colors.border : "transparent",
								},
							]}
						>
							<Text
								variant="label"
								bold={selected}
								style={{
									color: selected ? colors.foreground : colors.mutedForeground,
									textTransform: "capitalize",
								}}
							>
								{name?.slice(0, 3)}
							</Text>
							<View
								style={[
									styles.todayMark,
									{
										backgroundColor:
											day === today ? colors.foreground : "transparent",
									},
								]}
							/>
						</Pressable>
					);
				})}
			</ScrollView>
			<View
				style={styles.schedule}
				accessible
				accessibilityLiveRegion="polite"
				accessibilityLabel={`${dayLabel}, ${schedule}`}
			>
				<Text variant="caption" tone="muted" style={styles.dayName}>
					{dayLabel}
				</Text>
				{ranges.length > 0 ? (
					<View style={styles.periods}>
						{ranges.map((range) => (
							<Text key={range} variant="heading" bold tabular>
								{range}
							</Text>
						))}
					</View>
				) : (
					<Text variant="heading" bold>
						{schedule}
					</Text>
				)}
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	head: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: space.sm,
		marginBottom: space.sm,
	},
	week: { borderRadius: radius.lg },
	days: { gap: space.xs, padding: space.xs, flexGrow: 1 },
	day: {
		flexGrow: 1,
		minWidth: MIN_TOUCH_TARGET,
		minHeight: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.md,
		borderWidth: 1,
		gap: space.xs,
		paddingHorizontal: space.sm,
		paddingVertical: space.sm,
	},
	todayMark: { width: 12, height: 2, borderRadius: radius.full },
	schedule: { gap: space.xs, paddingTop: space.md },
	periods: {
		flexDirection: "row",
		flexWrap: "wrap",
		columnGap: space.lg,
		rowGap: space.xs,
	},
	dayName: { textTransform: "capitalize" },
});
