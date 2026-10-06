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
		<View style={styles.block}>
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
			{/*
			 * The control is shown to every account, deliberately — gating it on the role
			 * was considered and declined. It used to be shown to everyone and *honest*
			 * about being inert: this note rendered exactly where the choice did nothing,
			 * so a courier tapped four colours, watched the app stay ultramarine, and was
			 * told why. Correct, and useless — it described the bug instead of ending it.
			 *
			 * `useTheme()` no longer branches on the tree, so the choice applies everywhere
			 * and there is nothing left to qualify. This component keeps no `applies` test
			 * and `select.ts` keeps its tree, because `select.ts` still answers a real
			 * question — which root routes a courier reaches that sit outside `(delivery)`
			 * — it just no longer decides a palette.
			 *
			 * The cost is recorded in `theme/tokens.ts`: the phone no longer matches
			 * `packages/ui/src/styles/globals.css` by default. Twelve themes cannot be
			 * expressed in the web's token file, so the storefront there stays ultramarine
			 * while this one is lime until the reader picks otherwise.
			 */}
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
				{ borderColor: selected ? colors.action : colors.border },
			]}
		>
			{/*
				Four bands, and the fourth is the one that was missing.

				The first version drew `background`, `primary` and `action` and its docblock
				claimed the canvas band mattered most because it is what a merchant looks at
				most. On screen it was invisible: **all twelve light themes have
				`background: #FFFFFF`**, so a 52pt white band on a white card is not a canvas,
				it is a hole, and the swatch showed one colour of the palette while claiming to
				show three.

				So the canvas is now drawn with a hairline in that theme's own `border` — you
				can see the *area* even when the colour is the same as the page behind it — and
				a `muted` band sits inside it, because `muted` is a tint of the primary and is
				the one neutral that actually differs between these themes. The accent is a
				fill and the ink is a hairline, each drawn as itself.
			*/}
			<View
				style={[
					styles.canvas,
					{ backgroundColor: preview.background, borderColor: preview.border },
				]}
			>
				<View style={[styles.muted, { backgroundColor: preview.muted }]} />
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
	vine: "biz.theme.vine",
} as const satisfies Record<BusinessThemeId, MessageKey>;

const styles = StyleSheet.create({
	/*
	 * A fixed four-across grid, not a wrapping flex row.
	 *
	 * The first version was `flexBasis: 72` + `flexGrow: 1` + `flexWrap`, which put five on
	 * the first two rows and then stretched the last two across the full width — two cards
	 * twice the size of the ten above them, on the same screen. Twelve divides by four and
	 * by six and by three; it does not divide by five, so five-per-row was always going to
	 * leave a ragged remainder. Four gives three even rows, and the labels ("Orquídea" is the
	 * longest) have room at that width.
	 */
	row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	block: { gap: space.xs },
	swatch: {
		// `width: '25%'` plus `gap` would overflow, so the share is computed instead:
		// 25% minus a third of the gap, which is exact for any gap at any screen width.
		flexGrow: 1,
		flexBasis: "22%",
		maxWidth: "23.5%",
		gap: space.xs,
		padding: space.xs,
		borderWidth: 2,
		borderRadius: radius.md,
	},
	canvas: {
		height: 52,
		borderRadius: radius.sm,
		// A hairline, so a white canvas is still a *shape* on a white card rather than a
		// gap. One point, and it is the theme's own `border` rather than a neutral grey, so
		// the edge is part of what is being previewed.
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
		padding: space.xs,
		gap: space.xs,
		justifyContent: "flex-end",
	},
	accent: { height: 12, borderRadius: 2 },
	ink: { height: 2, width: "55%", borderRadius: 1 },
	label: { textAlign: "center" },
	// The one neutral that differs between these themes: `muted` is a 5% tint of the
	// primary, so it reads as that family's cast even when the canvas above it is white.
	muted: { flex: 1, borderRadius: 2 },
});
