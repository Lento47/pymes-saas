"use client";

import * as React from "react";

import { cn } from "@pymeshub/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * `process.env.NODE_ENV`, declared rather than imported.
 *
 * Both bundlers that build this package inline it — Next at build time, Metro as a
 * shim — so the read is real. What is not real is the type: pulling `@types/node`
 * into `packages/ui` for one dev-only warning would give every component in this
 * library a `process`, a `Buffer` and a `require` it may never use, and this code
 * runs on a phone. `typeof` guards the read, so a bundler that defines nothing
 * simply takes the non-production branch.
 */
declare const process: { env?: { NODE_ENV?: string } } | undefined;

type BottomNavItem = {
	href: string;
	label: string;
	/** A lucide icon — the library `components.json` already points at. */
	icon: LucideIcon;
	/** Marks the current section. One item should carry it. */
	active?: boolean;
	/** A count on a tab: cart lines, unread orders. `0` renders nothing. */
	badge?: number;
	/**
	 * What the count *is*, for the spoken label — "3 artículos". Without it the
	 * announcement is "3", which is a number with no noun on it.
	 */
	badgeLabel?: string;
};

type BottomNavProps = Omit<React.ComponentProps<"nav">, "children"> & {
	items: BottomNavItem[];
	linkAs?: React.ElementType;
	/** A raised centre action — "Pedir", the one thing the app is for. */
	primaryAction?: React.ReactNode;
	/**
	 * The landmark's spoken name.
	 *
	 * A prop rather than a literal because this library has no dictionary: a nav
	 * landmark needs a label, and a Spanish one hard-coded here would announce a
	 * Spanish product to an English reader on every screen — the one string in the
	 * app that a translator could not reach. The default is Spanish because that is
	 * the product's language; a caller with `@pymeshub/i18n` should always pass it.
	 */
	label?: string;
};

/**
 * The persistent bottom bar.
 *
 * Present on every screen and never re-rendered away, because the alternative —
 * a hamburger — puts the whole navigation behind one tap and a sheet, and a
 * marketplace is an app people open for fifteen seconds at a time. That is also
 * why the bar is `fixed` rather than `sticky`: a sticky bar scrolls out of the
 * document at the end of the content, and this one is furniture.
 *
 * Because it is fixed, it covers what is under it. `--bottom-nav-height` is the
 * single number the bar and `.pb-bottom-nav` both read, so a page reserves the
 * right room by adding one class rather than by guessing `pb-20` — see the
 * utility in `globals.css`.
 *
 * Active state is `aria-current="page"` and not a class name, so the visual and
 * the spoken version cannot disagree.
 *
 * ## The tab's ring is drawn here, because the shell's cannot reach it
 *
 * Each tab carried the utility that emits `outline-style: none` with nothing
 * replacing it, so a keyboard customer tabbing the phone bar saw no focus
 * indicator at all. The rule that should have covered it exists — `globals.css`'s
 * `:focus-visible { outline: 2px solid var(--ring) }` — but it sits in
 * `@layer base` and the utility sits in `@layer utilities`, which Tailwind 4
 * emits after `base`; layer order settles an equal-origin tie before
 * specificity is consulted, so the suppression won with no trace.
 * `docs/design.md` says a control that suppresses the ring replaces it, and
 * `focus-visible:ring-2 focus-visible:ring-ring` is that replacement — the same
 * shape `button.tsx` states as `focus-visible:border-ring focus-visible:ring-1`.
 * It is a `box-shadow` and not an outline on purpose: `items-stretch` on the bar
 * makes the tab exactly as tall as the bar's content box, so an offset outline
 * would paint outside the bar rather than on the tab. `ring-ring` is load-bearing
 * — a bare `ring-2` draws in `currentColor`, which on an inactive tab is
 * `--muted-foreground`.
 */
function BottomNav({
	items,
	linkAs,
	primaryAction,
	label = "Navegación principal",
	className,
	...props
}: BottomNavProps) {
	const Link = (linkAs ?? "a") as React.ElementType;

	// A bar of two is a toggle and belongs in the header; a bar of seven is a
	// menu that has given up. Stated as a warning rather than a type, because
	// the fifth item arrives in a feature branch and the build should not stop
	// for it — but the console should say so.
	const isDev =
		typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
	if (isDev && (items.length < 3 || items.length > 5)) {
		console.warn(
			`BottomNav expects 3–5 items, received ${items.length}. See docs/design.md.`,
		);
	}

	return (
		<nav
			data-slot="bottom-nav"
			aria-label={label}
			className={cn(
				"pb-safe-2 fixed inset-x-0 bottom-0 z-40 flex min-h-(--bottom-nav-height) items-stretch gap-1 border-t border-border bg-background/95 px-2 backdrop-blur-md",
				className,
			)}
			{...props}
		>
			{items.map((item) => {
				const Icon = item.icon;
				const count = item.badge && item.badge > 0 ? item.badge : null;

				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={item.active ? "page" : undefined}
						className={cn(
							// 44px minimum and the label sits inside it, so the whole tab
							// is the target rather than the glyph. `outline-none` stays
							// because the bar's tabs want the ring below, not the global
							// outline — see the note on this component.
							"min-touch relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 pt-1.5 pb-1 text-[0.6875rem] font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
							item.active
								? "text-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<span className="relative inline-flex">
							<Icon aria-hidden="true" className="size-5" />
							{count ? (
								<span
									aria-hidden="true"
									className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-discount px-1 text-[0.625rem] leading-none font-semibold tabular-nums text-discount-foreground"
								>
									{count > 99 ? "99+" : count}
								</span>
							) : null}
						</span>
						<span className="max-w-full truncate">{item.label}</span>
						{/* The count is decoration on screen and a sentence here: "3" alone
						    is not information. */}
						{count ? (
							<span className="sr-only">
								{item.badgeLabel
									? `, ${count} ${item.badgeLabel}`
									: `, ${count}`}
							</span>
						) : null}
					</Link>
				);
			})}
			{primaryAction ? (
				<div className="flex min-touch items-center pl-1">{primaryAction}</div>
			) : null}
		</nav>
	);
}

export { BottomNav };
export type { BottomNavProps, BottomNavItem };
