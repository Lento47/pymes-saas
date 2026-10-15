import { weekdayName } from "@pymeshub/i18n";
import type { BusinessHoursKind } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Pressable } from "@/components/pressable";
import { Sheet } from "@/components/sheet";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { selection } from "@/lib/haptics";
import { MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

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
	const [blocks, setBlocks] = useState<HoursBlock[] | null>(null);
	const [composer, setComposer] = useState<HoursBlock | null>(null);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [clock, setClock] = useState<"opens" | "closes" | null>(null);
	// The device's weekday, the same call `components/hours-table` makes for the
	// same reason: a business row carries no timezone, so the shop's own today
	// is the server's problem (`businesses.bySlug`'s `isOpen`) and this marker is
	// the phone's.
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
		setBlocks(blocksFrom(settings.data.hours));
	}, [settings.data]);

	const blockError = (block: HoursBlock): string | null => {
		if (block.days.length === 0) return t("biz.settings.hours.pickDays");
		const opens = parseClock(block.opens);
		const closes = parseClock(block.closes);
		if (opens === null || closes === null) {
			return block.opens.trim().length === 0 || block.closes.trim().length === 0
				? t("form.required")
				: t("biz.new.number.unreadable");
		}
		if (block.kind === "unavailable" && closes !== opens) return null;
		if (closes <= opens) return t("biz.settings.hours.rule");
		return null;
	};

	const commitComposer = () => {
		if (!composer) return;
		const error = blockError(composer);
		setComposerError(error);
		if (error) return;
		setBlocks((current) => [...(current ?? []), composer]);
		setComposer(null);
		setComposerError(null);
		if (update.isError) update.reset();
	};

	const blocksOk = (blocks ?? []).every((block) => blockError(block) === null);

	const submit = () => {
		if (update.isPending) return;
		if (blocks === null || !blocksOk || composer !== null) return;
		setSaving(true);
		update.mutate(
			{
				businessId,
				hours: blocks.flatMap((block) =>
					block.days.flatMap((day) =>
						windowsOf(block).map((window) => ({
							day,
							opensMinute: window.opensMinute,
							closesMinute: window.closesMinute,
							isClosed: false,
							kind: block.kind,
						})),
					),
				),
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
				leading={<BackButton to="/(business)/menu" />}
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
					) : blocks === null ? null : (
						<AnimateIn index={0}>
							<ScreenSection title={t("biz.settings.hours")}>
								<Text variant="body" tone="muted">
									{t("biz.settings.hours.help")}
								</Text>
								{blocks.length === 0 && composer === null ? (
									<Text variant="caption" tone="muted">
										{t("biz.settings.hours.pickDays")}
									</Text>
								) : null}
								{blocks.map((block) => (
									<View
										key={block.key}
										style={[
											styles.block,
											{
												borderColor: colors.border,
												backgroundColor: colors.card,
											},
										]}
									>
										<View style={styles.blockHead}>
											<Text variant="body" bold>
												{t(`biz.settings.hours.kind.${block.kind}`)}
											</Text>
											<Button
												label={t("biz.settings.hours.remove")}
												variant="ghost"
												size="sm"
												onPress={() =>
													setBlocks((current) =>
														(current ?? []).filter(
															(one) => one.key !== block.key,
														),
													)
												}
											/>
										</View>
										<Text variant="caption" tone="muted">
											{block.days
												.map((day) => weekdayName(day, intlLocale))
												.filter((name): name is string => name !== null)
												.join(", ")}
										</Text>
										<Text variant="body" tabular>
											{block.opens}–{block.closes}
										</Text>
									</View>
								))}
								{composer ? (
									<HoursComposer
										block={composer}
										error={composerError}
										locale={intlLocale}
										bounds={openBounds(blocks)}
										onChange={setComposer}
										onCommit={commitComposer}
										onOpenClock={setClock}
									/>
								) : (
									<Button
										label={
											blocks.length === 0
												? t("biz.settings.hours.add")
												: t("biz.settings.hours.another")
										}
										variant="secondary"
										fullWidth
										style={styles.add}
										onPress={() => {
											setComposerError(null);
											setComposer(emptyBlock());
										}}
									/>
								)}
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

			{ready && blocks !== null ? (
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
			<Sheet
				open={clock !== null && composer !== null}
				onClose={() => setClock(null)}
				title={
					clock === "closes"
						? t(
								composer?.kind === "open"
									? "biz.settings.hours.closes"
									: "biz.settings.hours.to",
							)
						: t(
								composer?.kind === "open"
									? "biz.settings.hours.opens"
									: "biz.settings.hours.from",
							)
				}
				closeLabel={t("action.close")}
				scrollEnabled={false}
				snapPoints={[0.46]}
			>
				{composer && clock ? (
					<ClockWheels
						value={
							clock === "opens"
								? composer.opens || "08:00"
								: composer.closes || "18:00"
						}
						allowEndOfDay={clock === "closes"}
						onChange={(next) =>
							setComposer({ ...composer, [clock]: next })
						}
					/>
				) : null}
			</Sheet>
		</View>
	);
}

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const HOURS_KINDS = ["open", "break", "unavailable"] as const;

type HoursBlock = {
	key: string;
	kind: BusinessHoursKind;
	days: number[];
	opens: string;
	closes: string;
};

function emptyBlock(): HoursBlock {
	return {
		key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		kind: "open",
		days: [],
		opens: "",
		closes: "",
	};
}

function blocksFrom(
	hours: readonly {
		day: number;
		opensMinute: number;
		closesMinute: number;
		isClosed: boolean;
		kind?: BusinessHoursKind;
	}[],
): HoursBlock[] {
	const groups = new Map<string, HoursBlock>();
	for (const entry of hours) {
		const closedDay = entry.isClosed;
		const kind = closedDay ? "unavailable" : (entry.kind ?? "open");
		const opens = closedDay ? "00:00" : toClock(entry.opensMinute);
		const closes = closedDay ? "24:00" : toClock(entry.closesMinute);
		const id = `${kind}|${opens}|${closes}`;
		const existing = groups.get(id);
		if (existing) {
			existing.days.push(entry.day);
			continue;
		}
		groups.set(id, {
			key: id,
			kind,
			days: [entry.day],
			opens,
			closes,
		});
	}
	return mergeOvernight([...groups.values()]);
}

function sameDays(left: readonly number[], right: readonly number[]): boolean {
	if (left.length !== right.length) return false;
	const a = [...left].sort();
	const b = [...right].sort();
	return a.every((day, index) => day === b[index]);
}

/** An overnight unavailable stretch is stored as evening plus morning. Show it as one block. */
function mergeOvernight(blocks: HoursBlock[]): HoursBlock[] {
	const used = new Set<string>();
	const merged: HoursBlock[] = [];
	for (const evening of blocks) {
		if (evening.kind !== "unavailable" || parseClock(evening.closes) !== 1440)
			continue;
		const morning = blocks.find(
			(block) =>
				block.kind === "unavailable" &&
				parseClock(block.opens) === 0 &&
				!used.has(block.key) &&
				sameDays(block.days, evening.days),
		);
		if (!morning) continue;
		used.add(evening.key);
		used.add(morning.key);
		merged.push({ ...evening, closes: morning.closes });
	}
	return [...blocks.filter((block) => !used.has(block.key)), ...merged];
}

function openBounds(blocks: readonly HoursBlock[]): {
	start: string;
	end: string;
} {
	let start = 8 * 60;
	let end = 18 * 60;
	let found = false;
	for (const block of blocks) {
		if (block.kind !== "open") continue;
		const opens = parseClock(block.opens);
		const closes = parseClock(block.closes);
		if (opens === null || closes === null || closes <= opens) continue;
		if (!found || opens < start) start = opens;
		if (!found || closes > end) end = closes;
		found = true;
	}
	return { start: toClock(start), end: toClock(end) };
}

function windowsOf(block: HoursBlock): {
	opensMinute: number;
	closesMinute: number;
}[] {
	const opens = parseClock(block.opens) ?? 0;
	const closes = parseClock(block.closes) ?? 0;
	if (block.kind === "unavailable" && closes < opens) {
		return [
			{ opensMinute: opens, closesMinute: 1440 },
			{ opensMinute: 0, closesMinute: closes },
		].filter((window) => window.closesMinute > window.opensMinute);
	}
	return [{ opensMinute: opens, closesMinute: closes }];
}

function HoursComposer({
	block,
	error,
	locale,
	bounds,
	onChange,
	onCommit,
	onOpenClock,
}: {
	block: HoursBlock;
	error: string | null;
	locale: string;
	/** Opening and closing of the days the shop actually serves. */
	bounds: { start: string; end: string };
	onChange: (next: HoursBlock) => void;
	onCommit: () => void;
	onOpenClock: (which: "opens" | "closes") => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	return (
		<View style={[styles.block, { borderColor: colors.border }]}>
			<Text variant="label" bold>
				{t("biz.settings.hours.days")}
			</Text>
			<View style={styles.days}>
				{HOURS_KINDS.map((kind) => {
					const chosen = block.kind === kind;
					return (
						<Pressable
							key={kind}
							onPress={() => {
								selection();
								onChange(
									kind === "unavailable"
										? {
												...block,
												kind,
												opens: bounds.end,
												closes: bounds.start,
											}
										: { ...block, kind },
								);
							}}
							accessibilityRole="radio"
							accessibilityState={{ selected: chosen }}
							style={[
								styles.dayChip,
								{
									backgroundColor: chosen ? colors.primary : colors.muted,
									borderColor: chosen ? colors.primary : colors.border,
								},
							]}
						>
							<Text
								variant="label"
								bold
								style={{
									color: chosen
										? colors.primaryForeground
										: colors.foreground,
								}}
							>
								{t(`biz.settings.hours.kind.${kind}`)}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<View style={styles.days}>
				{WEEK_DAYS.map((day) => {
					const chosen = block.days.includes(day);
					const name = weekdayName(day, locale);
					return (
						<Pressable
							key={day}
							onPress={() => {
								selection();
								onChange({
									...block,
									days: chosen
										? block.days.filter((one) => one !== day)
										: [...block.days, day],
								});
							}}
							accessibilityRole="checkbox"
							accessibilityState={{ checked: chosen }}
							accessibilityLabel={name ?? String(day)}
							style={[
								styles.dayChip,
								{
									backgroundColor: chosen ? colors.primary : colors.muted,
									borderColor: chosen ? colors.primary : colors.border,
								},
							]}
						>
							<Text
								variant="label"
								bold
								style={{
									color: chosen
										? colors.primaryForeground
										: colors.foreground,
								}}
							>
								{name}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<View style={styles.dayTimes}>
				<TimeChoice
					label={t(
						block.kind === "open"
							? "biz.settings.hours.opens"
							: "biz.settings.hours.from",
					)}
					value={block.opens || "08:00"}
					onPress={() => {
						if (!block.opens) onChange({ ...block, opens: "08:00" });
						onOpenClock("opens");
					}}
				/>
				<TimeChoice
					label={t(
						block.kind === "open"
							? "biz.settings.hours.closes"
							: "biz.settings.hours.to",
					)}
					value={block.closes || "18:00"}
					onPress={() => {
						if (!block.closes) onChange({ ...block, closes: "18:00" });
						onOpenClock("closes");
					}}
				/>
			</View>
			{error ? (
				<Text variant="caption" tone="destructive">
					{error}
				</Text>
			) : null}
			<Button
				label={t("biz.settings.hours.add")}
				onPress={onCommit}
			/>
		</View>
	);
}

function TimeChoice({
	label,
	value,
	onPress,
}: {
	label: string;
	value: string;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${value}`}
			style={[styles.timeChoice, { borderColor: colors.border }]}
		>
			<Text variant="caption" tone="muted">
				{label}
			</Text>
			<Text variant="title" bold tabular>
				{value}
			</Text>
		</Pressable>
	);
}

const WHEEL_ITEM = 44;
const WHEEL_HOURS = Array.from({ length: 24 }, (_, hour) =>
	String(hour).padStart(2, "0"),
);
const WHEEL_MINUTES = Array.from({ length: 12 }, (_, step) =>
	String(step * 5).padStart(2, "0"),
);

function ClockWheels({
	value,
	allowEndOfDay,
	onChange,
}: {
	value: string;
	allowEndOfDay: boolean;
	onChange: (next: string) => void;
}) {
	const parsed = parseClock(value) ?? 8 * 60;
	const hour = Math.min(allowEndOfDay ? 24 : 23, Math.floor(parsed / 60));
	const minute = hour === 24 ? 0 : Math.round((parsed % 60) / 5) * 5;
	const hours = allowEndOfDay ? [...WHEEL_HOURS, "24"] : WHEEL_HOURS;
	const minutes = hour === 24 ? ["00"] : WHEEL_MINUTES;
	const write = (nextHour: number, nextMinute: number) => {
		const minuteValue = nextHour === 24 ? 0 : nextMinute;
		onChange(toClock(nextHour * 60 + minuteValue));
	};
	return (
		<View style={styles.wheels}>
			<Wheel
				values={hours}
				selected={String(hour).padStart(2, "0")}
				onSelect={(next) => write(Number(next), minute)}
			/>
			<Wheel
				values={minutes}
				selected={String(minute).padStart(2, "0")}
				onSelect={(next) => write(hour, Number(next))}
			/>
		</View>
	);
}

function Wheel({
	values,
	selected,
	onSelect,
}: {
	values: readonly string[];
	selected: string;
	onSelect: (value: string) => void;
}) {
	const ref = useRef<ScrollView>(null);
	const { colors } = useTheme();
	const index = Math.max(0, values.indexOf(selected));
	const settle = (offset: number) => {
		const next = Math.round(offset / WHEEL_ITEM);
		const clamped = Math.min(values.length - 1, Math.max(0, next));
		const picked = values[clamped];
		if (picked && picked !== selected) onSelect(picked);
	};
	useEffect(() => {
		ref.current?.scrollTo({ y: index * WHEEL_ITEM, animated: false });
	}, [index, values]);
	return (
		<View style={styles.wheel}>
			<View
				pointerEvents="none"
				style={[styles.wheelMark, { borderColor: colors.border }]}
			/>
			<ScrollView
				ref={ref}
				snapToInterval={WHEEL_ITEM}
				snapToAlignment="start"
				decelerationRate="fast"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.wheelPad}
				onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
				onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
			>
				{values.map((item) => (
					<View key={item} style={styles.wheelItem}>
						<Text
							variant="title"
							bold={item === selected}
							tabular
							tone={item === selected ? "default" : "muted"}
						>
							{item}
						</Text>
					</View>
				))}
			</ScrollView>
		</View>
	);
}

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
	block: {
		gap: space.md,
		padding: space.md,
		borderWidth: 1,
		borderRadius: radius.lg,
	},
	blockHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.sm,
	},
	days: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	dayChip: {
		minHeight: MIN_TOUCH_TARGET,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		justifyContent: "center",
		borderWidth: 1,
		borderRadius: radius.full,
	},
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
	timeChoice: {
		flex: 1,
		minWidth: 120,
		minHeight: MIN_TOUCH_TARGET,
		alignItems: "center",
		justifyContent: "center",
		gap: space.xs,
		borderWidth: 1,
		borderRadius: radius.lg,
		paddingVertical: space.sm,
	},
	wheels: { flexDirection: "row", gap: space.md, height: WHEEL_ITEM * 5 },
	wheel: { flex: 1, height: WHEEL_ITEM * 5 },
	wheelPad: { paddingVertical: WHEEL_ITEM * 2 },
	wheelItem: {
		height: WHEEL_ITEM,
		alignItems: "center",
		justifyContent: "center",
	},
	wheelMark: {
		position: "absolute",
		left: 0,
		right: 0,
		top: WHEEL_ITEM * 2,
		height: WHEEL_ITEM,
		borderTopWidth: 1,
		borderBottomWidth: 1,
	},
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
