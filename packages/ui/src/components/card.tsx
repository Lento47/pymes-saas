import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn("flex flex-col gap-3", className)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header grid auto-rows-min items-center gap-x-4 gap-y-1 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] sm:has-data-[slot=card-description]:grid-rows-[auto_auto]",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * `lg` is the prominent size, `default` the label.
 *
 * Most cards hold a form or a list and their title names what is in them, so it
 * stays where it is. A card that heads a block of a page instead — the account
 * page's panels, the cart's summary — was writing `text-base` at the call site
 * to stand above the page's own text, which is this variant.
 *
 * That first line used to read "`lg` is the heading", which was `lg` read as an element: with
 * `CardTitle` rendering a `<div>`, a larger size was the only claim to heading anything on
 * the page had. It renders a real heading now — see {@link CardTitle} — so this variant is
 * only the size, and the level is a prop there.
 */
const cardTitleVariants = cva("text-pretty font-medium", {
	variants: {
		size: {
			default: "text-sm",
			lg: "text-base",
		},
	},
	defaultVariants: { size: "default" },
});

/**
 * The card's title — a real heading, not a `<div>` styled like one.
 *
 * It rendered a `<div>` until this was measured: **no `CardTitle` in the product was in the
 * accessibility tree as a heading**, so heading navigation — the list a screen reader user
 * jumps through with one key — could not see the title of a single card. The screens that
 * named themselves with one were therefore the screens with no heading of any level at all.
 * The sign-in form, "open your business", the checkout confirmation and the shop's order
 * detail each reported `h1 = null` and an empty
 * `document.querySelector("h1,h2,h3,h4,h5,h6,[role=heading]")`, while every sibling screen
 * that spelled its own `<h1>` was fine. Styling a `div` like a heading does not put it in
 * that list — the same measurement, and the same fix, that made {@link EmptyTitle} a heading.
 *
 * `h2` by default, because a card is usually a region inside a page that already has an `h1`
 * — the account page's panels, the cart's summary, one block of a receipt. `as` is for the
 * other case: a screen whose *whole* content is one card, where the title is the page's own
 * heading. `h3` exists for a card inside a section that is already under an `h2`.
 *
 * The level is a prop and not a style because it is the one thing about a heading this
 * component cannot infer: it does not know what is above it in the document.
 */
function CardTitle({
	className,
	size,
	as: As = "h2",
	...props
}: React.ComponentProps<"h2"> &
	VariantProps<typeof cardTitleVariants> & { as?: "h1" | "h2" | "h3" }) {
	return (
		<As
			data-slot="card-title"
			className={cn(cardTitleVariants({ size }), className)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn(
				"hidden text-pretty text-xs/relaxed text-muted-foreground sm:block",
				className,
			)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The card's surface, and the only part of the primitive that paints one.
 *
 * `rounded-md` belongs here rather than on {@link Card} because this is the element
 * carrying the border: a radius on the transparent wrapper would round nothing, and the
 * border it is meant to soften would still meet at a right angle. `docs/design.md` puts
 * cards in the `--radius-md` step, so a squared `CardContent` was the one surface in the
 * product contradicting the documented scale — `product-card.tsx` already rounds its grid
 * variant, which is why a store page showed rounded product tiles inside square info cards.
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("flex flex-col gap-4 rounded-md border p-4 md:p-6", className)}
			{...props}
		/>
	);
}

/**
 * A card body pinned to one height, with its rows scrolling inside.
 *
 * Two lists side by side on a dashboard hold different numbers of rows, so
 * left to themselves one panel ends level with nothing and the page below
 * jumps whenever the shorter list gains a row. A set height fixes both the
 * pair and the page. Pair with `SimpleTable variant="panel"` so the column
 * header stays pinned while the rows move under it.
 */
function CardPanel({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-panel"
			className={cn(
				"flex h-80 min-h-0 flex-col overflow-hidden rounded-md border",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The empty state for a {@link CardPanel}: centred in the height the panel
 * holds open, rather than a line of text stranded at the top of it.
 */
function CardPanelEmpty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-panel-empty"
			className={cn(
				"flex flex-1 items-center justify-center p-6 text-center text-muted-foreground text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn("flex items-center gap-3 border-t pt-4", className)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
};
