"use client";

import * as React from "react";

import { chipVariants } from "@pymeshub/ui/components/chip";
import { Skeleton } from "@pymeshub/ui/components/skeleton";
import { StatusIndicator } from "@pymeshub/ui/components/status-indicator";
import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheckIcon, ClockIcon } from "lucide-react";

const businessCardVariants = cva("group/business-card relative min-w-0", {
	variants: {
		variant: {
			card: "flex flex-col overflow-hidden rounded-md border border-border bg-card",
			row: "flex items-center gap-3 rounded-md border border-border bg-card p-3",
		},
	},
	defaultVariants: {
		variant: "card",
	},
});

type BusinessBadge = "verified" | "top-rated";

type BusinessCardProps = Omit<React.ComponentProps<"div">, "children"> &
	VariantProps<typeof businessCardVariants> & {
		name: string;
		href?: string;
		linkAs?: React.ElementType;
		/** The wide photo. Falls back to `logoUrl` for the row variant. */
		coverUrl?: string | null;
		logoUrl?: string | null;
		logoAlt?: string;
		category?: string | null;
		ratingAvg?: number | null;
		ratingCount?: number | null;
		/** `"25–35 min"`. Pre-formatted: how long a delivery takes is the
		 *  business's promise, not something this component can compute. */
		deliveryTime?: string | null;
		/** `undefined` when the hours are unknown — not the same as closed. */
		isOpen?: boolean;
		badges?: BusinessBadge[];
		/**
		 * What each badge is called, in the reader's language — `store.verified` and
		 * `store.topRated`.
		 *
		 * A required `Record<BusinessBadge, string>` rather than the two hardcoded Spanish
		 * words this file used to hold in a `BADGE_COPY` map. This package has no
		 * `@pymeshub/i18n` dependency and never will: it is the translation-free primitive
		 * layer, so the only place a word can come from is the caller. Required, and not a
		 * Spanish default with an override, because the reader of this card is a **customer**
		 * — a default here is a shop that renders "Mejor valorado" to someone on `en`, which
		 * is the bug and not the fallback. `StatusIndicator`'s own `label`, one prop down in
		 * this same file, is required for the same reason.
		 *
		 * A total `Record` and not a partial map, so adding a badge to `BusinessBadge` fails
		 * the build at every caller instead of rendering an empty chip — the same argument
		 * `ORDER_STATUS_LABEL` makes in `status-badge.tsx`.
		 */
		badgeLabels: Record<BusinessBadge, string>;
		/**
		 * The dot's two words — `store.open` / `store.closed`.
		 *
		 * Two props rather than one boolean-to-word map, because the card already speaks
		 * English and Spanish through the dictionary at the call site and the pair is the
		 * smallest thing that can be handed over. Required for the reason `badgeLabels` is,
		 * and doubly so: docs/design.md's checklist forbids colour as the only signal, so a
		 * dot whose word is missing is an accessibility bug as well as a language one.
		 */
		openLabel: string;
		closedLabel: string;
		/** A "Ver tienda" button. Omit on a card that is entirely a link. */
		action?: React.ReactNode;
		loading?: boolean;
	};

function BusinessLogo({
	logoUrl,
	logoAlt,
	className,
}: {
	logoUrl?: string | null;
	logoAlt: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative shrink-0 overflow-hidden rounded-full border-2 border-card bg-muted",
				className,
			)}
		>
			{logoUrl ? (
				<img
					src={logoUrl}
					alt={logoAlt}
					loading="lazy"
					decoding="async"
					className="size-full object-cover"
				/>
			) : (
				<span
					aria-hidden="true"
					className="flex size-full items-center justify-center bg-accent text-sm font-semibold text-accent-foreground"
				>
					{/* A letter is a better placeholder than a generic shop glyph: two
					    businesses starting with the same letter still differ, and a
					    grid of identical grey storefronts is unreadable. */}
					{logoAlt.trim().slice(0, 1).toUpperCase() || "?"}
				</span>
			)}
		</div>
	);
}

function BusinessCardSkeleton({ variant }: { variant: "card" | "row" }) {
	if (variant === "row") {
		return (
			<div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
				<Skeleton className="size-14 rounded-full" />
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-3 w-3/4" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
			<Skeleton className="aspect-3/1 w-full rounded-none" />
			<div className="flex flex-col gap-3 p-3">
				<Skeleton className="-mt-10 size-16 rounded-full" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-3 w-3/4" />
			</div>
		</div>
	);
}

/**
 * A business in a list — the "who is selling this" half of a marketplace.
 *
 * The cover-over-logo is the shape a customer already reads as "a shop", and the
 * logo overlaps the cover's bottom edge so the two are one object rather than a
 * banner with a picture under it. Both images are optional and the card holds its
 * shape without either: a marketplace in Costa Rica has plenty of businesses
 * whose only asset is a phone photo, and a card that collapses without a cover
 * makes those look broken.
 */
const BusinessCard = React.memo(function BusinessCard({
	name,
	href,
	linkAs,
	coverUrl,
	logoUrl,
	logoAlt,
	category,
	ratingAvg,
	ratingCount,
	deliveryTime,
	isOpen,
	badges = [],
	badgeLabels,
	openLabel,
	closedLabel,
	action,
	loading = false,
	variant = "card",
	className,
	...props
}: BusinessCardProps) {
	if (loading) return <BusinessCardSkeleton variant={variant ?? "card"} />;

	const Link = (linkAs ?? "a") as React.ElementType;
	const alt = logoAlt ?? name;

	const heading = (
		<span
			data-slot="business-card-name"
			className="min-w-0 truncate font-semibold text-foreground"
		>
			{name}
		</span>
	);

	/**
	 * One line, in the order a person decides in: what it sells, how good it is,
	 * how long it takes. Separated by a middot rather than by whitespace, so a
	 * missing middle field does not leave a gap that reads as a rendering bug.
	 */
	const metaParts: React.ReactNode[] = [];
	if (category) metaParts.push(category);
	if (ratingAvg != null)
		metaParts.push(
			<span key="rating" className="tabular-nums">
				{ratingAvg.toFixed(1)}
				{ratingCount != null ? ` (${ratingCount})` : ""}
			</span>,
		);
	if (deliveryTime)
		metaParts.push(
			<span key="time" className="inline-flex items-center gap-1 tabular-nums">
				<ClockIcon aria-hidden="true" className="size-3" />
				{deliveryTime}
			</span>,
		);

	const meta = metaParts.length ? (
		<span
			data-slot="business-card-meta"
			className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
		>
			{metaParts.map((part, index) => (
				<React.Fragment key={index}>
					{index > 0 ? <span aria-hidden="true">·</span> : null}
					{part}
				</React.Fragment>
			))}
		</span>
	) : null;

	const badgeRow = badges.length ? (
		<span className="flex flex-wrap items-center gap-1.5">
			{badges.map((badge) => (
				<span
					key={badge}
					className={cn(
						chipVariants({
							size: "sm",
							tone: badge === "verified" ? "positive" : "warning",
						}),
					)}
				>
					{badge === "verified" ? (
						<BadgeCheckIcon aria-hidden="true" />
					) : null}
					{badgeLabels[badge]}
				</span>
			))}
		</span>
	) : null;

	// "Cerrado" is neutral rather than destructive: a shop being shut at 9pm is
	// the schedule working, not an error, and a red pill on half the list at that
	// hour is a list that looks broken. The word is the caller's, though, because
	// the reader might be on `en` and this component cannot know.
	const openState =
		isOpen === undefined ? null : (
			<StatusIndicator
				tone={isOpen ? "success" : "neutral"}
				label={isOpen ? openLabel : closedLabel}
			/>
		);

	const text = (
		<div className="flex min-w-0 flex-1 flex-col gap-1.5">
			{heading}
			{meta}
			{badges.length || openState ? (
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
					{badgeRow}
					{openState}
				</span>
			) : null}
		</div>
	);

	if (variant === "row") {
		return (
			<div
				data-slot="business-card"
				data-variant="row"
				data-open={isOpen === undefined ? undefined : String(isOpen)}
				className={cn(businessCardVariants({ variant }), className)}
				{...props}
			>
				<BusinessLogo
					logoUrl={logoUrl ?? coverUrl}
					logoAlt={alt}
					className="size-14"
				/>
				{href ? (
					<Link
						href={href}
						className="flex min-w-0 flex-1 flex-col gap-1.5 after:absolute after:inset-0"
					>
						{text}
					</Link>
				) : (
					text
				)}
			</div>
		);
	}

	return (
		<div
			data-slot="business-card"
			data-variant="card"
			data-open={isOpen === undefined ? undefined : String(isOpen)}
			className={cn(businessCardVariants({ variant }), className)}
			{...props}
		>
			<div className="relative aspect-3/1 w-full bg-muted">
				{coverUrl ? (
					<img
						src={coverUrl}
						alt=""
						loading="lazy"
						decoding="async"
						className="size-full object-cover"
					/>
				) : (
					<div aria-hidden="true" className="size-full bg-accent/40" />
				)}
			</div>
			{/* The logo is pulled up over the cover's edge, not absolutely placed:
			    an absolute position would need the cover's height to be a fixed
			    number, and the cover is a ratio. */}
			<div className="flex min-w-0 flex-col gap-2 p-3 pt-0">
				<BusinessLogo
					logoUrl={logoUrl}
					logoAlt={alt}
					className="-mt-8 size-16 shadow-sm"
				/>
				{href ? (
					<Link href={href} className="block min-w-0 after:absolute after:inset-0">
						{text}
					</Link>
				) : (
					text
				)}
				{action ? <div className="relative z-10 mt-1">{action}</div> : null}
			</div>
		</div>
	);
});

export { BusinessCard, businessCardVariants };
export type { BusinessCardProps, BusinessBadge };
