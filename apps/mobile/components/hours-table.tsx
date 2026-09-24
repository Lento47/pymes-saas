import { weekdayName } from "@pymeshub/i18n";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { memo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { formatMinuteOfDay } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
	radius,
	STATUS_DOT_SIZE,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

import { Text } from "./text";

/**
 * A shop's week, and whether it is open right now.
 *
 * `hours` is one `businessHoursEntrySchema` per weekday — `{ day, opensMinute, closesMinute,
 * isClosed }`, minutes since midnight rather than `"18:00"`, because a time string has to be
 * parsed by every consumer and one of them will parse it in the wrong timezone (the schema says
 * so beside the field). This table renders those numbers and decides nothing else about them.
 *
 * ## A closed day reads as closed, never as `00:00`
 *
 * `isClosed` is the shop's own statement and it is printed as the word for it — the same
 * `store.closed` `./business-card` draws. Rendering the range for a closed day would print
 * `00:00 – 00:00`, which is a timetable for a day the shop does not open, and worse, a
 * *plausible* one: a reader scanning a column of times would take it for midnight trading.
 *
 * The guard is `isClosed` **or** a range that cannot be true. `businessHoursEntrySchema`
 * refines `closesMinute > opensMinute` away on the way in, so a degenerate pair can only come
 * from a row written before that rule existed — and a client that printed it would be
 * publishing a schedule the API would refuse to accept today.
 *
 * ## The clock is 24-hour, and `lib/format` owns it
 *
 * Hours are a timetable, so the printed value is `18:00` and never `6:00 p. m.`. The formatter
 * is `formatMinuteOfDay` in `lib/format`, beside `formatClock`, which is the twelve-hour one —
 * it is the function that keeps `closesMinute = 1440`, a shop that closes at midnight, from
 * printing the same string as `opensMinute = 0`, and its docblock carries the measurement.
 * This file used to build that formatter locally; the duplicate is gone, so there is one
 * answer to "what time is midnight" in the app.
 *
 * What stays here is the *decision*, not the formatter: a week view is a timetable, and a
 * reader scanning a column compares it with the web storefront's `hours.ts`, which prints the
 * same 24-hour shape for the same reason.
 *
 * ## "Hoy" is the reader's day, and that is a decision, not an oversight
 *
 * The emphasised row is the device's weekday. `businesses.bySlug` computes `isOpen` on the
 * server precisely because working out the shop's day needs the shop's timezone, and nothing
 * on the public card carries one (`businessStorefrontSchema`). A week view can therefore mark
 * `Hoy` on a row a shop in another zone calls tomorrow — `apps/web/components/catalog/hours.ts`
 * makes the same call in its `todayEntry` and gives the same reason: the alternative is
 * inventing a timezone the contract does not carry.
 *
 * For the same reason there is no "abre a las 08:00" beside the closed word. `store.closed.until`
 * exists and `./business-card` reads it, but it is fed a time the *API* computed; deriving the
 * next opening minute here from the device's weekday would be exactly the timezone claim this
 * paragraph refuses. The state shown is the API's own `isOpen`, as a word.
 *
 * ## What a screen places, and what it places instead
 *
 * The heading line — `store.hours` on the left, the open/closed word on the right in the same
 * dot-and-word shape `./business-card` uses — is part of this component, because the state has
 * nowhere else to sit. A screen that wants a `./section-header` above it is asking for the
 * word "Horario" twice.
 *
 * Nothing is drawn for a shop with no schedule loaded: `hours` is `[]` until an owner fills it
 * in, and a table of an empty week is a claim about seven days nobody made. The state sentence
 * for that shop belongs to the storefront, which is the screen that knows whether it is open.
 *
 * ## Why this is memoised
 *
 * It draws seven weekday names and fourteen clock times, and each of those is a formatter lookup
 * — twenty-one per render of a component whose content is a pure function of `hours` and `isOpen`.
 * Its one call site is a grandchild of the storefront, which re-renders O(N) to O(N²) times per
 * load while the menu sections measure themselves for the sticky rail (`app/store/[slug]`'s
 * `offsets` state; `MenuSection`'s docblock has the arithmetic). None of those renders can change
 * this table, and the memo is what says so.
 *
 * Both props are stable, which is what makes the memo hit rather than merely exist: `hours` is
 * `store.data?.hours ?? NO_HOURS` at the call site and react-query's structural sharing keeps the
 * identity across a refetch — and the `??` arm is a module constant, so even the no-schedule case
 * is one identity for the life of the app. `isOpen` is a boolean, and `style` is absent at that
 * call site, so it is `undefined` on every render.
 *
 * It does not compare `useTheme()`'s return, and must not start: `theme/index.ts` builds a fresh
 * `{ colors, scheme }` wrapper on every call, so a memo that read it would miss every time. The
 * hooks are called inside the body below, which is the shape that lets a locale or theme switch
 * re-render this table while the offsets do not.
 */

export const HoursTable = memo(function HoursTable({
	hours,
	isOpen,
	style,
}: {
	/**
	 * `businessStorefrontSchema`'s `hours` — the week as the shop stated it.
	 *
	 * `readonly` because that is what the schema hands over and what the one call site holds:
	 * `app/store/[slug].tsx:682` derives it as `store.data?.hours ?? NO_HOURS`, both `readonly`,
	 * so a mutable parameter made the *only* caller a type error (TS4104). This component reads
	 * the array and copies it before sorting (`[...hours].sort`, `:133`) — it never writes to it,
	 * so `readonly` is the honest signature rather than a concession. The alternative fix was to
	 * spread at the call site, which would put a copy on the screen for no reader to see.
	 */
	hours: readonly BusinessHoursEntry[];
	/**
	 * The server's answer, not one computed here. `businessStorefrontSchema` carries `isOpen`
	 * beside the card for exactly this: the flag the header switches on.
	 */
	isOpen: boolean;
	/** Layout, and only layout. */
	style?: StyleProp<ViewStyle>;
}) {
	const { colors } = useTheme();
	const { t, intlLocale } = useT();

	if (hours.length === 0) return null;

	const today = new Date().getDay();

	/**
	 * Monday first. A week is read as a work week, and Sunday-first splits the two days a
	 * customer is most likely to be planning around — `apps/web/components/catalog/hours.ts`
	 * sorts its `weekOrder` the same way, against the same seven values.
	 */
	const ordered = [...hours].sort(
		(a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7),
	);

	/**
	 * Every row's name, or no table at all.
	 *
	 * `weekdayName` is `@pymeshub/i18n`'s, and it is the same function the web storefront's week
	 * list calls: the two clients used to carry one copy each, this file's half of that pair
	 * being the formatter rather than the name. It answers `null` rather than throwing when the
	 * locale cannot build one — a render-time throw would take the storefront to an error
	 * boundary over one section of it — and the rule this component keeps is unchanged: a week
	 * whose first column carries no names is not a schedule, so the table is dropped rather than
	 * drawn with gaps. That is the answer `./map` gives on a build with no native map module.
	 *
	 * One pass over seven rows buys it. The branch needs a tag no client can pass — both hand it
	 * `@pymeshub/i18n`'s own `INTL_LOCALES` value — so it is a guard against a missing
	 * capability, never a state a customer reaches.
	 */
	const rows = ordered.map((entry) => ({
		entry,
		dayName: weekdayName(entry.day, intlLocale),
	}));
	if (rows.some((row) => row.dayName === null)) return null;

	return (
		<View style={style}>
			<View style={styles.head}>
				<Text variant="heading" bold>
					{t("store.hours")}
				</Text>
				{/* The state is a dot *and* a word. `./business-card` draws the same pair with
				    the same tokens; without the word it would be a colour on its own, which the
				    review bar forbids. */}
				<View style={styles.state}>
					<View
						style={[
							styles.stateDot,
							{
								backgroundColor: isOpen
									? colors.success
									: colors.mutedForeground,
							},
						]}
					/>
					<Text variant="label" tone={isOpen ? "success" : "muted"}>
						{isOpen ? t("store.open") : t("store.closed")}
					</Text>
				</View>
			</View>

			<View style={styles.rows}>
				{rows.map(({ entry, dayName }) => {
					const isToday = entry.day === today;
					const closed =
						entry.isClosed || entry.closesMinute <= entry.opensMinute;

					const opens = formatMinuteOfDay(entry.opensMinute, intlLocale);
					const closes = formatMinuteOfDay(entry.closesMinute, intlLocale);
					/**
					 * The range, or `null` when the runtime has no clock to build it from.
					 *
					 * `formatMinuteOfDay` answers `null` rather than throwing, and the string it
					 * would otherwise be is never "null" — an unformattable range is dropped, which
					 * is the same rule the guard above follows. Reachable only if the clock
					 * constructor fails while the weekday one works, which cannot happen while both
					 * take the same locale; written out rather than left to string interpolation
					 * so that if it ever does, a row loses its time instead of gaining a lie.
					 */
					const range = closed
						? t("store.closed")
						: opens && closes
							? `${opens}–${closes}`
							: null;

					return (
						<View
							key={entry.day}
							style={styles.row}
							// One node per weekday, so the row is spoken as one sentence in the
							// order the eye reads it: "lunes, Hoy, 08:00–18:00". Without it the
							// pieces arrive as three separate stops and "Hoy" is announced with
							// nothing attached to it.
							accessible
						>
							<View style={styles.day}>
								<Text
									variant="body"
									bold={isToday}
									tone={isToday ? "default" : "muted"}
								>
									{dayName}
								</Text>
								{isToday ? (
									/* The word, not the weight, is what says which row is today: the
									   emphasis above is the second signal and the ink is not a signal
									   at all. It is also the half that survives a screen reader. */
									<Text variant="caption" tone="primary" bold>
										{t("store.today")}
									</Text>
								) : null}
							</View>
							<Text
								variant="body"
								bold={isToday}
								tone={isToday && !closed ? "default" : "muted"}
								// A column of times a reader compares by scanning, which is the same
								// reason every price in this app is `tabular`.
								tabular={!closed}
							>
								{range}
							</Text>
						</View>
					);
				})}
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	head: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		// At 200% text the word and the state stop sharing a line and the row wraps rather
		// than either half clipping.
		flexWrap: "wrap",
		marginBottom: space.sm,
	},
	state: { flexDirection: "row", alignItems: "center", gap: space.xs },
	stateDot: {
		width: STATUS_DOT_SIZE,
		height: STATUS_DOT_SIZE,
		borderRadius: radius.full,
	},
	rows: { gap: TEXT_STACK_GAP },
	row: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	day: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.xs,
		flexShrink: 1,
	},
});
