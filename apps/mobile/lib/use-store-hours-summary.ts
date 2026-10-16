import { weekdayName } from "@pymeshub/i18n";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { formatMinuteOfDay } from "./format";
import { useT } from "./i18n";
import { groupOpeningDays, storeHoursAt } from "./store-hours";

/** The compact schedule shown beside Open/Closed in both header previews. */
export function useStoreHoursSummary(
	hours: readonly BusinessHoursEntry[],
	isOpen: boolean,
) {
	const { t, locale, intlLocale } = useT();
	if (hours.length === 0) return null;
	const current = storeHoursAt(hours, new Date());
	const groupDay = current.windows.length ? current.day : current.nextOpen?.day;
	const group = groupOpeningDays(hours).find((item) =>
		item.days.includes(groupDay ?? -1),
	);
	if (!group?.windows.length) return null;
	const first = group.days[0] ?? current.day;
	const last = group.days[group.days.length - 1] ?? first;
	const short =
		locale === "es"
			? ["D", "L", "M", "X", "J", "V", "S"]
			: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const days = first === last ? short[first] : `${short[first]}–${short[last]}`;
	const spokenDays =
		group.days.length === 7
			? t("store.hours.everyDay")
			: first === last
				? (weekdayName(first, intlLocale) ?? "")
				: t("store.hours.dayRange", {
						first: weekdayName(first, intlLocale) ?? "",
						last: weekdayName(last, intlLocale) ?? "",
					});
	const minute = isOpen ? current.closesMinute : current.nextOpen?.opensMinute;
	const time = minute == null ? null : formatMinuteOfDay(minute, intlLocale);
	const timing = !time
		? null
		: isOpen
			? t("store.hours.closesAt", { time })
			: current.nextOpen?.daysAway === 0
				? t("store.hours.opensAt", { time })
				: current.nextOpen?.daysAway === 1
					? t("store.hours.opensTomorrow", { time })
					: t("store.hours.opensDay", {
							day:
								weekdayName(current.nextOpen?.day ?? current.day, intlLocale) ??
								"",
							time,
						});
	return {
		label: [days, timing].filter(Boolean).join(" · "),
		accessibilityLabel: [spokenDays, timing].filter(Boolean).join(". "),
	};
}
