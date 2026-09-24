"use client";

import { Button } from "@pymeshub/ui/components/button";
import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";

// Width scale for left/right sheets (desktop only — the mobile drawer is
// full-width). Default is `sm` (forms); `lg` is the standard detail width;
// `xl` is for content that needs the extra room. `2xl` is the record sheet —
// a company, contact or deal with its tabs, which replaces what would
// otherwise be a page, and so gets close to page width.
const sheetContentVariants = cva(
	"fixed z-50 flex flex-col bg-popover bg-clip-padding text-xs/relaxed text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
	{
		variants: {
			size: {
				sm: "data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
				lg: "data-[side=left]:sm:max-w-3xl data-[side=right]:sm:max-w-3xl",
				xl: "data-[side=left]:sm:max-w-4xl data-[side=right]:sm:max-w-4xl",
				"2xl":
					"data-[side=left]:sm:max-w-5xl data-[side=right]:sm:max-w-5xl data-[side=left]:lg:w-[68vw] data-[side=right]:lg:w-[68vw]",
			},
		},
		defaultVariants: {
			size: "sm",
		},
	},
);

export type SheetSize = NonNullable<
	VariantProps<typeof sheetContentVariants>["size"]
>;

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
	return (
		<SheetPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/10 text-xs/relaxed duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
}

function SheetContent({
	className,
	children,
	side = "right",
	size,
	showCloseButton = true,
	closeLabel = "Cerrar",
	...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
	side?: "top" | "right" | "bottom" | "left";
	size?: SheetSize;
	showCloseButton?: boolean;
	// Spanish default, `closeLabel` to override — `dialog.tsx` carries the reasoning. The
	// app's one sheet (`location-sheet.tsx`) passes `t("action.close")`, as every dialog
	// does; the default exists for a caller in this package, which has no dictionary.
	closeLabel?: string;
}) {
	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Content
				data-slot="sheet-content"
				data-side={side}
				className={cn(sheetContentVariants({ size }), className)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<SheetPrimitive.Close data-slot="sheet-close" asChild>
						<Button
							variant="ghost"
							// 44px, and pulled one step into the corner to hold the glyph still —
							// see `dialog.tsx`, which carries the arithmetic. The sheet's inset was
							// 12px rather than 8, so the compensation is 1 rather than 0.
							className="absolute top-1 right-1 min-touch"
							size="icon-sm"
						>
							<XIcon />
							<span className="sr-only">{closeLabel}</span>
						</Button>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Content>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-0.5 p-4", className)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

// `default` is the form sheet — a line of instruction above some fields.
// `lg` is the record sheet, where the title is the name of the thing you
// opened and has to carry the panel the way a page heading would.
const sheetTitleVariants = cva("font-heading font-medium text-foreground", {
	variants: {
		size: {
			default: "text-sm",
			lg: "text-lg leading-tight tracking-tight",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

function SheetTitle({
	className,
	size,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Title> &
	VariantProps<typeof sheetTitleVariants>) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn(sheetTitleVariants({ size }), className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-xs/relaxed text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	sheetContentVariants,
};
