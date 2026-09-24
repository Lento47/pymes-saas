import { Spinner } from "@pymeshub/ui/components/spinner";
import { type Bloom, bloomClass } from "@pymeshub/ui/lib/dither";
import { cn } from "@pymeshub/ui/lib/utils";
import type * as React from "react";

/**
 * The five states anything in this app can be in.
 *
 * Named for meaning rather than colour so a status reads the same everywhere:
 * "the agent failed" and "the deal was lost" are both `error`, and neither
 * caller gets to pick a shade.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const TONE_COLOR: Record<StatusTone, string> = {
	neutral: "var(--color-muted-foreground)",
	info: "var(--color-info)",
	success: "var(--color-success)",
	warning: "var(--color-warning)",
	error: "var(--color-destructive)",
};

function IndicatorDot({
	tone = "neutral",
	color,
	pulse = false,
	bloom = "low",
	className,
	style,
	...props
}: React.ComponentProps<"span"> & {
	tone?: StatusTone;
	/** An explicit colour, for scales the tones do not cover. */
	color?: string;
	pulse?: boolean;
	bloom?: Bloom;
}) {
	const resolved = color ?? TONE_COLOR[tone];

	return (
		<span
			data-slot="indicator-dot"
			data-tone={tone}
			className={cn(
				"inline-block size-1.5 shrink-0",
				// `motion-reduce:animate-none`: the dot keeps its colour and loses its throb,
				// which is the whole signal a reader who asked for reduced motion wants. A
				// pulsing dot that a setting cannot stop is the setting not being honoured.
				pulse && "animate-pulse motion-reduce:animate-none",
				bloomClass(bloom),
				className,
			)}
			style={
				{
					backgroundColor: resolved,
					"--bloom-color": resolved,
					...style,
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}

/**
 * A dot and a word — the only way this app shows a status.
 *
 * Deliberately not a badge: a table of pill-shaped chips in five colours is a
 * table you read the chips of instead of the rows. A dot carries the same
 * meaning at a tenth of the ink, and a column of them lines up.
 */
function StatusIndicator({
	tone = "neutral",
	color,
	label,
	pulse = false,
	/** In-flight work: a spinner replaces the dot, as nothing is settled yet. */
	busy = false,
	bloom = "low",
	className,
	...props
}: Omit<React.ComponentProps<"span">, "color"> & {
	tone?: StatusTone;
	color?: string;
	label: React.ReactNode;
	pulse?: boolean;
	busy?: boolean;
	bloom?: Bloom;
}) {
	return (
		<span
			data-slot="status-indicator"
			data-tone={tone}
			className={cn(
				"inline-flex min-w-0 items-center gap-2 text-muted-foreground",
				className,
			)}
			{...props}
		>
			{busy ? (
				<Spinner className="size-3 shrink-0" />
			) : (
				<IndicatorDot
					tone={tone}
					color={color}
					pulse={pulse}
					bloom={bloom}
					aria-hidden="true"
				/>
			)}
			<span className="truncate">{label}</span>
		</span>
	);
}

export { IndicatorDot, StatusIndicator, TONE_COLOR };
