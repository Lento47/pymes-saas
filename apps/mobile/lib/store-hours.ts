import {
	type BusinessHoursEntry,
	MARKET_UTC_OFFSET_MINUTES,
} from "@pymeshub/shared";
import { type OpeningWindow, openingWindowsForDay } from "./opening-windows";

const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** Use the same market clock as the API, regardless of the customer's timezone. */
export function storeHoursAt(hours: readonly BusinessHoursEntry[], at: Date) {
	const local = new Date(at.getTime() + MARKET_UTC_OFFSET_MINUTES * 60_000);
	const day = local.getUTCDay();
	const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
	const windows = openingWindowsForDay(hours, day);
	let nextOpen: { day: number; daysAway: number; opensMinute: number } | null =
		null;
	for (let daysAway = 0; daysAway <= 7; daysAway++) {
		const nextDay = (day + daysAway) % 7;
		const window = openingWindowsForDay(hours, nextDay).find(
			(item) => daysAway > 0 || item.opensMinute > minute,
		);
		if (window) {
			nextOpen = { day: nextDay, daysAway, opensMinute: window.opensMinute };
			break;
		}
	}
	return {
		day,
		windows,
		closesMinute:
			windows.find(
				(window) =>
					minute >= window.opensMinute && minute < window.closesMinute,
			)?.closesMinute ?? null,
		nextOpen,
	};
}

/** Consecutive days with identical service periods share one weekly row. */
export function groupOpeningDays(hours: readonly BusinessHoursEntry[]) {
	const groups: { days: number[]; windows: OpeningWindow[]; key: string }[] =
		[];
	for (const day of WEEK) {
		const windows = openingWindowsForDay(hours, day);
		const key = windows
			.map((window) => `${window.opensMinute}-${window.closesMinute}`)
			.join("|");
		const previous = groups[groups.length - 1];
		if (previous?.key === key) previous.days.push(day);
		else groups.push({ days: [day], windows, key });
	}
	return groups;
}
