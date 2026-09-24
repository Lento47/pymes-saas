/**
 * The design tokens, transcribed from `packages/ui/src/styles/globals.css`.
 *
 * **This file is a copy, not a source.** `packages/ui` and Expo are the one place the
 * "one source of UI" rule cannot hold: every component in that package is shadcn on
 * radix, which is DOM, and React Native renders none of it. The phone therefore gets its
 * own primitives — but it must not get its own *palette*. The same electric ultramarine,
 * the same warm neutrals and the same eight order-status pairs, or the two surfaces stop
 * looking like one product and start looking like two that agree about nothing.
 *
 * ## The merchant tree is the exception, and it is exactly one exception
 *
 * `(business)` — the owner console — draws the warm editorial system instead: ivory canvas,
 * ink, lime reserved for the primary action. Same `ThemeColors` keys, so every component
 * works unchanged; `theme/index.ts` selects the palette by route group. The consumer and
 * delivery trees keep the palette above. Three jobs, two palettes, one key set — a fourth
 * palette anywhere would be a second exception, and those do not stack.
 *
 * Every ratio below was measured, not eyeballed: ink on lime is 16.22:1, `mutedForeground`
 * holds 4.72:1 on `muted` and 5.62:1 on `card`, `input` is 4.59:1 on `card` (3:1 owed),
 * white holds 4.97/4.82/5.50 on success/destructive/info, and the shimmer band is 2.19:1
 * on the block it sweeps. `ring` is ink rather than the lime interface section 6 asks for:
 * lime on ivory is ~1.2:1, which is a focus ring nobody can see, and an invisible focus
 * state breaks the review bar this repo checks every diff against.
 * ## The one conversion
 *
 * `globals.css` writes its colours in `oklch()`. They are hex here, and the conversion is
 * deliberate rather than lazy: React Native's colour parser does not accept `oklch()` on
 * every platform, and a token that renders as a colour on iOS and as a fallback on
 * Android is worse than one that is a rounding error off on both. The hex values below
 * were computed from the same L/C/H triples, so a diff of the two files remains possible.
 *
 * There is no build step that can keep these in step. If a token changes in
 * `globals.css`, it changes here, in the same commit — this comment is the entire
 * mechanism, which is why it is the first thing in the file.
 */

import { Platform } from "react-native";

const light = {
	background: "#fefdfa",
	foreground: "#1f1915",
	card: "#ffffff",
	cardForeground: "#1f1915",
	popover: "#ffffff",
	popoverForeground: "#1f1915",
	// Electric ultramarine, measured both ways it is drawn. `#ffffff` on it is
	// **7.0:1**, and it on `card` is **6.9:1** — past the 4.5 the pair owes in
	// both directions, which matters because the token is also drawn as *ink*
	// (`tone="primary"`: links, chosen chips' words, tab labels, prices that
	// borrow it). Success keeps its own green: brand is never status.
	primary: "#3538f2",
	primaryForeground: "#ffffff",
	secondary: "#f5f2ec",
	secondaryForeground: "#2e2722",
	muted: "#f6f3ed",
	mutedForeground: "#625b54",
	accent: "#ececff",
	accentForeground: "#2426b8",
	// Links, chevrons that carry meaning, glyphs that state something: ink that is
	// *read* rather than a surface that is *pressed*. This is `primary`'s value in
	// the consumer themes and ink in the merchant one, because lime text on ivory
	// is ~1.3:1 — a link nobody can read — while a lime fill with ink text is the
	// pair the interface spec asks for. One token for the two jobs would make every
	// link in the merchant tree a contrast failure or every button one.
	action: "#3538f2",
	destructive: "#d60016",
	destructiveForeground: "#ffffff",
	success: "#10703a",
	successForeground: "#ffffff",
	warning: "#d58d16",
	warningForeground: "#2b1c08",
	info: "#1d60bc",
	infoForeground: "#ffffff",
	// `border` is a decorative hairline and stays light. `input` is not: it is the boundary
	// that tells a customer where a text field begins, which is the "visual information
	// required to identify user interface components" of WCAG 1.4.11, so it owes 3:1 against
	// the surface behind it. The web theme gives the two the same value, and that is the one
	// thing they cannot share here — 1.34:1 is not a control edge, it is a rumour of one.
	// `#948e86` is 3.24:1 on `card` and 3.19:1 on `background`, and keeps the warm cast.
	border: "#e1ded9",
	input: "#948e86",
	// The focus ring, and it follows `primary` rather than being a colour of its own: a ring
	// that is not the primary is a second brand nobody asked for, and the two drifting apart is
	// exactly what a reader would see as a bug.
	ring: "#3538f2",
	// The dim behind a sheet or a dialog, and the reason it is a token rather than
	// `foreground` at an opacity — which is what it was, and which is fine here and wrong in
	// the dark theme. A scrim's job is to make the page behind it *recede*; `foreground` is
	// near-black in the light scheme and near-white in the dark one, so the dark theme's
	// backdrop composited to `#9e9c99` and the panel on top of it read as the darker object,
	// inverting the only relationship a scrim exists to state.
	//
	// Both values are the near-black the light scheme writes its text in and true black, and
	// the opacity that dims them stays at the call site (`components/sheet.tsx`), because how
	// much of the page shows through is the sheet's decision about its own layering.
	scrim: "#1f1915",
	// The band that sweeps a `./skeleton`. Not `border`, which was 1.21:1 on the block it
	// sweeps across — a shimmer nobody can see is a cost with no signal — and not `input`
	// either, which means "the boundary of a control" and would make the shimmer move whenever
	// a text field's edge did. This is decoration with one job: be visible on `muted` and stay
	// quiet. 1.80:1 on the block it sweeps — and the dark theme's is 2.08:1, which is the same
	// band read against a darker block.
	shimmer: "#bdb7af",
	// Order status. Two values per state — the tint a pill sits on and the ink that goes
	// on it — because that is the only shape these are ever used in. `preparing` and
	// `accepted` are close cousins on purpose (minutes apart in the same kitchen) and are
	// told apart by their icon, never by hue alone.
	statusPending: "#fbf1c7",
	statusPendingForeground: "#704a00",
	statusAccepted: "#d7f0ff",
	statusAcceptedForeground: "#07519d",
	statusPreparing: "#f1e7ff",
	statusPreparingForeground: "#613897",
	statusReady: "#bffaf6",
	statusReadyForeground: "#005d5e",
	statusOutForDelivery: "#ffe4ca",
	statusOutForDeliveryForeground: "#8e3c00",
	statusCompleted: "#cef9dc",
	statusCompletedForeground: "#005e31",
	statusCancelled: "#eeede9",
	statusCancelledForeground: "#54524e",
	statusRejected: "#ffe1dc",
	statusRejectedForeground: "#a51f1e",
	// Pricing. The current price is the loudest number in a row, so it has a colour of
	// its own rather than borrowing `foreground`.
	price: "#006533",
	priceCompare: "#6e6862",
	discount: "#c50516",
	discountForeground: "#fff9f8",
	// The star. Its own token rather than `warning`, which happens to share the hue: a
	// rating is not a caution, and sharing a name is how recolouring one recolours both.
	//
	// Darkened twice, on 2026-09-21, and both times by a measurement rather than a taste: the
	// star is a graphical object that carries the rating fact — the number beside it is
	// ambiguous without it — so WCAG 1.4.11 asks 3:1 of it. `#eda922` gave 2.04:1 on `card` and
	// 2.00:1 on `background`. `#c07d00` cleared those at 3.40 and 3.34 **and still failed on
	// `muted`**, where the card's own chip draws it: 3.07:1, seven hundredths over a floor the
	// other two surfaces already met with room. A token that passes on two of the three
	// surfaces it is drawn on is a token that is wrong on one of them. `#b37400` gives **3.50**
	// on `muted`, 3.88 on `card` and 3.81 on `background`, at the same hue.
	// The dark theme's `#f5b845` was already 9.93:1 and is unchanged.
	rating: "#b37400",
} as const;

const dark = {
	background: "#110e0b",
	foreground: "#f5f3f0",
	card: "#1c1815",
	cardForeground: "#f5f3f0",
	popover: "#211d1a",
	popoverForeground: "#f5f3f0",
	primary: "#8b8dff",
	primaryForeground: "#17142e",
	secondary: "#2b2723",
	secondaryForeground: "#f5f3f0",
	muted: "#2b2723",
	mutedForeground: "#a8a29b",
	accent: "#2a2a5e",
	accentForeground: "#e2e2ff",
	action: "#8b8dff",
	destructive: "#ff6367",
	destructiveForeground: "#200e0e",
	success: "#54c57a",
	successForeground: "#09180d",
	warning: "#f2b54a",
	warningForeground: "#251803",
	info: "#5ea8f9",
	infoForeground: "#091521",
	// `border` and `input` are `oklch(1 0 0 / 11%)` and `/ 16%` in the web theme — white
	// at low alpha. They are solid here because React Native cannot blend a border into
	// an unknown parent: the value below is that white composited over `background`.
	//
	// Only `border` still is. `input` is the text field's own edge, so it owes WCAG 1.4.11's
	// 3:1 against the surface it sits on, and the composited alpha gave 1.41:1 on `card` —
	// the field had no boundary a customer could find. `#6b6660` is 3.10:1 on `card` and
	// 3.38:1 on `background`, keeping the warm cast. The light theme's split from `border`
	// is the same change for the same reason; see the note there.
	// Raised from `#2f2b28` on 2026-09-21. The paragraph above is the argument for the *fill*
	// of a card being 1.09:1 against the page — the surface is allowed to be a whisper — and it
	// is not an argument for the card's **edge** being 1.26:1, which is what `#2f2b28` gave on
	// `card` and 1.37:1 on `background`. In this theme the hairline is the only thing separating
	// two stacked cards and the only thing saying where the page ends and a card begins, so it
	// is not decoration here; it is the card. `#474139` gives **1.75:1** on `card`, 1.91:1 on
	// `background` and 1.47:1 on `muted` — still a hairline, no longer invisible.
	border: "#474139",
	input: "#6b6660",
	ring: "#8b8dff",
	statusPending: "#392c07",
	statusPendingForeground: "#f0d186",
	statusAccepted: "#192f46",
	statusAcceptedForeground: "#a1d3ff",
	statusPreparing: "#322843",
	statusPreparingForeground: "#d6c1ff",
	statusReady: "#033633",
	statusReadyForeground: "#87e4de",
	statusOutForDelivery: "#47270f",
	statusOutForDeliveryForeground: "#ffbc84",
	statusCompleted: "#0f3620",
	statusCompletedForeground: "#94e7b1",
	statusCancelled: "#2d2b28",
	statusCancelledForeground: "#c0bdb8",
	statusRejected: "#4e201e",
	statusRejectedForeground: "#ffaea6",
	price: "#76e1a7",
	priceCompare: "#8d8881",
	// Lightened from `#f75d59` on 2026-09-21. The discount ink is drawn on `muted` as often as
	// on `card` — a product row's chip sits on the row, which is `muted` while it is pressed —
	// and `#f75d59` gave **4.70:1** there: over 4.5, and by two tenths, on the one surface the
	// pair is least often drawn on. `#fb6f6b` gives **5.35:1** on `muted` and 6.37:1 on `card`,
	// and its own foreground pair improves with it (6.94:1, up from 6.07:1).
	discount: "#fb6f6b",
	discountForeground: "#1b0a09",
	rating: "#f5b845",
	// See the light theme: the scrim is true black here rather than a dimmed `foreground`,
	// which in this scheme is near-white and made the backdrop the bright object.
	scrim: "#000000",
	// See the light theme. 2.08:1 on the block it sweeps, against the 1.06:1 the shared
	// `border` gave on it — which was not a band, it was a rumour of one.
	shimmer: "#5e574f",
} as const;

export type ColorScheme = "light" | "dark";
export type ThemeColors = { [K in keyof typeof light]: string };

export const palette: Record<ColorScheme, ThemeColors> = { light, dark };

/**
 * The merchant console's palette: warm ivory canvas, ink, lime action.
 *
 * Same keys as `ThemeColors` and no more — that is the whole contract. Every component
 * reads `colors.background` and friends without knowing which tree it is in, so the
 * business screens get the editorial system by mounting under `(business)` and nothing
 * else changes. Functional colours (success, warning, destructive, info, price, discount,
 * rating, the eight status pairs) are interface §7's own values or the existing ones
 * where the doc names none: hue carries meaning in an operational console, so only the
 * neutrals and the action colour move.
 *
 * Scheme-independent by decision rather than by omission: the interface spec draws one
 * warm system and no dark one, and an invented dark merchant theme would be improvisation
 * dressed as coverage. A dark merchant palette is an open item, not a gap — see P0.
 */
export const merchant: ThemeColors = {
	background: "#F6F2E9",
	foreground: "#141217",
	card: "#FCFAF5",
	cardForeground: "#141217",
	popover: "#FCFAF5",
	popoverForeground: "#141217",
	primary: "#D9FF36",
	primaryForeground: "#141217",
	secondary: "#ECE6DC",
	secondaryForeground: "#2e2722",
	muted: "#ECE6DC",
	mutedForeground: "#68636A",
	accent: "#E7E2D5",
	accentForeground: "#141217",
	action: "#141217",
	destructive: "#C84535",
	destructiveForeground: "#ffffff",
	success: "#1A7F5A",
	successForeground: "#ffffff",
	warning: "#D99A22",
	warningForeground: "#2b1c08",
	info: "#4768A9",
	infoForeground: "#ffffff",
	border: "#DDD7CE",
	input: "#79716A",
	ring: "#141217",
	scrim: "#1f1915",
	shimmer: "#A39C90",
	statusPending: "#fbf1c7",
	statusPendingForeground: "#704a00",
	statusAccepted: "#d7f0ff",
	statusAcceptedForeground: "#07519d",
	statusPreparing: "#f1e7ff",
	statusPreparingForeground: "#613897",
	statusReady: "#bffaf6",
	statusReadyForeground: "#005d5e",
	statusOutForDelivery: "#ffe4ca",
	statusOutForDeliveryForeground: "#8e3c00",
	statusCompleted: "#cef9dc",
	statusCompletedForeground: "#005e31",
	statusCancelled: "#eeede9",
	statusCancelledForeground: "#54524e",
	statusRejected: "#ffe1dc",
	statusRejectedForeground: "#a51f1e",
	price: "#006533",
	priceCompare: "#6e6862",
	discount: "#c50516",
	discountForeground: "#fff9f8",
	rating: "#b37400",
};

/**
 * The three radius steps, and no more — `--radius-sm`, `--radius-md`, `--radius-lg`.
 *
 * Controls name a step and never a pixel count, so the scale can move without a sweep
 * like the one that produced it. `rounded-xl` and up resolve to `lg` on the web, so
 * there is deliberately no larger corner to reach for here either.
 */
export const radius = {
	sm: 6,
	md: 12,
	lg: 18,
	full: 9999,
} as const;

/** 4px steps, the same rhythm as `--spacing: 0.25rem` on the web. */
export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 24,
	huge: 32,
} as const;

/**
 * The gap between the lines of one text stack — a row's title, its meta line, its price.
 *
 * 2, and *not* a `space` step, which is the whole reason it is named separately: the scale
 * is the rhythm between elements and this is inside a single one. At `space.xs` a title and
 * the line beneath it read as two paragraphs, and the second line of a row stops being
 * scanned as part of the same thing. `./business-card`, `./product-row` and `./list-row`
 * all stack their bodies at this gap, so it is stated once rather than typed three times.
 */
export const TEXT_STACK_GAP = 2;

/**
 * The phone's own type scale.
 *
 * There is nothing to copy this from: the web's sizes are Tailwind's, resolved per class
 * at each call site. Naming them here is what keeps a `<Text variant="title">` the same
 * size in two screens, and the numbers are the Tailwind steps a web reader would have
 * recognised (`text-3xl` … `text-xs`).
 */
export const type = {
	display: { fontSize: 28, lineHeight: 34 },
	title: { fontSize: 22, lineHeight: 28 },
	heading: { fontSize: 17, lineHeight: 24 },
	body: { fontSize: 15, lineHeight: 21 },
	label: { fontSize: 13, lineHeight: 18 },
	caption: { fontSize: 12, lineHeight: 16 },
} as const;

/**
 * The size a mark is drawn at, named by what the mark is doing.
 *
 * An icon here is one of three things and never a size in itself: a glyph sized against the
 * ink it sits on, or against the box it sits in. That is also why these are not `space`
 * steps — the spacing scale is the air between elements, and a glyph is not air.
 *
 * - `inline` — a mark on a line of text that is not itself a target: the star on a rating,
 *   the shield that says a shop is verified, the glyph inside a status badge. Three files
 *   draw it and all three draw it at the same size, which is what the name is for. The one
 *   exception to "not itself a target" is `./home-header`'s coordinate pin when there is no
 *   fix: the whole meta row is the target there, pin included, so the line's shape never
 *   changes between states — the size is unchanged, only the hit area's ownership.
 * - `control` — the glyph a control draws inside its own target: a text field's magnifier
 *   and its clear, a list row's chevron.
 * - `action` — the glyph inside a box the row has already sized: `./product-tile`'s quick-add
 *   circle, and the stand-in it draws inside a media box holding no photograph
 *   (`./product-row` draws the product's own initial there now, a mark from the type rather
 *   than from this scale). (`./product-row` used to carry the 44pt add target this line
 *   named. The
 *   target was deleted with the callback that never drew it — `lib/cart-mutations.ts`'s
 *   `useQuickAdd` is where a safe one lives now — and the stand-in kept the size.)
 *
 * The marks that are *not* here are the ones whose size comes from the box they fill rather
 * than from a role — the heart in `./favorite-button`, and the stand-ins the other two
 * media densities draw. Those are 22, 22 and 26: three sizes, not one, so they are sized
 * where they are used and this is not pretending to be a complete scale.
 */
export const icon = {
	inline: 15,
	control: 18,
	action: 20,
	// The way back: `./back-button`'s chevron, in its `MIN_TOUCH_TARGET` square. A fourth
	// role rather than `action`'s 20 because it is chrome at the top-left of every pushed
	// screen, and a chevron's glyph carries less built-in padding than a filled mark.
	back: 24,
} as const;

/**
 * The square a `./image` is drawn in, at each density the app has.
 *
 * A picture on a phone is always a fixed square — a logo, a thumbnail — and the row owns
 * that number because the row owns its layout. The row's *skeleton* has to draw the same
 * one, or the swap from grey to content moves the page under the reader, which is the one
 * thing a skeleton exists to prevent. That coupling is why these are tokens:
 * `./business-card` and `app/store/[slug]` draw a logo, `./product-row` draws a thumbnail,
 * and every one of them is mirrored by a block in `./skeletons`. A number duplicated across
 * two owners is a number that drifts, and this one would drift silently — the skeleton
 * would simply be a few points out. Changed here, the row and its skeleton change together.
 *
 * The three are the sizes the app has rather than a scale with room in it: 56 is the logo in
 * a feed, where the card is the unit; 60 is the thumbnail in a menu row, where the name gets
 * two lines; 64 is the logo on a storefront, where it is the page's subject instead of a
 * list item.
 */
export const media = {
	/** `./business-card`'s logo — the same box as `cardStyles.logo` in `./skeletons`. */
	card: 56,
	/** `./product-row`'s thumbnail — the same box as `rowStyles.thumb` in `./skeletons`. */
	row: 60,
	/** `app/store/[slug]`'s logo — the same box as `storeStyles.logo` in `./skeletons`. */
	header: 64,
} as const;

export const weight = {
	regular: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
} as const satisfies Record<string, "400" | "500" | "600" | "700">;

/**
 * Where the weights actually live.
 *
 * React Native resolves a weight through the font family rather than synthesising one, so
 * `fontWeight` is a family choice on Android and iOS alike. Named once here so a screen
 * cannot pick a weight the loaded family does not have.
 */
export const font = {
	semibold: "SemiBold",
	regular: "Regular",
} as const;

/**
 * 44 points, the platform minimum and a floor rather than a suggestion.
 *
 * It is the smallest target a thumb can hit on a moving bus, and every pressable in
 * `components/` sizes against this constant so that "the row is a bit tight" is a
 * decision somebody makes rather than one that happens.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * The disc beside the open/closed word — `./business-card` and `app/store/[slug]` draw it.
 *
 * Two screens say whether a shop is open with the same mark, and neither of them should be
 * the one that owns the size. 7 points: it sits on the same line as the word, at
 * `type.label`'s 13, and is sized to read as a mark on that line rather than as a bullet
 * beside it. That is why it is a number of its own and not a step of the spacing scale —
 * the scale's subject is the air between elements, and this is ink.
 */
export const STATUS_DOT_SIZE = 7;

/**
 * The card lift, expressed the way each platform wants it.
 *
 * iOS draws a `shadow*` set and ignores `elevation`; Android is the reverse, so both are in
 * the native object. The web target is `react-native-web`, which converts that same set to
 * `boxShadow` and warns, on the way, that those props are deprecated. Web is therefore
 * handed the `boxShadow` string that conversion would have produced, exactly — so there is
 * nothing left to convert, nothing to warn about, and the same pixels. `elevation` is left
 * out there, where it was ignored anyway.
 *
 * Android keeps `elevation` rather than using the `boxShadow` React Native also accepts:
 * below API 28 the platform skips an outset `boxShadow` without a word, so the card would
 * go flat with nothing to report it.
 *
 * `components/card.tsx` spreads one of these rather than a screen picking a platform and
 * looking flat on the others.
 */
export const shadow = {
	color: "#000000",
	/**
	 * A card is a surface with a fill nobody can see, so the lift *is* its edge.
	 *
	 * `card` is `#ffffff` and the page behind it is `#fefdfa`: **1.017:1**, in the light
	 * theme. In the dark one `#1c1815` on `#110e0b` is 1.09:1. A card therefore has no
	 * visible fill on either platform, and everything that makes it read as a surface has
	 * to come from the two things around it — this shadow and `./card`'s hairline.
	 *
	 * The hairline **stays**, and that is not an oversight: this shadow is invisible on the
	 * dark theme, because a black shadow on a near-black page is black on black. Where the
	 * light theme gets the lift, the dark one gets the border, and removing either would
	 * leave one of the two themes with a card that is not there.
	 *
	 * This was the `--shadow` step (1px offset, 2px blur, 0.06) — a whisper that at 1.017:1
	 * was doing no work at all. It is now the `--shadow-md` step, which
	 * `packages/ui/src/styles/globals.css` already defines as
	 * `0px 2px 4px -1px hsl(0 0% 0% / 0.08)`, and the web branch below is that same value
	 * written as the `boxShadow` string `react-native-web` would have converted it to. No
	 * new step was invented for this: the card moved up one that already existed, which is
	 * what keeps a mobile card and a web card the same object.
	 */
	card:
		Platform.OS === "web"
			? { boxShadow: "0px 2px 4px -1px rgba(0,0,0,0.08)" }
			: {
					shadowColor: "#000000",
					shadowOpacity: 0.08,
					shadowRadius: 4,
					shadowOffset: { width: 0, height: 2 },
					elevation: 2,
				},
	raised:
		Platform.OS === "web"
			? { boxShadow: "0px 4px 8px rgba(0,0,0,0.08)" }
			: {
					shadowColor: "#000000",
					shadowOpacity: 0.08,
					shadowRadius: 8,
					shadowOffset: { width: 0, height: 4 },
					elevation: 3,
				},
} as const;

/** The former tab bar's height, before the safe-area inset is added to it - now clearance. */
export const TAB_BAR_HEIGHT = 60;

/**
 * The tab bar's other two numbers, and why neither is a `space` or a `type` step.
 *
 * The bar is the one surface in the app that no screen places: React Navigation draws it, at
 * a fixed `TAB_BAR_HEIGHT` plus the home-indicator inset, and everything inside it shares
 * that fixed height — the icon the navigator sizes, the label, the inset. Its numbers are
 * therefore measured against the bar rather than against the app's rhythm, and that is what
 * makes them constants here instead of call-site values in the bar that drew them. The bar is gone with the no-tabs redesign; `TAB_BAR_HEIGHT` survives as the clearance the floating order controls sit at, and all three are pending the bottom-corner stack that gives the cart bar, the order pill, the orders button and the toast one coordinate source.
 *
 * `TAB_BAR_PADDING_TOP` is 6 and it is air *inside* the bar rather than a gap between two
 * elements: the icon and its label have to land centred in the fixed height once the inset
 * has taken its share, and `space.sm`'s 8 spends that air on the label instead.
 * `TAB_BAR_LABEL_SIZE` is 11, one point under `type.caption`'s 12, because the label is the
 * navigator's chrome and not app text — it shares the fixed height with the icon above it,
 * and the caption step leaves it less room there once the reader's text scales.
 *
 * Both are named rather than rounded. Rounding is the tempting fix and it is a visual
 * change: 6 would become `space.sm`'s 8 and 11 would become `type.caption`'s 12, which is
 * two pixels that move and a label that grows — a design decision made by a sweep rather
 * than by anyone looking at the bar.
 */
export const TAB_BAR_PADDING_TOP = 6;
export const TAB_BAR_LABEL_SIZE = 11;

/**
 * The merchant tab bar's own height, before the safe-area inset is added to it.
 *
 * The `(business)` tree's bar is the one tab bar the app now draws, and its height is a
 * bar-measure for the same reason `TAB_BAR_HEIGHT` was: the navigator places it, the icon
 * and its label share the fixed part of it, and no screen beside this layout ever measures
 * it. 82 rather than `TAB_BAR_HEIGHT`'s 60 — this bar carries a label under its icon and
 * the dot marker's breathing room, and it is its own surface with its own measure, read
 * here rather than re-typed in the layout that drew it.
 */
export const BUSINESS_TAB_BAR_HEIGHT = 82;
