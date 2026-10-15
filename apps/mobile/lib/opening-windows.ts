import type { BusinessHoursEntry } from "@pymeshub/shared";

export type OpeningWindow = { opensMinute: number; closesMinute: number };

/** Available visiting intervals, after pauses have been removed. */
export function openingWindowsForDay(
	hours: readonly BusinessHoursEntry[],
	day: number,
): OpeningWindow[] {
	const entries = hours.filter((entry) => entry.day === day);
	if (entries.some((entry) => entry.isClosed)) return [];
	const windows: OpeningWindow[] = [];
	for (const entry of entries
		.filter(
			(entry) =>
				(entry.kind ?? "open") === "open" &&
				entry.closesMinute > entry.opensMinute,
		)
		.sort((a, b) => a.opensMinute - b.opensMinute)) {
		const previous = windows[windows.length - 1];
		if (previous && previous.closesMinute >= entry.opensMinute) {
			previous.closesMinute = Math.max(
				previous.closesMinute,
				entry.closesMinute,
			);
		} else {
			windows.push({
				opensMinute: entry.opensMinute,
				closesMinute: entry.closesMinute,
			});
		}
	}
	return entries
		.filter((entry) => entry.kind === "break" || entry.kind === "unavailable")
		.reduce<OpeningWindow[]>(
			(available, blocked) =>
				available.flatMap((window) => {
					if (
						blocked.closesMinute <= window.opensMinute ||
						blocked.opensMinute >= window.closesMinute
					)
						return [window];
					return [
						...(blocked.opensMinute > window.opensMinute
							? [
									{
										opensMinute: window.opensMinute,
										closesMinute: blocked.opensMinute,
									},
								]
							: []),
						...(blocked.closesMinute < window.closesMinute
							? [
									{
										opensMinute: blocked.closesMinute,
										closesMinute: window.closesMinute,
									},
								]
							: []),
					];
				}),
			windows,
		);
}
