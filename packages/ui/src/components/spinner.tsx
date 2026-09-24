import { cn } from "@pymeshub/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";

/**
 * The spinner takes the colour of what it is inside, which is right in a button:
 * a pending "Guardar" should read as the button's own label, not as a second
 * thing on top of it. Standing on its own it is the opposite — a page waiting
 * is not the page's text — so `muted` exists for that case, and the screens that
 * want it no longer write a colour into the className.
 *
 * **It announces nothing unless it is given something to say.** This component hardcoded
 * `aria-label="Loading"`, which is the one thing it may not do: the product is
 * Spanish-first, and `packages/ui` has no `@pymeshub/i18n` dependency, so a sentence written
 * here is a sentence in the wrong language on every screen — and it was announced twice,
 * because every call site already sits inside something labelled (`<output aria-label>` in
 * `apps/web/components/states.tsx`, a button whose own label is the pending state).
 *
 * So `label` is optional and the default is **decorative**: no role, `aria-hidden`, and the
 * surrounding control keeps the meaning. Pass `label` only where the spinner is the whole
 * message and nothing else on screen is speaking — and pass it a translated string, never a
 * literal typed at the call site.
 */
const spinnerVariants = cva("size-4 animate-spin", {
	variants: {
		tone: {
			default: "",
			muted: "text-muted-foreground",
		},
	},
	defaultVariants: { tone: "default" },
});

function Spinner({
	className,
	tone,
	label,
	...props
}: React.ComponentProps<"svg"> &
	VariantProps<typeof spinnerVariants> & {
		/** A translated sentence, for the rare case where nothing else is speaking. */
		label?: string;
	}) {
	return (
		<Loader2Icon
			data-slot="spinner"
			role={label ? "status" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn(spinnerVariants({ tone }), className)}
			{...props}
		/>
	);
}

export { Spinner };
