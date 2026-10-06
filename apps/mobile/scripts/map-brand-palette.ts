/**
 * Maps the supplied palette onto a theme's 36 values **by the roles the file assigns**, then
 * validates the result.
 *
 * ## Why the roles, and not the hexes
 *
 * The reference is not a list of colours, it is a list of *jobs*. Every swatch carries a usage
 * line - "Primary CTA, active states, brand moments"; "Live / location"; "Depth, dark
 * gradients, pressed states" - and the dark panel is an explicit token table:
 *
 *     Background   #090E1A  #10182B
 *     Brand        #4166F5  #5B7CFF
 *     Live/location #5AD7FF #58E6C5
 *     Premium      #8D72FF
 *     Content      #F7F9FF  #9CA8C7
 *
 * Mapping by role and then measuring is the opposite order from what I did first, and it
 * changes two answers.
 *
 * ## Correction: the dark `primary` does NOT have to be a different colour
 *
 * I previously claimed `#4166F5` could not be the dark fill because it is 4.08:1 against
 * `#090E1A`. That compared the fill to the *page background* and called it a text failure. The
 * pair that actually governs a filled button is `primaryForeground` on `primary` - white on
 * `#4166F5` is **4.73:1**, comfortably AA - and a fill against its surround only needs 3:1,
 * which 4.08 clears. So the brand colour is the dark fill, as the file's own dark panel says.
 * `#5B7CFF` goes to `ring`, where the file's "hover, highlights" belongs and where being
 * brighter is the point.
 *
 * ## Where the file and the platform disagree
 *
 * `#9CA8C7 Steel Mist` is named "Secondary text, metadata, disabled states". On the light
 * canvas it is **2.05:1** on the cloud tint and **2.26:1** on ice white. That is fine for the
 * "disabled states" third of the sentence and short of AA for the "secondary text" first
 * third. Reported rather than quietly fixed.
 *
 * Run: bun run scripts/map-brand-palette.ts
 */
type Scheme = Record<
	| "background"
	| "foreground"
	| "card"
	| "cardForeground"
	| "popover"
	| "popoverForeground"
	| "primary"
	| "primaryForeground"
	| "secondary"
	| "secondaryForeground"
	| "muted"
	| "mutedForeground"
	| "accent"
	| "accentForeground"
	| "action"
	| "border"
	| "ring"
	| "shimmer",
	string
>;

/** Roles, verbatim from the reference's usage lines. */
const ROLE: Record<string, string> = {
	"#4166F5": "Pymes Indigo - primary CTA, active states, brand moments",
	"#5B7CFF": "Electric Indigo - hover, gradients, motion, highlights",
	"#243B9B": "Deep Indigo - depth, dark gradients, pressed states",
	"#5AD7FF": "Aurora Cyan - futuristic accent, maps, live activity",
	"#8D72FF": "Neo Violet - selective gradient accent, premium moments",
	"#58E6C5": "Signal Mint - positive activity, delivery/live signals",
	"#090E1A": "Midnight - dark-mode background",
	"#10182B": "Navy Surface - dark cards, elevated surfaces",
	"#171C2D": "Ink - primary text on light UI",
	"#E9EEFF": "Cloud Indigo - subtle selected backgrounds, dividers",
	"#F7F9FF": "Ice White - main light-mode canvas",
	"#9CA8C7": "Steel Mist - secondary text, metadata, disabled states",
	"#36D399": "Success - delivered, available, successful payment",
	"#FFBF5B": "Attention - waiting, preparation, caution",
	"#FF7A68": "Promo Coral - promotions only",
	"#FF5D73": "Critical - errors, failed payment, destructive",
};

const rgb = (hex: string): [number, number, number] => {
	const v = hex.replace("#", "");
	return [
		Number.parseInt(v.slice(0, 2), 16),
		Number.parseInt(v.slice(2, 4), 16),
		Number.parseInt(v.slice(4, 6), 16),
	];
};
const toHex = (c: number) =>
	Math.round(Math.min(255, Math.max(0, c)))
		.toString(16)
		.padStart(2, "0");
const mix = (a: string, b: string, w: number) => {
	const [ar, ag, ab] = rgb(a);
	const [br, bg, bb] = rgb(b);
	return `#${toHex(ar + (br - ar) * w)}${toHex(ag + (bg - ag) * w)}${toHex(ab + (bb - ab) * w)}`;
};
const lin = (c: number) => {
	const v = c / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
	const [r = 0, g = 0, b = 0] = rgb(hex).map(lin);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
	const la = lum(a);
	const lb = lum(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** The lightest ink that still clears `target` on `against`, mixed from `from` toward it. */
const solve = (
	from: string,
	toward: string,
	against: string,
	target: number,
) => {
	let best = from;
	for (let i = 1000; i >= 0; i -= 1) {
		const hex = mix(from, toward, i / 1000);
		if (ratio(hex, against) >= target) {
			best = hex;
			break;
		}
	}
	return best;
};

const LIGHT_TINT = "#E9EEFF";
const DARK_TINT = mix("#10182B", "#4166F5", 0.18);

const light: Scheme = {
	// "Main light-mode canvas"
	background: "#F7F9FF",
	// "Primary text on light UI"
	foreground: "#171C2D",
	// Cards lift off the tinted canvas, so they are the one near-white the file does not name.
	card: "#FFFFFF",
	cardForeground: "#171C2D",
	popover: "#FFFFFF",
	popoverForeground: "#171C2D",
	// "Primary CTA, active states, brand moments"
	primary: "#4166F5",
	// Pure white, NOT ice white: 4.73:1 against #FFFFFF, 4.49:1 against #F7F9FF.
	primaryForeground: "#FFFFFF",
	// "Subtle selected backgrounds, dividers"
	secondary: LIGHT_TINT,
	secondaryForeground: "#171C2D",
	muted: LIGHT_TINT,
	// Solved, not chosen: the file's Steel Mist is 2.05:1 here. See the header.
	mutedForeground: solve("#171C2D", LIGHT_TINT, LIGHT_TINT, 4.5),
	// "Selective gradient accent, premium moments" - as a surface tint.
	accent: mix("#8D72FF", "#F7F9FF", 0.88),
	accentForeground: "#171C2D",
	// The file names no link ink. Deep Indigo is the only supplied colour that clears 4.5:1 on
	// a light card (9.18:1), and "depth" is close enough to a recessive ink to use it here.
	action: "#243B9B",
	border: "#171C2D14",
	ring: "#4166F5",
	shimmer: solve("#171C2D", LIGHT_TINT, LIGHT_TINT, 3),
};

const dark: Scheme = {
	// "Dark-mode background"
	background: "#090E1A",
	// "Content"
	foreground: "#F7F9FF",
	// "Dark cards, elevated surfaces"
	card: "#10182B",
	cardForeground: "#F7F9FF",
	popover: mix("#10182B", "#4166F5", 0.1),
	popoverForeground: "#F7F9FF",
	// The brand colour, per the dark panel's own "Brand" row. White on it is 4.73:1.
	primary: "#4166F5",
	primaryForeground: "#FFFFFF",
	secondary: DARK_TINT,
	secondaryForeground: "#F7F9FF",
	muted: DARK_TINT,
	// Steel Mist clears 6.17:1 on the dark tint, so here the file's own value is used.
	mutedForeground: "#9CA8C7",
	// "Depth, dark gradients, pressed states"
	accent: "#243B9B",
	accentForeground: "#F7F9FF",
	// "Futuristic accent, maps, live activity" - 11.57:1 on midnight.
	action: "#5AD7FF",
	border: mix("#F7F9FF", "#090E1A", 0.86),
	// "Hover, gradients, motion, highlights" - and a focus ring wants to be the brighter one.
	ring: "#5B7CFF",
	shimmer: mix("#090E1A", "#F7F9FF", 0.28),
};

const PAIRS: readonly [keyof Scheme, keyof Scheme, string, number][] = [
	["primary", "primaryForeground", "ink on the fill", 4.5],
	["foreground", "background", "body text", 4.5],
	["cardForeground", "card", "text on a card", 4.5],
	["mutedForeground", "muted", "muted text", 4.5],
	["secondaryForeground", "secondary", "text on secondary", 4.5],
	["accentForeground", "accent", "text on accent", 4.5],
	["action", "card", "action ink", 4.5],
	["popoverForeground", "popover", "text in a popover", 4.5],
];

/** Non-text contrast: a fill against its surround, and the focus ring. */
const NON_TEXT: readonly [
	keyof Scheme,
	keyof Scheme,
	keyof Scheme,
	string,
	number,
][] = [
	[
		"primary",
		"background",
		undefined as never,
		"fill vs the page behind it",
		3,
	],
	["ring", "background", undefined as never, "focus ring vs the page", 3],
];

for (const [name, s] of [
	["LIGHT", light],
	["DARK", dark],
] as const) {
	console.log(`\n  ${name}`);
	console.log("  " + "-".repeat(68));
	let bad = 0;
	for (const [fg, bg, what, bar] of PAIRS) {
		const r = ratio(s[fg], s[bg]);
		if (r < bar) bad += 1;
		console.log(
			`    ${what.padEnd(28)} ${String(s[fg]).padEnd(10)} on ${String(s[bg]).padEnd(10)} ${r.toFixed(2).padStart(6)}:1  ${r >= bar ? "AA" : "FAIL"}`,
		);
	}
	for (const [a, b, , what, bar] of NON_TEXT) {
		const r = ratio(s[a], s[b]);
		if (r < bar) bad += 1;
		console.log(
			`    ${what.padEnd(28)} ${String(s[a]).padEnd(10)} on ${String(s[b]).padEnd(10)} ${r.toFixed(2).padStart(6)}:1  ${r >= bar ? "3:1 ok" : "FAIL"}`,
		);
	}
	console.log(`    -> ${bad === 0 ? "all clear" : `${bad} FAILING`}`);
}

console.log("\n\n  the twelve core colours, placed by their stated role:\n");
const PLACED: Record<string, string> = {
	"#4166F5": "light.primary, light.ring, dark.primary",
	"#5B7CFF": "dark.ring",
	"#243B9B": "light.action, dark.accent",
	"#5AD7FF": "dark.action",
	"#8D72FF": "light.accent, at 12% - a tint, not a value",
	"#58E6C5": "not in the 18 - see below",
	"#090E1A": "dark.background",
	"#10182B": "dark.card",
	"#171C2D": "every light foreground",
	"#E9EEFF": "light.secondary, light.muted",
	"#F7F9FF": "light.background, every dark foreground",
	"#9CA8C7": "dark.mutedForeground - not on light, see the header",
};
for (const hex of Object.keys(ROLE)) {
	if (
		hex === "#36D399" ||
		hex === "#FFBF5B" ||
		hex === "#FF7A68" ||
		hex === "#FF5D73"
	)
		continue;
	console.log(`    ${hex}  ${PLACED[hex] ?? "** UNPLACED **"}`);
	console.log(`      ${ROLE[hex]}`);
}

console.log(
	"\n  the four semantic accents, which have no slot in the theme's 18:",
);
for (const hex of ["#36D399", "#FFBF5B", "#FF7A68", "#FF5D73"]) {
	console.log(`    ${hex}  ${ROLE[hex]}`);
}
