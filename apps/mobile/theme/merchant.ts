/**
 * What the merchant surface keeps beyond the palette.
 *
 * The palette itself has moved to `./tokens.ts`: `merchant` is a `ThemeColors` there, and
 * `./index.ts`'s `useTheme()` hands it to any route whose first segment is `(business)`,
 * so the owner console switches palettes with the stroke it switches routes and no screen
 * passes colours down. That file's docblock is where the warm system is argued — ivory
 * canvas, ink, lime reserved for the moment's one action — and it is light-only by design,
 * because the interface spec draws one warm system and an invented dark merchant theme
 * would be improvisation dressed as coverage.
 *
 * This file used to hold a second copy of all of that (`merchantLight`, `merchantDark`,
 * `merchantPalette`, `useMerchantTheme`, the scheme it keyed off). It is deleted rather
 * than kept as a fallback, for the reason `./index.ts` gives about `useThemeMode`: a
 * second source for one fact is how the two come to disagree, and the route-group
 * selection means there is nothing left to select. What stays here is what `ThemeColors`
 * cannot carry — it names keys, never pairs, so the pairing of a status chip's fill to
 * its ink has to live somewhere — and the merchant type steps, which are sizes and not
 * colours.
 */

import type { OrderStatus } from "@pymeshub/shared";

import type { ThemeColors } from "./tokens";

/**
 * A status chip as the contract draws it: a fill and the ink on it, and nothing else.
 *
 * Both sides name `ThemeColors` keys rather than hex, so the chip is rendered by the same
 * `useTheme()` call the rest of the screen reads and the pairing cannot outlive the
 * palette it was measured against.
 */
export type ChipPair = {
	bg: keyof ThemeColors;
	fg: keyof ThemeColors;
};

/**
 * An order's state, as the chip the queue and the board draw it.
 *
 * `PENDING` is the one state that takes the lime (interface.md §18, on the same grounds
 * §6 reserves lime for the moment's one action): it is the only state that asks the
 * operator to do something, and "needs your response" is the one thing on the board
 * allowed to shout. Every other state is already in motion or already decided, so it
 * sits on its own soft pair from the palette's eight — hue carries the meaning there,
 * and the pair's fill/ink split carries the contrast, which a lime word on ivory could
 * never do.
 */
export const orderChip: Record<OrderStatus, ChipPair> = {
	PENDING: { bg: "primary", fg: "primaryForeground" },
	ACCEPTED: { bg: "statusAccepted", fg: "statusAcceptedForeground" },
	PREPARING: { bg: "statusPreparing", fg: "statusPreparingForeground" },
	READY: { bg: "statusReady", fg: "statusReadyForeground" },
	OUT_FOR_DELIVERY: {
		bg: "statusOutForDelivery",
		fg: "statusOutForDeliveryForeground",
	},
	COMPLETED: { bg: "statusCompleted", fg: "statusCompletedForeground" },
	CANCELLED: { bg: "statusCancelled", fg: "statusCancelledForeground" },
	REJECTED: { bg: "statusRejected", fg: "statusRejectedForeground" },
} as const;

/**
 * The merchant type steps — the three sizes the console adds to the app's six
 * (`./tokens.ts`'s `type`).
 *
 * Body, label and caption are the shared steps, which keeps a merchant row reading as the
 * same family of text as the rest of the app; what the operational band adds is the
 * **metric** pair, the numbers of the operational band, and a section title between the
 * app's `title` and `heading`. All three take `tabular-nums` at the call site: currency,
 * order counts and times are scanned as columns, and proportional digits make that scan
 * miss.
 */
export const merchantType = {
	/** The band's headline figure: "₡428.500". */
	metric: { fontSize: 34, lineHeight: 40 },
	/** The secondary figure: "42". */
	metricSmall: { fontSize: 27, lineHeight: 32 },
	/** A section's title: "PEDIDOS AHORA". */
	section: { fontSize: 20, lineHeight: 24 },
} as const;
