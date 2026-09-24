"use client";

import * as React from "react";

import { Button } from "@pymeshub/ui/components/button";
import { chipVariants } from "@pymeshub/ui/components/chip";
import { Price } from "@pymeshub/ui/components/price";
import { RatingStars } from "@pymeshub/ui/components/rating-stars";
import { Skeleton } from "@pymeshub/ui/components/skeleton";
import { DEFAULT_CURRENCY, initialsFromName } from "@pymeshub/ui/lib/format";
import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { PlusIcon } from "lucide-react";

const productCardVariants = cva("group/product-card relative min-w-0 text-card-foreground", {
	variants: {
		variant: {
			grid: "flex flex-col overflow-hidden rounded-md border border-border bg-card",
			row: "flex items-stretch gap-3 rounded-md border border-border bg-card p-3",
			compact: "flex items-center gap-3 rounded-md py-1.5",
		},
	},
	defaultVariants: {
		variant: "grid",
	},
});

type ProductBadgeTone = "neutral" | "brand" | "positive" | "warning";

type ProductCardProps = Omit<React.ComponentProps<"div">, "children"> &
	VariantProps<typeof productCardVariants> & {
		name: string;
		/** Integer in the currency's minor unit. Never a float, never cents-as-USD. */
		priceMinor: number;
		currency?: string;
		compareAtPriceMinor?: number | null;
		description?: string | null;
		imageUrl?: string | null;
		/** Empty string for a decorative image; the title carries the meaning. */
		imageAlt?: string;
		/** A tiny base64 preview, from the API's image pipeline. */
		blurDataUrl?: string | null;
		badge?: { label: string; tone?: ProductBadgeTone } | null;
		ratingAvg?: number | null;
		ratingCount?: number | null;
		/**
		 * The sentence a screen reader hears for the star row, built by the caller from its own
		 * key — `store.rating.label.count` in the web app.
		 *
		 * Required in spirit and optional in type, the same shape as `Price`'s
		 * `compareAtLabel` and for the same reason: this package has no translator, so it cannot
		 * write the sentence and must not invent one in Spanish. Where `compareAtLabel` is
		 * absent, `Price` still draws the price; here a rating with no sentence is not rendered
		 * at all, because the alternative is an unlabelled `role="img"` — a screen reader
		 * announcing "image" and nothing else, which is worse than the card having no stars.
		 */
		ratingLabel?: string;
		/** Out of stock. The card stays readable; only the action goes away. */
		soldOut?: boolean;
		/**
		 * The word drawn across a sold-out card — the caller's translation of
		 * `product.soldOut`, which is the key the product page and the mobile row already read.
		 *
		 * **Required**, and not "required in spirit and optional in type" the way `ratingLabel`
		 * is, because the two degrade differently: a card with no star row is still a complete
		 * card, while a sold-out card with no word is a card dimmed by an unexplained wash —
		 * the customer cannot tell "sold out" from "still loading", and `docs/design.md`'s rule
		 * that colour is never the only signal is exactly this case. A missing label has no
		 * honest fallback, so the type refuses to let one be forgotten.
		 *
		 * The literal that used to sit here was the Spanish `"Agotado"`, drawn for every reader
		 * in every language — the same leak `price.tsx` had with `"antes"` and this file had
		 * with `"Agregar"`.
		 */
		soldOutLabel: string;
		/** A placeholder in the card's own shape, so a loading grid does not jump. */
		loading?: boolean;
		href?: string;
		/**
		 * The router's link, when there is one. A card that navigates the whole
		 * page for a tap on a product photo is the difference between an app and a
		 * website, and `packages/ui` cannot import `next/link` — it is not a
		 * Next.js package and the mobile app shares it.
		 */
		linkAs?: React.ElementType;
		/**
		 * The add-to-cart action, carrying the words for it.
		 *
		 * One prop rather than `onAdd` and `addLabel` side by side, because the label *is*
		 * the button: the control is a bare plus glyph, so the label is the only thing a
		 * screen reader hears, and an action without one is announced as noise. It used to
		 * default to the Spanish `"Agregar"` — in a package that has no translator, for
		 * every reader in every language, which is the same leak `price.tsx` had with
		 * `"antes"`. Pairing the two makes the word impossible to omit: a call site cannot
		 * express the button without it, and the type system says so at the call site
		 * rather than in a reader's ear.
		 */
		onAdd?: { label: string; onClick: () => void };
		adding?: boolean;
	};

const IMAGE_BOX = {
	grid: "aspect-4/3 w-full",
	row: "size-20 shrink-0",
	compact: "size-12 shrink-0",
} as const;

/**
 * The letter's size for each of the boxes above.
 *
 * A separate map from `IMAGE_BOX` because the two are related but not the same scale: the
 * letter has to stay legible in a 48px `compact` tile and still read as a deliberate mark
 * rather than a stray glyph in a full-width `grid` one, and those are different type sizes
 * for the same element. `ProductCard` maps its own variant onto this, so the two scales
 * cannot drift apart at a call site.
 *
 * `xl` exists for the product page, which renders the same `grid` box at the full width of
 * a 5xl container — two and a half times the tile a grid renders. Measured on that page,
 * `lg` came out at 30px inside a 640px-wide box and read as lost; the step is the tile's
 * scale and not a different treatment, which is why it is a fourth size rather than a
 * second component.
 */
const FALLBACK_TEXT = {
	sm: "text-sm",
	md: "text-xl",
	lg: "text-3xl",
	xl: "text-6xl",
} as const;

/**
 * The photo, with the blur-up.
 *
 * The placeholder is the API's blurred base64 rather than a grey box, because a
 * grid of twelve grey boxes on a 3G connection in San José is what the first
 * second of this screen actually looks like — and the blur is the shape of the
 * photo that is coming, so the layout is already right when it lands.
 *
 * `loading="lazy"` and `decoding="async"` on every card: a category page mounts
 * sixty of these, and decoding them synchronously is how the scroll stutters.
 */
const ProductImage = React.memo(function ProductImage({
	src,
	alt,
	name,
	scale = "md",
	blurDataUrl,
	className,
	sizes,
}: {
	src: string | null | undefined;
	alt: string;
	/** The product's name, for the letter shown when there is no photo. */
	name?: string;
	/** Which of the `IMAGE_BOX` sizes this tile is, so the letter scales with it. */
	scale?: keyof typeof FALLBACK_TEXT;
	blurDataUrl?: string | null;
	className?: string;
	sizes?: string;
}) {
	const [loaded, setLoaded] = React.useState(false);

	// A recycled card — a list that re-sorts, a filter that changes — would
	// otherwise show the previous product's photo already "loaded" and never fade
	// the new one in.
	React.useEffect(() => {
		setLoaded(false);
	}, [src]);

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-sm bg-muted",
				className,
			)}
		>
			{blurDataUrl && !loaded ? (
				<div
					aria-hidden="true"
					className="absolute inset-0 scale-110 bg-cover bg-center blur-lg"
					style={{ backgroundImage: `url(${blurDataUrl})` }}
				/>
			) : null}
			{src ? (
				<img
					src={src}
					alt={alt}
					loading="lazy"
					decoding="async"
					sizes={sizes}
					onLoad={() => setLoaded(true)}
					className={cn(
						"size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
						loaded ? "opacity-100" : "opacity-0",
					)}
				/>
			) : (
				/*
				 * No photo. The product's first letter, in the treatment `business-card.tsx`
			 * already gives a shop with no logo, and for the reason its comment gives: a
			 * catalogue where nothing has been photographed yet is a grid of identical grey
			 * rectangles, and identical grey rectangles are unreadable — you cannot tell one
			 * product from the next, or tell a missing photo from a slow one.
				 *
				 * This replaces a child `<div className="size-full bg-muted" />`, which painted
				 * `bg-muted` on top of a parent that is already `bg-muted`: it drew nothing at
				 * all, which is why the tile was flat. `bg-accent` is a different surface from
				 * the wrapper's, so the letter has something to sit on.
				 *
				 * `aria-hidden` stays, and it is not an oversight: `imageAlt` is documented as
				 * empty for a decorative image because the title carries the meaning, and the
				 * title is a sibling of this tile in every variant. Announcing the letter would
				 * read the product's first initial out loud before its name.
				 */
				<span
					aria-hidden="true"
					className={cn(
						"flex size-full select-none items-center justify-center bg-accent font-semibold text-accent-foreground uppercase leading-none",
						FALLBACK_TEXT[scale],
					)}
				>
					{/* One letter, not `initialsFromName`'s two: the helper is reused for its
					    null/empty handling — it answers `?` rather than rendering nothing — but
					    a single glyph is what a tile this shape can hold at 48px. */}
					{initialsFromName(name).slice(0, 1)}
				</span>
			)}
		</div>
	);
});

function ProductCardSkeleton({ variant }: { variant: "grid" | "row" | "compact" }) {
	if (variant === "compact") {
		return (
			<div className="flex items-center gap-3 py-1.5">
				<Skeleton className="size-12 rounded-sm" />
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<Skeleton className="h-3 w-3/4" />
					<Skeleton className="h-3 w-1/3" />
				</div>
			</div>
		);
	}

	if (variant === "row") {
		return (
			<div className="flex items-stretch gap-3 rounded-md border border-border bg-card p-3">
				<Skeleton className="size-20 rounded-sm" />
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="mt-auto h-5 w-20" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
			{/* Square on purpose: the image is flush with the card's top corners and
			    the card clips them, so a radius here would double the corner up. */}
			<Skeleton className="aspect-4/3 w-full rounded-none" />
			<div className="flex flex-col gap-2 p-3">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-3 w-1/2" />
				<Skeleton className="h-6 w-24" />
			</div>
		</div>
	);
}

/**
 * A product in a list.
 *
 * The card is the *link*, not a box with a link in it. A `href` stretches a
 * pseudo-element over the whole surface, so the image, the title and the
 * whitespace between them are all one target — which is what a thumb expects —
 * while the add button stays a real, separate control above it. A card whose
 * only tappable pixel is the twelve-point title is the single most common way a
 * product list is unusable on a phone.
 *
 * `React.memo` because the inputs are primitives: a filter that changes one
 * product's price re-renders one card, not the sixty on screen.
 */
const ProductCard = React.memo(function ProductCard({
	name,
	priceMinor,
	currency = DEFAULT_CURRENCY,
	compareAtPriceMinor,
	description,
	imageUrl,
	imageAlt = "",
	blurDataUrl,
	badge,
	ratingAvg,
	ratingCount,
	ratingLabel,
	soldOut = false,
	soldOutLabel,
	loading = false,
	href,
	linkAs,
	onAdd,
	adding = false,
	variant = "grid",
	className,
	...props
}: ProductCardProps) {
	if (loading) return <ProductCardSkeleton variant={variant ?? "grid"} />;

	const Link = (linkAs ?? "a") as React.ElementType;
	const compact = variant === "compact";

	const title = (
		<span
			data-slot="product-card-title"
			className={cn(
				"min-w-0 font-medium text-foreground",
				compact ? "truncate text-sm" : "line-clamp-2 text-sm leading-snug",
			)}
		>
			{name}
		</span>
	);

	const meta = (
		<>
			{ratingAvg != null && ratingLabel ? (
				<RatingStars
					value={ratingAvg}
					count={ratingCount}
					size="sm"
					showValue
					label={ratingLabel}
				/>
			) : null}
			<Price
				amountMinor={priceMinor}
				currency={currency}
				compareAtMinor={compareAtPriceMinor}
				size={compact ? "sm" : "md"}
			/>
		</>
	);

	const addButton =
		onAdd && !compact ? (
			<Button
				type="button"
				variant={soldOut ? "secondary" : "default"}
				size="icon-lg"
				// 44px, from the checklist. Set here rather than at the call site,
				// because every product grid in the product needs the same thumb
				// target and one of them will forget.
				className="relative z-10 size-11 rounded-full shadow-sm"
				disabled={soldOut || adding}
				aria-label={`${onAdd.label} ${name}`}
				onClick={onAdd.onClick}
			>
				<PlusIcon aria-hidden="true" className="size-5" />
			</Button>
		) : null;

	if (variant === "compact") {
		return (
			<div
				data-slot="product-card"
				data-variant="compact"
				className={cn(productCardVariants({ variant }), className)}
				{...props}
			>
				<ProductImage
					src={imageUrl}
					alt={imageAlt}
					name={name}
					scale="sm"
					blurDataUrl={blurDataUrl}
					className={IMAGE_BOX.compact}
				/>
				<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
					{href ? (
						<Link href={href} className="min-w-0 after:absolute after:inset-0">
							{title}
						</Link>
					) : (
						title
					)}
					<Price
						amountMinor={priceMinor}
						currency={currency}
						compareAtMinor={compareAtPriceMinor}
						size="sm"
					/>
				</div>
			</div>
		);
	}

	return (
		<div
			data-slot="product-card"
			data-variant={variant}
			data-sold-out={soldOut ? "true" : undefined}
			className={cn(productCardVariants({ variant }), className)}
			{...props}
		>
			<div
				className={cn(
					"relative",
					variant === "grid" ? IMAGE_BOX.grid : IMAGE_BOX.row,
				)}
			>
				<ProductImage
					src={imageUrl}
					alt={imageAlt}
					name={name}
					scale={variant === "grid" ? "lg" : "md"}
					blurDataUrl={blurDataUrl}
					className="size-full"
					sizes={variant === "grid" ? "(min-width: 768px) 25vw, 50vw" : "80px"}
				/>
				{badge ? (
					<span
						className={cn(
							chipVariants({ size: "sm", tone: badge.tone ?? "brand" }),
							"absolute top-2 left-2 shadow-sm",
						)}
					>
						{badge.label}
					</span>
				) : null}
				{soldOut ? (
					<>
						<div
							aria-hidden="true"
							className="absolute inset-0 bg-background/60"
						/>
						<span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tracking-wide text-foreground uppercase">
							{soldOutLabel}
						</span>
					</>
				) : null}
				{variant === "grid" && addButton ? (
					<div className="absolute right-2 bottom-2">{addButton}</div>
				) : null}
			</div>

			<div
				className={cn(
					"flex min-w-0 flex-1 flex-col gap-1.5",
					variant === "grid" && "p-3",
				)}
			>
				{href ? (
					<Link href={href} className="min-w-0 after:absolute after:inset-0">
						{title}
					</Link>
				) : (
					title
				)}
				{description ? (
					<p className="line-clamp-2 min-w-0 text-xs text-muted-foreground">
						{description}
					</p>
				) : null}
				<div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
					{meta}
					{variant === "row" ? addButton : null}
				</div>
			</div>
		</div>
	);
});

export { ProductCard, productCardVariants, ProductImage };
export type { ProductCardProps, ProductBadgeTone };
