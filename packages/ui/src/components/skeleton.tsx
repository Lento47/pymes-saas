import { cn } from "@pymeshub/ui/lib/utils";

/**
 * A placeholder in the shape of what is coming.
 *
 * `motion-reduce:animate-none` is the whole reason this file has a comment now. The pulse
 * is a slow opacity throb that runs *for as long as the wait lasts*, which is the one kind
 * of animation a reader who has asked for reduced motion is asking to be spared: an
 * entrance is over in a moment, and this one is over when the network decides. Tailwind's
 * variant reads the same `prefers-reduced-motion` the CSS animation respects, so the
 * placeholder becomes a flat block with no work at the call site.
 *
 * The mobile app already answers this — `apps/mobile/components/skeleton.tsx` reads
 * `useReducedMotion` and skips its shimmer, and `pressable`/`animate-in` skip theirs. The
 * web primitive was the one place the question was never asked, so a reader on a slow
 * connection got a throb they had explicitly turned off.
 *
 * The state is not carried by the pulse: a skeleton says "loading" by its shape and by the
 * `role="status"` a screen puts on it, not by moving.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				"animate-pulse rounded-md bg-muted motion-reduce:animate-none",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
