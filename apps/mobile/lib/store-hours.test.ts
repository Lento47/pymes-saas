import { describe, expect, test } from "bun:test";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { groupOpeningDays, storeHoursAt } from "./store-hours";

const opening = (day: number): BusinessHoursEntry => ({
	day,
	opensMinute: 480,
	closesMinute: 1320,
	isClosed: false,
	kind: "open",
});

describe("store schedule presentation", () => {
	test("today uses the business clock across UTC midnight", () => {
		const hours = [opening(1), opening(2)];
		const mondayNight = storeHoursAt(hours, new Date("2026-10-20T03:00:00Z"));
		expect(mondayNight.day).toBe(1);
		expect(mondayNight.closesMinute).toBe(1320);
		expect(storeHoursAt(hours, new Date("2026-10-20T06:00:00Z")).day).toBe(2);
	});
	test("closing and reopening follow actual service periods around lunch", () => {
		const hours: BusinessHoursEntry[] = [
			opening(1),
			{ ...opening(1), opensMinute: 735, closesMinute: 805, kind: "break" },
		];
		expect(
			storeHoursAt(hours, new Date("2026-10-19T18:00:00Z")).closesMinute,
		).toBe(735);
		const lunch = storeHoursAt(hours, new Date("2026-10-19T18:30:00Z"));
		expect(lunch.closesMinute).toBeNull();
		expect(lunch.nextOpen).toEqual({ day: 1, daysAway: 0, opensMinute: 805 });
		expect(lunch.windows).toEqual([
			{ opensMinute: 480, closesMinute: 735 },
			{ opensMinute: 805, closesMinute: 1320 },
		]);
	});
	test("groups equal adjacent days and includes closed days without changing saved hours", () => {
		const hours = [1, 2, 3, 4, 5].map(opening);
		const before = structuredClone(hours);
		const groups = groupOpeningDays(hours);
		expect(groups.map((group) => group.days)).toEqual([
			[1, 2, 3, 4, 5],
			[6, 0],
		]);
		expect(groups[1]?.windows).toEqual([]);
		expect(hours).toEqual(before);
	});
	test("reopening skips closed days and handles tomorrow and all-closed weeks", () => {
		const friday = new Date("2026-10-17T04:00:00Z");
		expect(storeHoursAt([opening(1)], friday).nextOpen).toEqual({
			day: 1,
			daysAway: 3,
			opensMinute: 480,
		});
		expect(storeHoursAt([opening(6)], friday).nextOpen?.daysAway).toBe(1);
		expect(storeHoursAt([], friday).nextOpen).toBeNull();
	});
	test("different breaks prevent days from being grouped; equal all-week hours form one row", () => {
		const everyDay = [0, 1, 2, 3, 4, 5, 6].map(opening);
		expect(groupOpeningDays(everyDay)[0]?.days).toHaveLength(7);
		const groups = groupOpeningDays([
			...everyDay,
			{ ...opening(3), opensMinute: 720, closesMinute: 780, kind: "break" },
		]);
		expect(groups.map((group) => group.days)).toEqual([
			[1, 2],
			[3],
			[4, 5, 6, 0],
		]);
	});
});
