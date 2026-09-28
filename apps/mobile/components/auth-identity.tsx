import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { icon, space, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * The auth group's identity block: the mark, the screen's claim, its subtitle.
 *
 * `welcome` and the two forms composed this same lockup twice — a glyph beside the
 * wordmark, a `display` title, a `label` subtitle — and the two copies agreed until
 * one of them was edited. One component, two postures: centred (the welcome screen,
 * where the block takes the slack) or top (the forms, where the fields follow it).
 *
 * It is not `Screen`'s `title`: the strip renders before the body and is one string,
 * while this is three nodes (`sign-in.tsx` states the case). The gaps paid here are
 * the strip's own (`screen.tsx:220-225`) — `space.md` above the title the caller owns,
 * `space.xs` between title and subtitle here.
 */
export function AuthIdentity({
	title,
	subtitle,
	centered = false,
}: {
	title: string;
	subtitle: string;
	/** Welcome's posture: the block takes the slack and centres its content. */
	centered?: boolean;
}) {
	const { t } = useT();
	const { colors } = useTheme();

	return (
		<View style={[styles.identity, centered && styles.centered]}>
			<View style={styles.mark}>
				<Ionicons
					name="storefront-outline"
					size={icon.action}
					color={colors.primary}
					// Decoration: the wordmark beside it is the name, and a glyph carrying no
					// label of its own is announced as nothing at all.
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
				<Text variant="heading" bold>
					{t("app.name")}
				</Text>
			</View>
			<View>
				<Text variant="display" bold accessibilityRole="header">
					{title}
				</Text>
				<Text variant="label" tone="muted" style={styles.subtitle}>
					{subtitle}
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	identity: { gap: space.md },
	// Welcome's posture: the block takes the slack so the claim sits mid-screen
	// and the action stays at the foot where the thumb is.
	centered: { flex: 1, justifyContent: "center", gap: space.lg },
	mark: { flexDirection: "row", alignItems: "center", gap: space.sm },
	subtitle: { marginTop: space.xs },
});
