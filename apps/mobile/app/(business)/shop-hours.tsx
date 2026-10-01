import { weekdayName } from "@pymeshub/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Switch } from "@/components/switch";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, type, useTheme } from "@/theme";

/**
 * The shop's week, written down.
 *
 * `hours` is one `businessHoursEntrySchema` per weekday — `{ day, opensMinute, closesMinute,
 * isClosed }`, minutes since midnight — and until this file nothing in the app could write one.
 * The column is read in three places that all disagree with an unset schedule in a way a
 * merchant can see and cannot explain: the Home header's `● OPEN · until …` reads
 * `selectedLocation.todayHours`, the storefront's `components/hours-table` draws the week, and
 * `businesses.bySlug` computes `isOpen` on the server from the same array. A shop with no hours
 * is open at all hours (`biz.settings.hours.help` says so in as many words), which is a claim
 * about the night shift that the merchant never made.
 *
 * ## Its own screen, and not a block on `./shop-settings`
 *
 * `architecture.md` lists "Business hours" as a destination under More, and `interface.md` §25
 * puts an Hours action on the command rail: the contract treats the week as somewhere you go,
 * not as a field among six. It is also the one setting that is seven decisions rather than one
 * — a name is a name, a week is seven rows of two clocks and a switch — and a form that holds
 * both is a form the merchant scrolls past the pictures to reach the times. `./shop-settings`
 * keeps the identity; this keeps the timetable; `app/business-delivery` keeps the three
 * delivery numbers. One write (`business.update`) behind all three, split across screens by
 * what the merchant is doing when they open them.
 *
 * ## The input is `HH:MM`, and it is deliberately not the display formatter
 *
 * `lib/format`'s `formatMinuteOfDay` is the *reader's* clock — a timetable printed the same way
 * on every device, `24:00` for the end of the day, locale-aware and returning `null` when it
 * cannot build. It draws `components/hours-table` and the storefront. What a merchant types is
 * not that: a box needs one canonical shape that survives being typed back, so `toClock`/`parseClock`
 * below own `HH:MM` with a zero-padded hour and `24:00` as the schema's own end of day. The two
 * agree on every value this screen can hold — `toClock` is what fills the box the first time,
 * and what lands on the server is an integer either way — but a formatter that can answer `null`
 * must never be the thing that decides whether a box is valid.
 *
 * `parseClock` also takes `08.00`, because some keyboards and some locales separate the hours
 * with a full stop and refusing that is refusing the merchant's own clock. It takes nothing else:
 * bare `0800` is two numbers and guessing which two is how a shop ends up opening at 08:00
 * when the merchant meant 18:00.
 *
 * ## A closed day keeps its times, and the boxes say so
 *
 * `isClosed` is the shop's statement that this particular day does not trade; the times under it
 * are the week's normal hours for that day, and they are still stored. Hiding them when the
 * switch goes on would make the row change shape under a thumb and would throw away the hours
 * the merchant had already typed for a holiday they want to reverse. So the boxes stay, dimmed
 * and uneditable — the same day, marked shut.
 *
 * ## "Copy to every day" is on the row, and that is the whole decision
 *
 * The dictionary's `biz.settings.hours.copyToAll` is one sentence, and there are seven rows it
 * could belong to. A single button under the list would have to pick a source day, and any rule
 * it picked — Monday's, today's, the first open one — is a rule the merchant has to learn before
 * the button does what they meant. A button on each row cannot be misread: it copies *this* day,
 * times and `isClosed` both, onto every day of the week. The write is a draft either way —
 * nothing reaches `business.update` until `biz.settings.save` — so a copy that went somewhere
 * unintended is undone by typing, not by a confirmation dialog.
 *
 * ## Overnight is refused, and `biz.settings.hours.overnight` is why that is written down here
 *
 * `businessHoursEntrySchema` refines `isClosed || closesMinute > opensMinute` away, so a shop that
 * trades `18:00 → 02:00` cannot say so in one row. The dictionary carries
 * `biz.settings.hours.overnight` ("Cierra después de medianoche") as though it could, and this
 * screen does not use it: a control that writes a range the API refuses is
 * `./shop-settings`'s "control for a silence", by another name. What the merchant gets instead is
 * `biz.settings.hours.rule`, the same sentence the schema's own refine carries — the rule, not the
 * situation it names. A shop that really does close at 02:00 can still be described honestly as
 * two rows: the night's tail belongs to the next day's `opensMinute`, which is what `0 → 1440`
 * being a legal pair is for. Fixing that is a schema question (`businessHoursEntrySchema`, and the
 * `isOpenAt` that reads it), not a form question.
 *
 * ## The seed is a work week, and it is a starting point rather than a claim
 *
 * `biz.settings.hours.add` fills seven rows with `08:00–18:00` Monday to Saturday and Sunday shut.
 * An empty grid of seven closed days would show the merchant a screen that looks like the button
 * did nothing; an empty grid of seven blank boxes would make them author a week rather than
 * correct one. The seed is the shape of a shop's week and nothing more — no merchant is told their
 * Sunday is the shut day, and the switch under Sunday is the first thing they can change.
 *
 * ## What is not here
 *
 * `biz.settings.hours.copyToAll` is the only bulk action because it is the only one the schema can
 * land. There is no per-day exception list, no holiday calendar and no second schedule: `hours` is
 * one JSON array of seven entries on the business, "read as a whole, written as a whole, and never
 * queried by hour" (the schema's own note), and a screen offering what the column cannot hold is
 * the same silence again. The write sends the array as a whole — `if (input.hours !== undefined)`
 * in `packages/trpc-api/src/services/businesses.ts` — so this screen's save replaces the week
 * rather than patching a day, which is why the form opens holding all seven and not just the ones
 * that differ.
 */
export default function ShopHours() {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const scope = useMerchantScope();

	// The branch the operator picked, falling back to the first shop they own —
	// the same resolution `./shop-settings` and `./locations` make. `businessId`
	// is optional on the scope: nothing pins it until a tab has been switched, and
	// this screen is reached from More and from the Home rail, neither of which
	// carries a parameter.
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";

	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId },
			{ enabled: businessId.length > 0 },
		),
	);

	// `null` is "this shop has no week yet", and it is what draws the empty state
	// with `biz.settings.hours.add`. A draft is an array of seven — one per weekday,
	// always, so a save can never land a duplicate day (`businessHoursSchema`
	// refines those away) and the row order is the form's own rather than the
	// order the server happened to return them in.
	const [week, setWeek] = useState<DayDraft[] | null>(null);
	// The device's weekday, the same call `components/hours-table` makes for the
	// same reason: a business row carries no timezone, so the shop's own today
	// is the server's problem (`businesses.bySlug`'s `isOpen`) and this marker is
	// the phone's.
	const today = new Date().getDay();

	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const prefilled = useRef(false);

	const update = useMutation(trpc.business.update.mutationOptions());
	const failure = useApiFailure(update.error);

	// `isLoading`, not `isPending`, and for the reason `./shop-settings` gives one
	// screen over: `settings` is `enabled: businessId.length > 0`, and a query left
	// disabled reports `isPending` for ever — which would hold the skeleton on a
	// membership that has not resolved rather than on the network.
	const waiting = useSkeletonHold(shops.isPending || settings.isLoading);

	// The week, once: a refetch after the save must not stomp the merchant's typing.
	// Left `null` where the shop has no hours, so the empty state is the real state
	// and not a form of seven blank boxes pretending to be a schedule.
	useEffect(() => {
		if (prefilled.current || !settings.data) return;
		prefilled.current = true;
		if (settings.data.hours.length > 0) setWeek(draftFrom(settings.data.hours));
	}, [settings.data]);

	const setDay = (day: number, apply: (one: DayDraft) => DayDraft) => {
		setWeek((current) =>
			current === null
				? current
				: current.map((one) => (one.day === day ? apply(one) : one)),
		);
		if (update.isError) update.reset();
	};

	/**
	 * Copy this row onto every day of the week, `isClosed` included.
	 *
	 * The whole row and not just its times: a merchant who has set Monday to
	 * `08:00–18:00` and closed is describing a week in which no day trades, and a
	 * copy that kept each day's own `isClosed` would leave that week untouched.
	 * Reversible by typing and by re-copying, and nothing leaves this screen until
	 * `biz.settings.save` — so this is a draft edit and not the kind of change
	 * `docs/design-mobile.md` puts behind a confirmation.
	 */
	const copyToAll = (source: DayDraft) => {
		setWeek((current) =>
			current === null
				? current
				: current.map((one) => ({
						day: one.day,
						opens: source.opens,
						closes: source.closes,
						closed: source.closed,
					})),
		);
		if (update.isError) update.reset();
	};

	// One error per day at most, on the box the sentence is about: a missing time
	// is that box, and a range that runs backwards is the closing one, because
	// `biz.settings.hours.rule` is a sentence about the closing time.
	const errorsOf = (one: DayDraft) => {
		const opens = parseClock(one.opens);
		const closes = parseClock(one.closes);
		if (one.closed) return { opens: null, closes: null };
		if (opens === null) {
			return {
				opens:
					one.opens.trim().length === 0
						? t("form.required")
						: t("biz.new.number.unreadable"),
				closes: null,
			};
		}
		if (closes === null) {
			return {
				opens: null,
				closes:
					one.closes.trim().length === 0
						? t("form.required")
						: t("biz.new.number.unreadable"),
			};
		}
		if (closes <= opens)
			return { opens: null, closes: t("biz.settings.hours.rule") };
		return { opens: null, closes: null };
	};

	const weekOk =
		week?.every((one) => {
			const errors = errorsOf(one);
			return errors.opens === null && errors.closes === null;
		}) ?? false;

	const submit = () => {
		if (update.isPending) return;
		setSubmitted(true);
		if (week === null || !weekOk) return;
		setSaving(true);
		update.mutate(
			{
				businessId,
				// The array as a whole, and always all seven: `businessHoursSchema`
				// refuses a duplicate day and `businesses.update` replaces the column
				// rather than merging into it.
				hours: week.map((one) => ({
					day: one.day,
					opensMinute: parseClock(one.opens) ?? 0,
					closesMinute: parseClock(one.closes) ?? 0,
					isClosed: one.closed,
				})),
			},
			{
				onSuccess: async () => {
					setSaving(false);
					toast.show(t("biz.settings.saved"));
					await cache.invalidateQueries({ queryKey: trpc.business.pathKey() });
				},
				onError: () => setSaving(false),
			},
		);
	};

	const failed = shops.error ?? settings.error;
	const ready = businessId.length > 0 && !!settings.data && !waiting;

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.settings.hours")}
				leading={<BackButton to="/more" />}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					{waiting ? (
						<ShopHoursSkeleton loadingLabel={t("state.loading")} />
					) : failed ? (
						<ErrorState
							error={failed}
							onRetry={() => {
								void shops.refetch();
								void settings.refetch();
							}}
						/>
					) : week === null ? (
						// Not an error and not a form: the shop has said nothing about
						// its week, and the sentence is what says so — without it a
						// screen with one button reads as a form that failed to load.
						<AnimateIn index={0}>
							<ScreenSection title={t("biz.settings.hours")}>
								<Text variant="body" tone="muted">
									{t("biz.settings.hours.help")}
								</Text>
								<Button
									label={t("biz.settings.hours.add")}
									variant="secondary"
									fullWidth
									style={styles.add}
									onPress={() => setWeek(seedWeek())}
								/>
							</ScreenSection>
						</AnimateIn>
					) : (
						<AnimateIn index={0}>
							<ScreenSection title={t("biz.settings.hours")}>
								{week.map((one, index) => {
									const errors = errorsOf(one);
									const shown = submitted
										? errors
										: { opens: null, closes: null };
									return (
										<View
											key={one.day}
											style={[
												styles.day,
												index < week.length - 1 && {
													borderBottomWidth: StyleSheet.hairlineWidth,
													borderBottomColor: colors.border,
												},
											]}
										>
											<View style={styles.dayHead}>
												<View style={styles.dayName}>
													<Text variant="body" bold>
														{weekdayName(one.day, intlLocale)}
													</Text>
													/*
														`action`, not `primary`: `tone="primary"` is `colors.primary`, and in the
														merchant tree that is the lime **fill**, not ink. This caption sits on
														the row's white card, so `primary` put lime `#C8FF18` on `#FFFFFF` —
														**1.18:1**. `action` is `#111111` and holds **18.88:1** here. Same
														mistake as the shop initial in `shop-settings.tsx`, and the same reason it
														survived: the consumer palette's `primary` is a dark ultramarine and reads
														fine as ink, so only the merchant tree can get this wrong.
													*/
													{one.day === today ? (
														<Text variant="caption" tone="action" bold>
															{t("store.today")}
														</Text>
													) : null}
												</View>
											</View>

											<View style={styles.dayTimes}>
												<View style={styles.time}>
													<Field
														label={t("biz.settings.hours.opens")}
														value={one.opens}
														onChangeText={(value) =>
															setDay(one.day, (draft) => ({
																...draft,
																opens: value,
															}))
														}
														error={shown.opens}
														editable={!one.closed}
														keyboardType="numbers-and-punctuation"
														maxLength={5}
														placeholder="08:00"
													/>
												</View>
												<View style={styles.time}>
													<Field
														label={t("biz.settings.hours.closes")}
														value={one.closes}
														onChangeText={(value) =>
															setDay(one.day, (draft) => ({
																...draft,
																closes: value,
															}))
														}
														error={shown.closes}
														editable={!one.closed}
														keyboardType="numbers-and-punctuation"
														maxLength={5}
														placeholder="18:00"
													/>
												</View>
											</View>

											<View style={styles.dayFoot}>
												<View style={styles.closedPair}>
													<Switch
														checked={one.closed}
														onChange={(next) =>
															setDay(one.day, (draft) => ({
																...draft,
																closed: next,
															}))
														}
														label={t("biz.settings.hours.closed")}
													/>
													<Text variant="label" tone="muted">
														{t("biz.settings.hours.closed")}
													</Text>
												</View>
												<Button
													label={t("biz.settings.hours.copyToAll")}
													variant="ghost"
													size="sm"
													onPress={() => copyToAll(one)}
												/>
											</View>
										</View>
									);
								})}
							</ScreenSection>
						</AnimateIn>
					)}

					{failure.message ? (
						<AnimateIn index={1}>
							<Text
								variant="body"
								tone="destructive"
								accessibilityRole="alert"
								accessibilityLiveRegion="assertive"
							>
								{failure.message}
							</Text>
						</AnimateIn>
					) : null}
				</SignedIn>
			</Screen>

			{ready && week !== null ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.settings.save"),
						onPress: submit,
						loading: saving,
						disabled: saving,
					}}
				/>
			) : null}
		</View>
	);
}

/** One weekday, as the boxes hold it. `opens`/`closes` are the typed strings. */
type DayDraft = {
	day: number;
	opens: string;
	closes: string;
	closed: boolean;
};

/**
 * The week the "Cargar horario" button fills in: `08:00–18:00` Monday to Saturday,
 * Sunday shut. A starting shape to correct rather than an empty grid to author —
 * see the file docblock. `day` runs 0–6 in the schema's own numbering (Sunday is
 * 0), and the form draws Monday first, so the seed is written against that
 * numbering and the sort is `./hours-table`'s.
 */
function seedWeek(): DayDraft[] {
	return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
		day,
		opens: "08:00",
		closes: "18:00",
		closed: day === 0,
	}));
}

/**
 * The stored week into the boxes, Monday first and a seed row for any weekday the
 * column left out. `businessHoursSchema` allows fewer than seven entries — the
 * refine is on *duplicate* days, not on missing ones — so a shop that answered with
 * three rows still gets a form of seven, and the four it never stated open as the
 * seed rather than as a claim.
 */
function draftFrom(hours: readonly DayDraftSource[]): DayDraft[] {
	const byDay = new Map(hours.map((entry) => [entry.day, entry]));
	return [1, 2, 3, 4, 5, 6, 0].map((day) => {
		const entry = byDay.get(day);
		if (!entry) {
			return {
				day,
				opens: "08:00",
				closes: "18:00",
				closed: day === 0,
			};
		}
		return {
			day,
			opens: toClock(entry.opensMinute),
			closes: toClock(entry.closesMinute),
			closed: entry.isClosed,
		};
	});
}

type DayDraftSource = {
	day: number;
	opensMinute: number;
	closesMinute: number;
	isClosed: boolean;
};

function toClock(minute: number): string {
	const capped = Math.max(0, Math.min(1440, Math.round(minute)));
	const hour = Math.floor(capped / 60);
	return `${String(hour).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}`;
}

/**
 * `HH:MM` (or `HH.MM`) into the schema's minutes since midnight, or `null`.
 *
 * `24:00` is the schema's own end of day — `closesMinute` is capped at 1440, and
 * `lib/format`'s `formatMinuteOfDay` prints exactly that for it — so the hour 24 is
 * accepted for the minute 00 and refused for anything else, which is what keeps a
 * typo from being read as a time past midnight. Every other hour is 0–23.
 */
function parseClock(text: string): number | null {
	const match = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour === 24) return minute === 0 ? 1440 : null;
	if (hour > 23 || minute > 59) return null;
	return hour * 60 + minute;
}

/**
 * The form in grey, seven days of it: the name line, the two boxes and their
 * reserved message rows, and the foot that carries the switch. One block carries
 * the label so the wait is announced once.
 *
 * The gaps are the ones the loaded day pays — `space.sm` inside a `./field` and
 * between a day's three lines — and the days butt on the hairline the real rows
 * draw between them, so the swap moves nothing. The two boxes are the real ones'
 * shape (`MIN_TOUCH_TARGET` floors) and the foot is a switch target over a button
 * bar; the message rows are bare `type.caption` heights rather than `./skeletons`'
 * `line()` at the reader's scale, because they mirror the reserved rows `./field`
 * actually draws and a taller stand-in for a reserved row is still a jump.
 */
function ShopHoursSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	return (
		<View style={styles.content}>
			<ScreenSection title={t("biz.settings.hours")}>
				{[0, 1, 2, 3, 4, 5, 6].map((day, index) => (
					<View
						key={day}
						style={[
							styles.day,
							index < 6 && {
								borderBottomWidth: StyleSheet.hairlineWidth,
								borderBottomColor: "transparent",
							},
						]}
					>
						<View style={styles.dayHead}>
							<Skeleton
								label={day === 0 ? loadingLabel : undefined}
								style={styles.skeletonName}
							/>
						</View>
						<View style={styles.dayTimes}>
							<View style={styles.time}>
								<Skeleton style={styles.skeletonLabel} />
								<Skeleton style={styles.skeletonInput} />
								<Skeleton style={styles.skeletonMessage} />
							</View>
							<View style={styles.time}>
								<Skeleton style={styles.skeletonLabel} />
								<Skeleton style={styles.skeletonInput} />
								<Skeleton style={styles.skeletonMessage} />
							</View>
						</View>
						<View style={styles.dayFoot}>
							<Skeleton style={styles.skeletonFoot} />
						</View>
					</View>
				))}
			</ScreenSection>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	add: { marginTop: space.md },
	day: { paddingVertical: space.md, gap: space.sm },
	dayHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: space.sm,
	},
	dayName: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: space.xs,
		flexShrink: 1,
	},
	// Two boxes side by side, stacking when the width or the text scale leaves no
	// room for both: a row that clipped one of them is a time the merchant cannot
	// read, and `./hours-table`'s header makes the same wrap call for the same
	// reason.
	dayTimes: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: space.sm,
	},
	time: { flex: 1, minWidth: 120 },
	dayFoot: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: space.sm,
	},
	closedPair: { flexDirection: "row", alignItems: "center", gap: space.xs },
	skeletonName: { width: "30%" },
	skeletonLabel: { width: "35%" },
	skeletonInput: { minHeight: MIN_TOUCH_TARGET },
	skeletonMessage: { height: type.caption.lineHeight },
	skeletonFoot: {
		width: "100%",
		minHeight: MIN_TOUCH_TARGET,
	},
});
