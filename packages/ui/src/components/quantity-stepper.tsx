"use client";

import { cn } from "@pymeshub/ui/lib/utils";
import { Button } from "@pymeshub/ui/components/button";
import { Spinner } from "@pymeshub/ui/components/spinner";
import { cva, type VariantProps } from "class-variance-authority";
import { MinusIcon, PlusIcon } from "lucide-react";
import type * as React from "react";

const quantityStepperVariants = cva(
	"inline-flex items-center rounded-full border border-border bg-card",
	{
		variants: {
			size: {
				// Both sizes clear 44px on the *button*, which is the thing a thumb
				// aims at. The pill around them can be shorter than that; nothing
				// tappable is.
				sm: "gap-0 [&_button]:size-11 [&_span]:min-w-8 [&_span]:text-sm",
				md: "gap-0 [&_button]:size-11 [&_span]:min-w-10 [&_span]:text-base",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

type QuantityStepperProps = Omit<React.ComponentProps<"div">, "onChange"> &
	VariantProps<typeof quantityStepperVariants> & {
		value: number;
		onChange: (value: number) => void;
		min?: number;
		/** `undefined` is unlimited — the usual case for a product with stock. */
		max?: number;
		step?: number;
		disabled?: boolean;
		/** A change is in flight; both buttons lock but the count stays readable. */
		loading?: boolean;
		/** What the number counts, for the spoken label: "Cantidad". */
		label?: string;
	};

/**
 * Minus, the number, plus.
 *
 * The number is `aria-live="polite"`, and that is the whole accessibility story
 * of this component: the two buttons are labelled and reachable, but the *result*
 * of pressing one is a digit that changes with no focus change and no
 * announcement. Without the live region a screen-reader user is left pressing
 * plus and being told nothing.
 *
 * It is a div and two buttons rather than an `<input type="number">`. The native
 * control brings a spinner nobody styles, a keyboard behaviour that differs by
 * browser, and — the reason that actually decided it — a free-text field, so a
 * customer can type `9999` into a cart line and the client has to re-validate on
 * every keystroke. Here the value cannot leave the range.
 */
function QuantityStepper({
	value,
	onChange,
	min = 1,
	max,
	step = 1,
	disabled = false,
	loading = false,
	label = "Cantidad",
	size,
	className,
	...props
}: QuantityStepperProps) {
	const atMin = value <= min;
	const atMax = max != null && value >= max;
	const locked = disabled || loading;

	const set = (next: number) => {
		const floored = Math.max(min, next);
		const capped = max != null ? Math.min(max, floored) : floored;
		if (capped !== value) onChange(capped);
	};

	return (
		<div
			data-slot="quantity-stepper"
			data-size={size ?? "md"}
			aria-busy={loading || undefined}
			className={cn(
				quantityStepperVariants({ size }),
				locked && "opacity-60",
				className,
			)}
			{...props}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				// 44px, from the checklist. `icon` is 32, and these two are the controls a
				// customer taps most on a phone — one tap per unit, often in a row — so the
				// floor belongs here rather than on the four call sites that each have to
				// remember it.
				className="min-touch rounded-full"
				aria-label={`Quitar uno de ${label.toLowerCase()}`}
				disabled={locked || atMin}
				onClick={() => set(value - step)}
			>
				<MinusIcon aria-hidden="true" />
			</Button>
			<span
				data-slot="quantity-stepper-value"
				// The value carries its own name, because a bare "3" announced on its
				// own is a number with nothing attached to it.
				aria-label={`${label}: ${value}`}
				aria-live="polite"
				className="inline-flex items-center justify-center text-center font-semibold tabular-nums"
			>
				{loading ? <Spinner className="size-3.5" /> : value}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="min-touch rounded-full"
				aria-label={`Agregar uno a ${label.toLowerCase()}`}
				disabled={locked || atMax}
				onClick={() => set(value + step)}
			>
				<PlusIcon aria-hidden="true" />
			</Button>
		</div>
	);
}

export { QuantityStepper, quantityStepperVariants };
export type { QuantityStepperProps };
