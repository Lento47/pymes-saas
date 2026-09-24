import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

/** A five-pointed star, filled by `currentColor`. One path, drawn twice. */
const STAR_PATH =
	"M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.11-6.46-4.7-4.58 6.49-.94z";

const ratingStarsVariants = cva("inline-flex items-center gap-1.5", {
	variants: {
		size: {
			sm: "text-xs [&_svg]:size-3",
			md: "text-sm [&_svg]:size-3.5",
			lg: "text-base [&_svg]:size-5",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

function StarRow({ className }: { className?: string }) {
	return (
		<>
			{[0, 1, 2, 3, 4].map((index) => (
				<svg
					key={index}
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
					className={className}
				>
					<path d={STAR_PATH} />
				</svg>
			))}
		</>
	);
}

type RatingStarsProps = Omit<React.ComponentProps<"span">, "children"> &
	VariantProps<typeof ratingStarsVariants> & {
		/** 0–5. Fractions are honoured, so 4.7 draws 4.7 stars' worth of fill. */
		value: number;
		/** How many people said so. Rendered in parentheses. */
		count?: number | null;
		/** Hides the numeric value, for a row where the count is the point. */
		showValue?: boolean;
		/**
		 * The whole sentence a screen reader hears in place of the stars.
		 *
		 * Required, and never defaulted in any language — the same rule `price.tsx` follows
		 * for `compareAtLabel` and `product-card.tsx` for `onAdd.label`, because this package
		 * has no translator and a string it invents is a string every reader gets in one
		 * language.
		 *
		 * The words used to be invented here. `ratingLabel` built "4.7 de 5, 128 reseñas" in
		 * Spanish from a `locale` the component accepted and then used for nothing but the
		 * plural *rule* — so an English caller was handed a Spanish accessible label and had no
		 * way to say otherwise. The caller owns the sentence now, from the `store.rating.label`
		 * pair, and `formatRating` spells the number the same way the row draws it.
		 *
		 * A star row with no sentence is not a star row: an `aria-label` is spoken, so a
		 * component that cannot be given one must not be rendered. There is no fallback here
		 * on purpose.
		 */
		label: string;
	};

/**
 * Filled, half and empty stars.
 *
 * The fill is a *clip*, not a per-star half glyph: the filled row is laid over
 * the empty one inside an `overflow-hidden` box whose width is the rating as a
 * fraction of five. A half-star path can only draw halves, and 4.7 is the
 * normal case in a review average — rounded to 4.5 it would disagree with the
 * number printed beside it, which is the one thing this component exists to get
 * right.
 *
 * The whole thing is `role="img"` with a written label, because the alternative
 * is a screen reader reading five SVGs and a bare decimal.
 */
function RatingStars({
	value,
	count,
	size,
	showValue = true,
	label,
	className,
	...props
}: RatingStarsProps) {
	const clamped = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;

	return (
		<span
			data-slot="rating-stars"
			data-size={size ?? "md"}
			role="img"
			aria-label={label}
			className={cn(ratingStarsVariants({ size }), className)}
			{...props}
		>
			<span className="relative inline-flex shrink-0 gap-0.5" aria-hidden="true">
				<span className="flex gap-0.5 text-muted-foreground/35">
					<StarRow />
				</span>
				<span
					className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-rating"
					style={{ width: `${(clamped / 5) * 100}%` }}
				>
					<StarRow className="shrink-0" />
				</span>
			</span>
			{showValue ? (
				<span
					data-slot="rating-stars-value"
					className="font-medium tabular-nums text-foreground"
				>
					{clamped.toFixed(1)}
				</span>
			) : null}
			{count != null ? (
				<span
					data-slot="rating-stars-count"
					className="tabular-nums text-muted-foreground"
				>
					{`(${count})`}
				</span>
			) : null}
		</span>
	);
}

export { RatingStars, ratingStarsVariants };
export type { RatingStarsProps };
