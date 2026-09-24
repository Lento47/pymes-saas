import { cn } from "../lib/utils";

/**
 * The em dash every table uses for "nothing here". Shared so a missing value
 * looks identical in People, Cloud Security and Code Security.
 */
export function EmptyCellValue({ className }: { className?: string }) {
	return <span className={cn("text-muted-foreground", className)}>—</span>;
}
