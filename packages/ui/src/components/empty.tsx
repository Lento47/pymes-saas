import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * How much horizontal room the copy inside is allowed.
 *
 * `default` is a narrow measure, which is right for an empty table in the
 * middle of a page: prose past about sixty characters is harder to read, so a
 * one-line explanation is worth wrapping. It is wrong in a panel that is itself
 * wide and mostly empty — there the same limit sets a short sentence over two
 * ragged lines and wraps a row of three buttons onto two, which reads as
 * squashed rather than as considered.
 *
 * The variant lives on the container and reaches the parts through a group
 * selector, so a caller says how wide the empty state is once instead of
 * repeating a max-width on the header and again on the content.
 */
const emptyVariants = cva(
	// Sits at its natural height (a comfortable block) rather than stretching to
	// fill a flex-1 page shell.
	"group/empty flex w-full min-w-0 flex-col items-center justify-center gap-4 rounded-md border-dashed px-6 py-12 text-center text-balance",
	{
		variants: {
			width: {
				default: "",
				wide: "",
			},
			/**
			 * `fill` is the whole-screen case — an empty cart, a search with no
			 * results on a phone — where the copy has to sit in the middle of what
			 * is left after the header and the bottom bar, not in a band near the
			 * top. This used to be advice in the comment above ("opt in with
			 * `flex-1` on the className"), which is exactly the call-site override
			 * `docs/design.md` forbids; as a variant it is one word at the call
			 * site and the same `flex-1` everywhere.
			 */
			height: {
				default: "",
				fill: "flex-1",
			},
		},
		defaultVariants: {
			width: "default",
			height: "default",
		},
	},
);

function Empty({
	className,
	width = "default",
	height = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
	return (
		<div
			data-slot="empty"
			data-width={width}
			data-height={height}
			className={cn(emptyVariants({ width, height }), className)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn(
				"flex max-w-sm flex-col items-center gap-2",
				"group-data-[width=wide]/empty:max-w-xl",
				className,
			)}
			{...props}
		/>
	);
}

const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
				/**
				 * A whole screen has no surrounding page to explain it, so a 32px
				 * chip is too small a mark for the only thing on it. `feature` is
				 * the same idea at the size a full-screen empty state needs, in the
				 * brand tint rather than grey: "nothing here" and "nothing here yet"
				 * are different messages, and the second one is warm.
				 */
				feature:
					"size-14 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

/**
 * The empty state's title — a real heading, not a `<div>` styled like one.
 *
 * It was a `<div>` until this was measured: `/admin` reported `h1 = null` **and** no heading
 * of any level, because the console's only text was an `EmptyState`. Heading navigation — the
 * list a screen reader user jumps through with one key — could not see the single sentence
 * that said what the screen was. That was true of every `EmptyState` in the product: the
 * empty cart, the empty order list, every empty admin table, and the gate screens. Styling a
 * `div` like a heading does not put it in that list.
 *
 * `h2` by default, because an empty state is usually a region inside a page that already has
 * an `h1` — a table with no rows, a panel with nothing in it. `as` is for the other case: a
 * screen whose *whole* content is the empty state, where the title is the page's own heading.
 * `h3` exists for an empty state inside a section that is already under an `h2`.
 *
 * The level is a prop and not a style because it is the one thing about a heading this
 * component cannot infer: it does not know what is above it in the document.
 */
function EmptyTitle({
	className,
	as: As = "h2",
	...props
}: React.ComponentProps<"h2"> & { as?: "h1" | "h2" | "h3" }) {
	return (
		<As
			data-slot="empty-title"
			className={cn("font-heading text-sm font-medium", className)}
			{...props}
		/>
	);
}

/**
 * The sentence under the title — a `<p>`, which is what its type has always claimed.
 *
 * It rendered a `<div>` while being typed `React.ComponentProps<"p">`, so the element and the
 * props it accepted disagreed: a caller could pass a `cite` or a `title` attribute that React
 * would put on a `div`, where it means nothing. Small, but this file is the one place the
 * product's empty states are defined, and a component whose element is not the element it says
 * it is teaches every reader to distrust the types.
 *
 * `<p>` is also the honest element: this is a paragraph of supplementary text under a heading,
 * and marking it up as one is what lets a screen reader treat it as the heading's description.
 * The cost is the HTML rule that a `<p>` cannot contain block content — a `div` or a list
 * inside it makes the browser's parser close the paragraph early, which is a hydration
 * mismatch under SSR before it is a layout bug. Both call sites in `apps/web/components/states.tsx`
 * pass a string and, for an internal error, an inline `<span>` for the request id, which is
 * valid; a future caller that needs a list here wants a different component, not a `<div>`
 * quietly wearing a paragraph's type.
 */
function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-description"
			className={cn(
				"text-xs/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
				className,
			)}
			{...props}
		/>
	);
}

const emptyContentVariants = cva(
	"flex w-full max-w-sm min-w-0 items-center gap-2.5 text-xs text-balance group-data-[width=wide]/empty:max-w-2xl",
	{
		variants: {
			/**
			 * `stack` for one call to action under another; `row` for a set of
			 * equals, which is what a handful of suggested questions is. The row
			 * still wraps — it has to on a narrow sheet — but given the room it
			 * keeps them on one line.
			 */
			layout: {
				stack: "flex-col",
				row: "flex-row flex-wrap justify-center",
			},
		},
		defaultVariants: {
			layout: "stack",
		},
	},
);

function EmptyContent({
	className,
	layout,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyContentVariants>) {
	return (
		<div
			data-slot="empty-content"
			className={cn(emptyContentVariants({ layout, className }))}
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
};
