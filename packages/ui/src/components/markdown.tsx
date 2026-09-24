"use client";

import { cn } from "@pymeshub/ui/lib/utils";
import { Streamdown } from "streamdown";

/**
 * Markdown written by a machine, rendered like the rest of the app.
 *
 * `Streamdown` rather than a plain markdown renderer because this text arrives
 * a token at a time: a conventional parser sees `**bol` mid-stream and renders
 * the asterisks, then reflows the paragraph when the rest lands. This one
 * completes incomplete syntax as it goes, so a streaming answer reads as prose
 * the whole way through instead of flickering between source and output.
 *
 * The styling is spelled out rather than borrowed from a typography plugin.
 * The agent writes short answers with the occasional list, link or snippet —
 * six selectors cover all of it, and a prose preset would bring a type scale
 * that fights the sheet it sits in.
 *
 * No rounded corners, per `design.md`, including on code blocks.
 */
export function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<Streamdown
			// Shiki ships both themes; the surrounding `.dark` class picks one.
			shikiTheme={["github-light", "github-dark"]}
			className={cn(
				// `text-xs`, like everything else in a record sheet — this only ever
				// renders inside the Agent tab of one.
				"min-w-0 space-y-2.5 text-xs/5 wrap-break-word",
				// Headings are rare in a chat answer and should not shout when they
				// do appear — the sheet already has a heading hierarchy.
				"[&_h1]:font-medium [&_h1]:text-xs [&_h2]:font-medium [&_h2]:text-xs [&_h3]:font-medium [&_h3]:text-xs",
				"[&_p]:text-pretty",
				"[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5",
				"[&_a]:underline [&_a]:underline-offset-2",
				"[&_strong]:font-medium",
				// Inline code sits inside a sentence, so it keeps the line height it
				// was given and takes only a tint.
				"[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
				"[&_pre]:overflow-x-auto [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
				"[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
				"[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:px-2 [&_td]:py-1",
				"[&_hr]:border-border",
				className,
			)}
		>
			{children}
		</Streamdown>
	);
}
