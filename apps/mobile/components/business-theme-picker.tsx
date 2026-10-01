import type { MessageKey } from "@pymeshub/i18n";
import { StyleSheet, View } from "react-native";

import { Pressable } from "@/components/pressable";
import { Text } from "@/components/text";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import {
	type BusinessThemeId,
	businessThemeColors,
	businessThemeOrder,
	type ColorScheme,
	radius,
	space,
	type ThemeColors,
	useBusinessTheme,
	useTheme,
} from "@/theme";

/**
 * The merchant theme picker.
 *
 * ## Why swatches and not names
 *
 * A row of four words — Lime, Amber, Coral, Sky — tells a merchant nothing about what
 * choosing one will do to their console, and the whole feature is that the console looks
 * different afterwards. So each option draws three of its own colours: the **canvas** it
 * will put behind everything, the **accent** it spends on the one action per screen, and
 * the **ink** that carries links and chevrons. Those three are the theme's identity, and
 * the other forty-six keys are consequences of them.
 *
 * ## Why the swatch reads its colours from the table, not from constants
 *
 * Each swatch is `businessThemeColors(id, scheme)` composed on the spot, exactly as
 * `useTheme()` composes it. A swatch that hardcoded its own hex could drift from the
 * palette it is previewing, and the failure would be a picker that lies — the worst kind,
 * because it is wrong precisely when someone is trying to trust it.
 *
 * ## Why it shows the *current* scheme
 *
 * The swatch is drawn in the scheme the console is in right now, so choosing a theme shows
 * the merchant the pairing they will actually get. Drawing all eight combinations in one
 * row would be honest and unreadable, and the scheme is one control away anyway.
 */
export function BusinessThemePicker() {
	const { id, setId } = useBusinessTheme();
	const { scheme } = useTheme();
	const { t } = useT();

	return (
		<View style={styles.row}>
			{businessThemeOrder().map((option) => (
				<ThemeSwatch
					key={option}
					id={option}
					scheme={scheme}
					selected={option === id}
					label={t(THEME_LABEL[option])}
					onPress={() => {
						selection();
						setId(option);
					}}
				/>
			))}
		</View>
	);
}

function ThemeSwatch({
	id,
	scheme,
	selected,
	label,
	onPress,
}: {
	id: BusinessThemeId;
	scheme: ColorScheme;
	selected: boolean;
	label: string;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	// The preview is the *other* tree's palette, composed by the same function the console
	// uses, so a swatch cannot describe a theme the console will not draw.
	const preview: ThemeColors = businessThemeColors(id, scheme);

	return (
		<Pressable
			onPress={onPress}
			disabledOpacity={1}
			accessibilityRole="radio"
			accessibilityState={{ selected }}
			accessibilityLabel={label}
			style={[
				styles.swatch,
				{ borderColor: selected ? colors.primary : colors.border },
			]}
		>
			{/*
				Three bands, not one square. The canvas is the largest because it is what the
				merchant will spend the most time looking at; the accent is a fill, so it is
				drawn as a fill; the ink is a hairline, so it is a hairline. Each band is that
				token drawn as itself rather than as an approximation of it.
			*/}
			<View style={[styles.canvas, { backgroundColor: preview.background }]}>
				<View style={[styles.accent, { backgroundColor: preview.primary }]} />
				<View style={[styles.ink, { backgroundColor: preview.action }]} />
			</View>
			<Text
				variant="caption"
				bold={selected}
				numberOfLines={1}
				style={styles.label}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * Display names for the themes.
 *
 * The four are colour words rather than invented product names, because that is what the
 * control is choosing and a name that flatters a palette makes the swatch beside it look
 * like a lie. `businessThemeOrder()` is imported for the assertion below rather than for
 * the render: the map is indexed by `BusinessThemeId`, so a theme added to the list without
 * a label here is a type error rather than a runtime blank.
 */
const THEME_LABEL = {
	lime: "biz.theme.lime",
	amber: "biz.theme.amber",
	coral: "biz.theme.coral",
	sky: "biz.theme.sky",
	sunset: "biz.theme.sunset",
	forest: "biz.theme.forest",
	ocean: "biz.theme.ocean",
	orchid: "biz.theme.orchid",
	citrus: "biz.theme.citrus",
	berry: "biz.theme.berry",
	dune: "biz.theme.dune",
	harbor: "biz.theme.harbor",
} as const satisfies Record<BusinessThemeId, MessageKey>;

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
	swatch: {
		flexGrow: 1,
		flexBasis: 72,
		minWidth: 72,
		gap: space.xs,
		padding: space.xs,
		borderWidth: 2,
		borderRadius: radius.md,
	},
	canvas: {
		height: 52,
		borderRadius: radius.sm,
		padding: space.xs,
		gap: space.xs,
		justifyContent: "flex-end",
	},
	accent: { height: 12, borderRadius: 2 },
	ink: { height: 2, width: "55%", borderRadius: 1 },
	label: { textAlign: "center" },
});
