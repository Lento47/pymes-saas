"use client";

import { Button } from "@pymeshub/ui/components/button";
import { cn } from "@pymeshub/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";

function Dialog({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	closeLabel = "Cerrar",
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	showCloseButton?: boolean;
	// The default is Spanish because Spanish is the product's default locale, and
	// `packages/ui` has no `@pymeshub/i18n` dependency to ask. It said "Close" until this
	// pass — English in a Spanish-first package, announced to a screen reader on every
	// dialog, which is the one string a caller could not correct. Same compromise as
	// `quantity-stepper`'s `label`: a caller with `useT` passes `t("action.close")`, and
	// **every call site in this repo now does** — the cancel dialog, both admin dialogs,
	// the reason dialog, the products list and the location sheet.
	//
	// Still optional rather than required, and that is the deliberate half: this package
	// has one caller with no dictionary at all (`command.tsx`, which passes no
	// `closeLabel` and renders no close button), so requiring the prop would push a
	// literal back inside the primitive to satisfy a type — which is the bug, one layer
	// down. The default is a fallback for a translation-free caller, never a licence to
	// ship Spanish to a reader who has a language.
	closeLabel?: string;
}) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					// `outline-none` here is deliberate, and it is not the defect `docs/design.md`
					// names. Radix renders this element through `FocusScope`, which is a
					// `<div tabIndex={-1}>` — verified in
					// `@radix-ui/react-focus-scope/dist/index.mjs`, whose `FocusScope` returns
					// `Primitive.div, { tabIndex: -1 }` — so the panel is never a Tab stop. Focus
					// lands on the first focusable descendant (or the close button), and that
					// control draws the ring from `button.tsx:7`. The only focus this element
					// itself can take is FocusScope's fallback when the dialog holds nothing
					// focusable, and ringing the whole modal for that would announce "the dialog
					// is focused", which is not something a reader can act on.
					"fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-popover p-4 text-xs/relaxed text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close data-slot="dialog-close" asChild>
						<Button
							variant="ghost"
							// 44px, from the checklist, and flush in the corner so the glyph does
							// not move: `icon-sm` is 28px, so centring it 8px in puts its middle
							// 22px from the edge, and so does a 44px box centred at 0. A close
							// button is the smallest control in the dialog and a thumb target on
							// a phone, which is the wrong pair to leave at 28.
							className="absolute top-0 right-0 min-touch"
							size="icon-sm"
						>
							<XIcon />
							<span className="sr-only">{closeLabel}</span>
						</Button>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-1 text-left", className)}
			{...props}
		/>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close asChild>
					<Button variant="outline">Close</Button>
				</DialogPrimitive.Close>
			)}
		</div>
	);
}

function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("font-heading text-sm font-medium", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"text-xs/relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
