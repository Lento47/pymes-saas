"use client";

import { cn } from "@pymeshub/ui/lib/utils";
import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * A circle with a face in it — or, until the image loads and whenever there is none, the
 * first letters of the name.
 *
 * **Whether this belongs in the accessibility tree is the call site's decision, and only
 * the call site can make it.** Nothing here sets `aria-hidden`, and that is deliberate:
 * the two cases are both common and want opposite answers.
 *
 * - **Beside the name** — a storefront header, a message in a thread. The initials repeat
 *   text a screen reader reads next anyway, so the avatar is decoration and must be hidden:
 *   `aria-hidden` on `AvatarFallback`, or on `Avatar` itself when the image is decorative
 *   too (`AvatarImage alt=""` — a logo next to an `<h1>`).
 * - **Carrying the name** — an avatar with nothing naming it alongside, where the initials
 *   are all that identifies the person. Hiding it deletes the name from the page, so it is
 *   *named* instead: `role="img"` and `aria-label` on `AvatarFallback`, with the full name
 *   it abbreviates. The role is not optional — ARIA does not name a bare `<span>`.
 *
 * A wrong answer here is silent, which is why the rule is written down rather than left to
 * taste: the fallback renders as a `<span>` with no role and no label, so a logo-less shop
 * announces "MT" a moment before "Mi Tienda" and the markup looks perfectly correct.
 */
function Avatar({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
	size?: "default" | "sm" | "lg";
}) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			data-size={size}
			className={cn(
				"group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarImage({
	className,
	referrerPolicy = "no-referrer",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			referrerPolicy={referrerPolicy}
			className={cn(
				"aspect-square size-full rounded-full object-cover",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The initials, until the image loads or when the shop or person has none.
 *
 * This is the element the rule on {@link Avatar} applies to: `aria-hidden` when a name
 * sits beside it, `role="img"` + `aria-label` when it is the name's only carrier.
 */
function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="avatar-badge"
			className={cn(
				"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group"
			className={cn(
				"group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroupCount({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group-count"
			className={cn(
				"relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
};
