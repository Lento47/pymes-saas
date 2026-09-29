/**
 * What the merchant surface keeps beyond the palette.
 *
 * The palette itself has moved to `./tokens.ts`: `merchant` is a `ThemeColors` there, and
 * `./index.ts`'s `useTheme()` hands it to the owner console, so the warm system arrives with
 * the tree rather than being passed down and no screen names a colour. Which tree the reader is
 * in gets decided in `./select.ts`, by route *and* by role — the role half is what gives a
 * merchant the right palette on the boot frame and on the root routes all three trees share.
 * `./index.ts`'s docblock is where the warm system is argued — ivory
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
	/**
	 * The heading of a question the merchant has to answer, in a panel.
	 *
	 * **Larger than `section` and tighter than it, which is the whole of it.** 24 against the
	 * shared `title` step's 22, on a 29pt line against that step's 28, with negative tracking —
	 * the question is the only thing on the panel that is *about* something, and a heading set
	 * at the same size as the body beneath it is a caption that grew.
	 *
	 * **The negative `letterSpacing` is the part with no precedent**, because no step in
	 * `./tokens.ts` carries tracking: the shared scale was transcribed from the web's Tailwind
	 * sizes, and the one number here is not in `globals.css`. It is written here rather than
	 * at the call site for the reason `./tokens.ts` gives about a copy that is not a source —
	 * two callers reading the same heading must get the same tracking, and a value typed
	 * beside one call site is a value the next call site retypes differently. See
	 * `components/sign-out-sheet.tsx`, which is the only reader today.
	 */
	prompt: { fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
	/**
	 * The sentence under a prompt, and the one place a merchant panel is set *below* the
	 * shared `body` step.
	 *
	 * 14 on 20, between `body` (15/21) and `label` (13/18), for a line that has to hold at
	 * two: it is the explanation of what is about to happen, so it is read at a size that
	 * invites reading rather than at one that reports. `mutedForeground` is the ink and the
	 * sheet's own file owns that choice, because a colour is a decision about a surface and
	 * a size is not.
	 */
	explain: { fontSize: 14, lineHeight: 20 },
} as const;
