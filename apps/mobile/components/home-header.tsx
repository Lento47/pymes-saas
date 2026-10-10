import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	shadow,
	space,
	useTheme,
} from "@/theme";

import { Image } from "./image";
import { hitSlopFor, Pressable } from "./pressable";
import { Text } from "./text";

/**
 * Home identity row: who this order is for, where it goes, inbox, account.
 *
 * The editorial spec's split brand wordmark is not drawn. The greeting is the first
 * line; the location row is the second, left-aligned with it. Bell and avatar sit on the
 * right, on the theme form.
 *
 * Location copy stays honest: the API has no reverse geocoding, so this line never invents
 * a city. The picker is the same `HomeLocationPicker` the feed already owned.
 */
export function HomeHeader({
	locationLabel,
	onLocationPress,
	name,
	avatarUrl,
	onAvatarPress,
	onNotificationsPress,
}: {
	locationLabel: string;
	onLocationPress: () => void;
	name: string | null;
	avatarUrl: string | null;
	onAvatarPress: () => void;
	onNotificationsPress: () => void;
}) {
	const { colors } = useTheme();
	const { t } = useT();

	const initials = name
		? name
				.trim()
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part.charAt(0).toUpperCase())
				.join("")
		: null;

	return (
		<View style={styles.wrap}>
			<View style={styles.stack}>
				<Text variant="title" bold style={styles.title} numberOfLines={1}>
					{name ? t("home.greeting", { name }) : t("home.greeting.anon")}
				</Text>
				<Pressable
					onPress={onLocationPress}
					accessibilityRole="button"
					accessibilityLabel={`${t("discovery.hero.deliverTo")} · ${locationLabel}`}
					accessibilityHint={t("location.changeHelp")}
					hitSlop={hitSlopFor(18)}
					style={styles.coordinate}
				>
					<Ionicons
						name="location"
						size={16}
						color={colors.foreground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
					<Text variant="label" style={styles.coordinateText} numberOfLines={1}>
						{locationLabel}
					</Text>
					<Ionicons
						name="chevron-down"
						size={14}
						color={colors.foreground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
			</View>

			<View style={styles.actions}>
				<Pressable
					onPress={onNotificationsPress}
					accessibilityRole="button"
					accessibilityLabel={t("inbox.title")}
					accessibilityHint={t("account.inbox.help")}
					style={[styles.bell, shadow.card, { backgroundColor: colors.card }]}
				>
					<Ionicons
						name="notifications-outline"
						size={icon.action}
						color={colors.foreground}
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Pressable>
				<Pressable
					onPress={onAvatarPress}
					accessibilityRole="button"
					accessibilityLabel={name ?? t("account.title")}
					accessibilityHint={name ? t("home.greeting.avatar.help") : undefined}
					style={styles.avatarTarget}
				>
					<Image
						uri={avatarUrl}
						radiusToken="full"
						style={[styles.avatar, { borderColor: colors.card }]}
						accessibilityElementsHidden
						importantForAccessibility="no"
					>
						{avatarUrl ? null : (
							<Text variant="caption" tone="action" bold>
								{initials}
							</Text>
						)}
					</Image>
				</Pressable>
			</View>
		</View>
	);
}

const BELL = 48;
const AVATAR = 44;

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		alignItems: "flex-start",
		paddingHorizontal: space.xxl,
		paddingTop: space.md,
		gap: space.md,
	},
	stack: { flex: 1, gap: 7, minWidth: 0 },
	title: { flexShrink: 1, fontSize: 24, lineHeight: 28 },
	coordinate: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 8,
	},
	coordinateText: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 11,
	},
	bell: {
		width: BELL,
		height: BELL,
		borderRadius: radius.full,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	avatarTarget: {
		width: Math.max(AVATAR, MIN_TOUCH_TARGET),
		height: Math.max(AVATAR, MIN_TOUCH_TARGET),
		alignItems: "center",
		justifyContent: "center",
	},
	avatar: {
		width: AVATAR,
		height: AVATAR,
		borderRadius: radius.full,
		borderWidth: 2,
	},
});
