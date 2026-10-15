import { describe, expect, test } from "bun:test";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { openingWindowsForDay } from "./opening-windows";

const entry = (
	opensMinute: number,
	closesMinute: number,
	kind: BusinessHoursEntry["kind"] = "open",
): BusinessHoursEntry => ({
	day: 1,
	opensMinute,
	closesMinute,
	kind,
	isClosed: false,
});

describe("customer opening windows", () => {
	test("shows actual opening intervals without listing closed hours or lunch", () => {
		expect(
			openingWindowsForDay(
				[
					entry(480, 1080),
					entry(735, 805, "break"),
					entry(0, 480, "unavailable"),
					entry(1080, 1440, "unavailable"),
				],
				1,
			),
		).toEqual([
			{ opensMinute: 480, closesMinute: 735 },
			{ opensMinute: 805, closesMinute: 1080 },
		]);
	});
	test("merges overlapping open windows before subtracting overlapping pauses", () => {
		expect(
			openingWindowsForDay(
				[
					entry(600, 1200),
					entry(480, 900),
					entry(720, 780, "break"),
					entry(750, 840, "unavailable"),
				],
				1,
			),
		).toEqual([
			{ opensMinute: 480, closesMinute: 720 },
			{ opensMinute: 840, closesMinute: 1200 },
		]);
	});
	test("missing, closed and entirely blocked days have no opening windows", () => {
		expect(openingWindowsForDay([entry(480, 1080)], 2)).toEqual([]);
		expect(
			openingWindowsForDay(
				[entry(480, 1080), { ...entry(0, 0), isClosed: true }],
				1,
			),
		).toEqual([]);
		expect(
			openingWindowsForDay(
				[entry(480, 1080), entry(0, 1440, "unavailable")],
				1,
			),
		).toEqual([]);
	});
	test("keeps separate shifts and midnight without mutating the schedule", () => {
		const hours = [entry(1080, 1440), entry(480, 600)];
		const before = JSON.stringify(hours);
		expect(openingWindowsForDay(hours, 1)).toEqual([
			{ opensMinute: 480, closesMinute: 600 },
			{ opensMinute: 1080, closesMinute: 1440 },
		]);
		expect(JSON.stringify(hours)).toBe(before);
	});
});
