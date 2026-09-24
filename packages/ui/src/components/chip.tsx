"use client";

import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import type * as React from "react";

/**
 * The pill itself, exported so a non-interactive use — a "Verificado" badge on a
 * business card, a category tag — is the same surface as the filter chip beside
 * it rather than a second rounded-full span that drifts from it.
 */
const chipVariants = cva(
	"inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			size: {
				// `sm` is a label on a card; `md` is a control, so it carries the
				// 44px minimum height. A chip you tap is a touch target first.
				sm: "h-6 px-2 text-xs [&_svg]:size-3",
				md: "min-h-11 px-3 text-sm [&_svg]:size-4",
			},
			tone: {
				neutral: "border-border bg-card text-foreground",
				brand: "border-transparent bg-accent text-accent-foreground",
				positive: "border-transparent bg-status-completed text-status-completed-foreground",
				warning: "border-transparent bg-status-pending text-status-pending-foreground",
			},
			// A selected filter is *not* a hover state: it has to survive the
			// pointer leaving, and it has to be legible next to three unselected
			// siblings, so it inverts rather than tinting.
			selected: {
				true: "border-primary bg-primary text-primary-foreground",
				false: "",
			},
		},
		defaultVariants: {
			size: "md",
			tone: "neutral",
			selected: false,
		},
	},
);

type ChipVariants = VariantProps<typeof chipVariants>;

type ChipProps = Omit<React.ComponentProps<"button">, "color"> &
	ChipVariants & {
		icon?: React.ReactNode;
		/**
		 * Adds a second, separately-labelled button inside the pill. The remove
		 * button is a sibling of the label button and not a child of it: a button
		 * inside a button is invalid HTML, and browsers resolve it by dropping one
		 * of the two — usually the one that was going to remove the chip.
		 */
		onRemove?: () => void;
		removeLabel?: string;
	};

function Chip({
	icon,
	onRemove,
	removeLabel,
	size,
	tone,
	selected,
	disabled,
	className,
	children,
	...props
}: ChipProps) {
	const label = (
		<>
			{icon}
			{children}
		</>
	);

	if (onRemove) {
		return (
			<span
				data-slot="chip"
				data-selected={selected ? "true" : "false"}
				data-tone={tone ?? "neutral"}
				className={cn(
					chipVariants({ size, tone, selected }),
					"pr-1",
					disabled && "pointer-events-none opacity-50",
					className,
				)}
			>
				{/*
				 * The label button is the pill's other tab stop, so it draws its own
				 * indicator. `outline-none` alone used to sit here: the pill around it
				 * carries `focus-visible:outline-*` from `chipVariants`, but `:focus-visible`
				 * does not propagate to an ancestor, so none of it ever matched this element.
				 * The shape is the remove button's below — 1px of offset because the button
				 * lives inside the pill and offset 2 would cross the remove button's edge —
				 * and `outline-current` rather than `outline-ring` because the pill's own
				 * background is `bg-primary` on a selected chip, where `--ring` is the same
				 * colour as the surface under it.
				 */}
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
					disabled={disabled}
					{...props}
				>
					{label}
				</button>
				<button
					type="button"
					aria-label={removeLabel ?? `Quitar ${typeof children === "string" ? children : "filtro"}`}
					className="-mr-1 inline-flex size-6 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
					disabled={disabled}
					onClick={onRemove}
				>
					<XIcon aria-hidden="true" />
				</button>
			</span>
		);
	}

	return (
		<button
			data-slot="chip"
			type="button"
			data-selected={selected ? "true" : "false"}
			data-tone={tone ?? "neutral"}
			aria-pressed={selected ?? false}
			disabled={disabled}
			className={cn(chipVariants({ size, tone, selected }), className)}
			{...props}
		>
			{label}
		</button>
	);
}

export { Chip, chipVariants };
export type { ChipProps };
