import { cn } from "@pymeshub/ui/lib/utils";
import { DEFAULT_CURRENCY, formatMoney } from "@pymeshub/ui/lib/format";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const priceVariants = cva(
	// `tabular-nums` is not decoration here. Prices sit in columns and at the end
	// of rows, and proportional digits make `₡1 111` narrower than `₡9 999` — so
	// a list of them reads as a ragged edge and a total that changes under a
	// spinner makes the row jump.
	"inline-flex items-baseline gap-x-2 font-semibold tabular-nums",
	{
		variants: {
			size: {
				sm: "text-sm",
				md: "text-lg",
				lg: "text-2xl",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

/**
 * The discount, as a whole percent, or `null` when there is not a real one.
 *
 * A compare-at price that is not actually higher is a data error, and rendering
 * it would produce a struck-through number *below* the price and a `-0%` chip —
 * which reads as a broken page rather than as bad data. Both cases return null
 * and the component renders the plain price it can stand behind.
 */
function discountPercent(
	amountMinor: number,
	compareAtMinor: number | null | undefined,
): number | null {
	if (compareAtMinor == null || compareAtMinor <= 0) return null;
	if (amountMinor >= compareAtMinor) return null;
	const percent = Math.round(
		((compareAtMinor - amountMinor) / compareAtMinor) * 100,
	);
	return percent > 0 ? percent : null;
}

type PriceProps = Omit<React.ComponentProps<"span">, "children"> &
	VariantProps<typeof priceVariants> & {
		/** Integer, in the currency's minor unit. CRC has none, so this is colones. */
		amountMinor: number;
		/** Defaults to the market currency. Pass the business's own. */
		currency?: string;
		/** The "before" price. Rendered struck through, only when it is higher. */
		compareAtMinor?: number | null;
		locale?: string;
		/**
		 * The word a screen reader hears before the "before" price — "antes", "was".
		 *
		 * Required in spirit and optional in type: this package has no translator (see the
		 * note on `dialog.tsx`), so it cannot supply the word, and a caller that cannot
		 * either is better off saying nothing than saying it in Spanish. When it is absent
		 * the struck-through amount is drawn with no word in front of it.
		 */
		compareAtLabel?: string;
	};

/**
 * The loudest number in a row.
 *
 * Everything else in a marketplace row is subordinate to this, so it is one
 * component rather than a number somebody formats at the call site: the price,
 * its "before" price and its discount have to agree about which of them is
 * real, and three call sites each deciding that is three chances to ship a
 * `-0%`.
 *
 * The compare-at price is a `<s>`, not a styled span — the element already means
 * "this was the price and no longer is", which is exactly the claim being made
 * and is the only one of the three a screen reader can hear. The word in front of it is
 * a sibling rather than a child of it, because inside it the browser would draw
 * a line through the word too.
 *
 * That word used to be the literal `"antes"`, drawn for every reader in every
 * language, in a package that carries no translator — so an English product page
 * announced a Spanish word. It is `compareAtLabel` now, and the separator is owned here:
 * a caller passes "antes"/"was" and never a trailing space, which is a character no
 * dictionary author should have to remember to include.
 */
function Price({
	amountMinor,
	currency = DEFAULT_CURRENCY,
	compareAtMinor,
	locale,
	compareAtLabel,
	size,
	className,
	...props
}: PriceProps) {
	const percent = discountPercent(amountMinor, compareAtMinor);
	const compareText = percent
		? formatMoney(compareAtMinor ?? 0, currency, { locale })
		: null;

	return (
		<span
			data-slot="price"
			data-size={size ?? "md"}
			className={cn(priceVariants({ size }), className)}
			{...props}
		>
			<span data-slot="price-current" className="text-price">
				{formatMoney(amountMinor, currency, { locale })}
			</span>
			{compareText ? (
				<span
					data-slot="price-compare"
					className="text-xs font-normal text-price-compare"
				>
					{compareAtLabel ? (
						<span className="sr-only">{compareAtLabel} </span>
					) : null}
					<s>{compareText}</s>
				</span>
			) : null}
			{percent ? (
				<span
					data-slot="price-discount"
					className="self-center rounded-full bg-discount px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold text-discount-foreground"
				>
					{`-${percent}%`}
				</span>
			) : null}
		</span>
	);
}

export { Price, priceVariants, discountPercent };
export type { PriceProps };
