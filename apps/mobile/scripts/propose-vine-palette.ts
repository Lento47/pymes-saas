/**
 * Proposes and validates the `vine` theme - a Family C Quartet in the indigo -> violet -> vine
 * direction.
 *
 * ## What the family actually guarantees
 *
 * The `tokens.ts` docblock calls Family C "triadic", and the four existing Quartets are not:
 * measured angular separations run from 4 degrees (dune) to 146 (citrus). So hue geometry is
 * not the constraint worth designing to. What all four *do* share is measured contrast:
 *
 *   - `primary` takes whichever ink clears AA best - citrus takes near-black at 8.79:1 while
 *     berry takes white at 6.32:1, so the family does not fix the ink per scheme, it picks it.
 *   - `action` clears 4.5:1 on card in all four: 5.47, 6.39, 6.79, 8.65.
 *   - cool primaries are paired with a warm or deep `action` in every instance.
 *
 * This script designs to those, and prints every ratio so the palette can be reviewed on
 * numbers rather than on a screenshot.
 *
 * Run: bun run scripts/propose-vine-palette.ts
 */
interface Scheme {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	action: string;
	border: string;
	ring: string;
	shimmer: string;
}

const PROPOSAL: Record<"light" | "dark", Scheme> = {
	light: {
		background: "#FFFFFF",
		foreground: "#141220",
		card: "#FFFFFF",
		cardForeground: "#141220",
		popover: "#FFFFFF",
		popoverForeground: "#141220",
		primary: "#4F46E5",
		primaryForeground: "#FFFFFF",
		secondary: "#F3F2FC",
		secondaryForeground: "#211E33",
		muted: "#F3F2FC",
		mutedForeground: "#686479",
		accent: "#E7E5FB",
		accentForeground: "#141220",
		action: "#8A5200",
		border: "#14122014",
		ring: "#4F46E5",
		shimmer: "#BFC0CE",
	},
	dark: {
		background: "#0C0B14",
		foreground: "#F5F5F8",
		card: "#191826",
		cardForeground: "#F5F5F8",
		popover: "#23212F",
		popoverForeground: "#F5F5F8",
		primary: "#818CF8",
		primaryForeground: "#0C0B14",
		secondary: "#272534",
		secondaryForeground: "#F5F5F8",
		muted: "#272534",
		mutedForeground: "#A5A3B4",
		accent: "#221F4A",
		accentForeground: "#F3F3F6",
		action: "#D9A441",
		border: "#312F40",
		ring: "#F5F5F8",
		shimmer: "#47455A",
	},
};

const rgb = (hex: string) => {
	const v = hex.replace("#", "");
	return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16));
};
const lin = (c: number) => {
	const v = c / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
	const [r, g, b] = rgb(hex).map(lin);
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const ratio = (a: string, b: string) => {
	const la = lum(a);
	const lb = lum(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const hsl = (hex: string) => {
	// A tuple rather than `map`: destructuring a `number[]` leaves every element possibly
	// undefined under this tsconfig, which is three `?? 0`s of noise in a colour routine.
	const [r0 = 0, g0 = 0, b0 = 0] = rgb(hex).map((v) => v / 255);
	const max = Math.max(r0, g0, b0);
	const min = Math.min(r0, g0, b0);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return `${String(0).padStart(3)}deg`;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h =
		max === r0
			? (g0 - b0) / d
			: max === g0
				? (b0 - r0) / d + 2
				: (r0 - g0) / d + 4;
	h *= 60;
	if (h < 0) h += 360;
	return `${String(Math.round(h)).padStart(3)}deg ${String(Math.round(s * 100)).padStart(3)}% ${String(Math.round(l * 100)).padStart(3)}%`;
};

/** The pairs a reader actually sees, with the bar each one has to clear. */
const PAIRS: readonly [keyof Scheme, keyof Scheme, string, number][] = [
	["primary", "primaryForeground", "ink on the fill", 4.5],
	["foreground", "background", "body text on the page", 4.5],
	["cardForeground", "card", "text on a card", 4.5],
	["mutedForeground", "muted", "muted text", 4.5],
	["secondaryForeground", "secondary", "text on secondary", 4.5],
	["accentForeground", "accent", "text on accent", 4.5],
	["action", "card", "action ink (links, chevrons)", 4.5],
	["popoverForeground", "popover", "text in a popover", 4.5],
];

for (const scheme of ["light", "dark"] as const) {
	const s = PROPOSAL[scheme];
	console.log(`\n  ${scheme.toUpperCase()}`);
	console.log("  " + "-".repeat(72));
	let failures = 0;
	for (const [fg, bg, what, bar] of PAIRS) {
		const value = ratio(s[fg] ?? "", s[bg] ?? "");
		const ok = value >= bar;
		if (!ok) failures += 1;
		console.log(
			`    ${what.padEnd(30)} ${String(s[fg]).padEnd(9)} on ${String(s[bg]).padEnd(9)} ${value.toFixed(2).padStart(6)}:1  ${ok ? "AA" : "FAIL"}`,
		);
	}
	// Body text is the one pair worth pushing past AA for.
	const body = ratio(s.foreground, s.background);
	if (body >= 7)
		console.log(`    (body text clears AAA at ${body.toFixed(2)}:1)`);
	console.log(`    primary ${s.primary} is ${hsl(s.primary)}`);
	console.log(`    action  ${s.action} is ${hsl(s.action)}`);
	console.log(
		`    -> ${failures === 0 ? "all pairs clear AA" : `${failures} FAILING`}`,
	);
}

console.log("\n\n  paste into theme/tokens.ts:");
for (const scheme of ["light", "dark"] as const) {
	const s = PROPOSAL[scheme];
	console.log(`\n\t\t${scheme}: {`);
	for (const [k, v] of Object.entries(s)) {
		console.log(`\t\t\t${k}: "${v}",`);
	}
	console.log("\t\t},");
}
