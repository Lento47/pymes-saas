import { weekdayName } from "@pymeshub/i18n";
import type { BusinessHoursKind } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	cancelAnimation,
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Pressable } from "@/components/pressable";
import { Screen, ScreenSection } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { duration, exitDuration, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import { useTRPC } from "@/lib/trpc/context";
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
 * ## The card's two verbs: a tap edits, and the swipe removes
 *
 * `biz.settings.hours.edit` and `biz.settings.hours.remove` are the card's two controls, and
 * both are the card itself: it is the surface they act on, and a head that carries the kind's
 * name should not also carry a control bar. A tap opens the same composer the "add" button
 * gives — same kind chips, same day chips, same clocks, prefilled from the block and placed
 * where that block's card stood. `editingKey` is what tells the composer's two jobs apart —
 * the key of the block it was opened from, or `null` while it is adding one — and a commit
 * replaces that key in place or appends. The write is untouched: the draft is still the whole
 * week and `business.update` still sees it only when the save bar is pressed — which is why
 * the commit in an edit reads `action.save` and the bar keeps `biz.settings.save`.
 *
 * Cancel is new in both places. The add composer could previously be left only by adding the
 * block, which was survivable while its contents were a row the merchant had just decided to
 * create — and became untenable once the composer could hold the hours a shop has been trading
 * on. `action.cancel` puts the list back exactly as it was, because editing never removed the
 * block to begin with.
 *
 * ## Removing a card asks twice, and the second answer is `Deshacer`
 *
 * A block is days and two clocks, so a delete is never one gesture away from happening. The
 * swipe walks through two windows instead. The card follows the finger, uncovering a
 * `biz.settings.hours.remove` panel behind it, and a release past three quarters of that panel
 * — or fast enough to be a fling — *arms* the removal: the card parks on the panel with
 * `action.cancel` in place and a bar draining the seconds that are left — the four in which
 * the thumb that started all this can still change its mind. When the bar empties the card
 * slides off and the block leaves the draft, and §46's toast — the app's own undo, eight
 * seconds of `action.undo` — holds it.
 *
 * The first window is the gesture's: "did I mean to swipe that far" is answered while the
 * answer is still under the thumb. The second is for the merchant who noticed later, and it is
 * the same undo the rest of the app offers. Neither is a confirmation dialog, and neither
 * touches the server: the draft is local, a save during the countdown sends the list as drawn
 * — the counting block included — and a restored block lands at the index it left, unsaved
 * like every other edit here.
 *
 * A screen reader never swipes. The card is a button whose label is the block's own facts, and
 * `remove` rides in its `accessibilityActions` beside the double-tap that edits; choosing it
 * skips the countdown and lands on the toast, because the countdown exists for a thumb still
 * on the glass and the announced `Deshacer` is the reader's equal of it. Under reduced motion
 * nothing travels: the card fades out of the way and the panel — its bar included, because a
 * bar that says how much time is left is information rather than movement — stands in its
 * place, the swap `components/merchant-order-row` makes for its help slot.
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
	// The key of the block the composer is editing, or `null` while it is adding
	// one. The two are always set together, and this is the key a commit files
	// under — the block it was opened from, replaced in place.
	const [editingKey, setEditingKey] = useState<string | null>(null);
	// The key of the block counting down its removal, or `null` while no removal
	// is pending. One at a time: arming a second block lets the first one go,
	// its countdown cancelled with it — `removeBlock` below is the timer's end.
	const [armedKey, setArmedKey] = useState<string | null>(null);
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

	/**
	 * Editing opens the composer where the block stands. The block is copied rather
	 * than held — the composer is the draft, and cancelling has to leave the list
	 * exactly as it was — and its key is remembered, because that is what a commit
	 * files the block back under.
	 */
	const openEditor = (block: HoursBlock) => {
		setComposerError(null);
		setEditingKey(block.key);
		setComposer({ ...block, days: [...block.days] });
	};

	const cancelComposer = () => {
		setComposer(null);
		setComposerError(null);
		setEditingKey(null);
	};

	const commitComposer = () => {
		if (!composer) return;
		const error = blockError(composer);
		setComposerError(error);
		if (error) return;
		const editing = editingKey;
		setBlocks((current) =>
			editing === null
				? [...(current ?? []), composer]
				: (current ?? []).map((one) => (one.key === editing ? composer : one)),
		);
		setComposer(null);
		setComposerError(null);
		setEditingKey(null);
		if (update.isError) update.reset();
	};

	/**
	 * The block leaves the draft, and the toast holds it for eight seconds.
	 *
	 * The countdown on the card is the first answer to a change of mind and this
	 * is the second: a countdown belongs to the thumb still on the glass, and
	 * `action.undo` is for the merchant who noticed afterwards. Nothing is saved
	 * either way — the same local draft every edit here lives in — so `Deshacer`
	 * puts the block back at the index it left, unsaved like the rest of them.
	 */
	const removeBlock = (key: string) => {
		const list = blocks ?? [];
		const index = list.findIndex((one) => one.key === key);
		const removed = list[index];
		if (!removed) return;
		setArmedKey(null);
		setBlocks(list.filter((one) => one.key !== key));
		toast.show(t("biz.settings.hours.removed"), () => {
			setBlocks((current) => {
				const next = [...(current ?? [])];
				next.splice(Math.min(index, next.length), 0, removed);
				return next;
			});
		});
	};

	const blocksOk = (blocks ?? []).every((block) => blockError(block) === null);

	const submit = () => {
		if (update.isPending) return;
		if (blocks === null || !blocksOk || composer !== null) return;
		// A pending removal is not part of the draft yet: the counting card is
		// still in `blocks`, so the save keeps the block and the countdown is
		// cancelled with it. What the merchant saw is what lands.
		if (armedKey !== null) setArmedKey(null);
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
								{blocks.map((block) =>
									composer !== null && editingKey === block.key ? (
										<HoursComposer
											key={block.key}
											block={composer}
											editing
											error={composerError}
											locale={intlLocale}
											bounds={openBounds(blocks)}
											onChange={setComposer}
											onCommit={commitComposer}
											onCancel={cancelComposer}
											onOpenClock={setClock}
										/>
									) : (
										<HoursBlockCard
											key={block.key}
											block={block}
											armed={armedKey === block.key}
											onEdit={() => openEditor(block)}
											onArm={() => {
												selection();
												setArmedKey(block.key);
											}}
											onCancelArm={() => setArmedKey(null)}
											onRemove={() => removeBlock(block.key)}
										/>
									),
								)}
								{composer !== null && editingKey === null ? (
									<HoursComposer
										block={composer}
										error={composerError}
										locale={intlLocale}
										bounds={openBounds(blocks)}
										onChange={setComposer}
										onCommit={commitComposer}
										onCancel={cancelComposer}
										onOpenClock={setClock}
									/>
								) : composer === null ? (
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
								) : null}
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
						onChange={(next) => setComposer({ ...composer, [clock]: next })}
					/>
				) : null}
			</Sheet>
		</View>
	);
}

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const HOURS_KINDS = ["open", "break", "unavailable"] as const;

/** How wide the panel behind a card is — and what a full reveal uncovers. */
const REVEAL_WIDTH = 128;
/** Past three quarters of the reveal — or a fling's speed — a release arms. */
const ARM_DISTANCE = 96;
const FLING_VELOCITY = 800;
/** The whole countdown an armed card gives the thumb to change its mind. */
const REMOVE_COUNTDOWN = 4000;

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

/**
 * One block in the draft: its facts, the tap that edits them, and the swipe that
 * removes them.
 *
 * The swipe is a real pan — the card follows the finger, one-to-one and clamped
 * to the width of the panel it uncovers — and then a question with a deadline: a
 * release past `ARM_DISTANCE`, or a fling's own speed, parks the card on the
 * panel, whose face swaps `biz.settings.hours.remove` for `action.cancel` while
 * the bar drains `REMOVE_COUNTDOWN`. When the bar empties the card slides off
 * and `onRemove` fires; a tap before that cancels and springs the card back, and
 * a cancelled removal never happened. The screen's own note has the why; this is
 * the mechanical half.
 *
 * ## Reduced motion and the screen reader
 *
 * With reduced motion there is no travel: the card fades out and the panel
 * stands in its place — the swap `components/merchant-order-row` makes for its
 * help slot — and the bar still drains, because a bar that says how much time is
 * left is information rather than movement. A screen reader never swipes: the
 * card is the button, its label is the block's own facts, and choosing `remove`
 * in its `accessibilityActions` skips the countdown and lands on the announced
 * Undo, which the toast owns.
 */
function HoursBlockCard({
	block,
	armed,
	onEdit,
	onArm,
	onCancelArm,
	onRemove,
}: {
	block: HoursBlock;
	/** This card is the one counting down — the list arms one removal at a time. */
	armed: boolean;
	onEdit: () => void;
	onArm: () => void;
	onCancelArm: () => void;
	/** The countdown ran out, or a reader asked for the removal outright. */
	onRemove: () => void;
}) {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const reduceMotion = useReducedMotion();
	const { width } = useWindowDimensions();
	const translateX = useSharedValue(0);
	const slide = useSharedValue(0);
	const progress = useSharedValue(0);

	// `onRemove` is a fresh closure every render and the countdown must not
	// restart because of that, so the worklet goes through this stable
	// indirection while the ref carries the latest callback.
	const removeRef = useRef(onRemove);
	useEffect(() => {
		removeRef.current = onRemove;
	}, [onRemove]);
	const fireRemove = useCallback(() => removeRef.current(), []);

	// One clock for the whole removal: the bar on the panel and the card's exit
	// read from the same `progress`, and cancelling is one `cancelAnimation`.
	useEffect(() => {
		if (!armed) {
			cancelAnimation(progress);
			cancelAnimation(slide);
			progress.value = 0;
			slide.value = 0;
			translateX.value = withSpring(0, spring.layout);
			return;
		}
		progress.value = withTiming(
			1,
			{ duration: REMOVE_COUNTDOWN, easing: Easing.linear },
			(finished) => {
				if (!finished) return;
				if (reduceMotion) {
					runOnJS(fireRemove)();
					return;
				}
				slide.value = withTiming(
					1,
					{ duration: exitDuration(duration.entering) },
					(gone) => {
						if (gone) runOnJS(fireRemove)();
					},
				);
			},
		);
	}, [armed, fireRemove, progress, reduceMotion, slide, translateX]);

	// `components/merchant-order-row`'s pan, except this one follows: the drag
	// itself is the question the removal asks, so it is drawn as it is asked.
	const pan = Gesture.Pan()
		.enabled(!armed)
		.activeOffsetX(-24)
		.failOffsetY(12)
		.onUpdate((event) => {
			// One-to-one up to the panel, with a little rubber band past it, so
			// a drag that means it is visibly past the reveal before it lets go.
			translateX.value = Math.max(
				-REVEAL_WIDTH - 24,
				Math.min(0, event.translationX),
			);
		})
		.onEnd((event) => {
			const arming =
				event.translationX <= -ARM_DISTANCE ||
				event.velocityX <= -FLING_VELOCITY;
			if (!arming) {
				translateX.value = withSpring(0, spring.layout);
				return;
			}
			if (reduceMotion) {
				runOnJS(onArm)();
				return;
			}
			translateX.value = withSpring(-REVEAL_WIDTH, spring.layout);
			runOnJS(onArm)();
		});

	const cardStyle = useAnimatedStyle(() => {
		const offset = translateX.value - slide.value * width;
		return { transform: [{ translateX: reduceMotion ? 0 : offset }] };
	});
	const barStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: progress.value * REVEAL_WIDTH }],
	}));

	const kind = t(`biz.settings.hours.kind.${block.kind}`);
	const days = block.days
		.map((day) => weekdayName(day, intlLocale))
		.filter((name): name is string => name !== null)
		.join(", ");
	// What a reader hears is what the card draws, in that order. The swipe has
	// no vocabulary for a screen reader, so `remove` below is the door instead.
	const opens = `${t("biz.settings.hours.from")} ${block.opens}`;
	const closes = `${t("biz.settings.hours.to")} ${block.closes}`;
	const facts = [kind, days, `${opens}, ${closes}`]
		.filter((part) => part.length > 0)
		.join(". ");
	const removeAction = [
		{ name: "remove", label: t("biz.settings.hours.remove") },
	];

	return (
		<View style={styles.shell}>
			<Pressable
				onPress={onCancelArm}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				style={[styles.underlay, { backgroundColor: colors.destructive }]}
			>
				<Text
					variant="label"
					bold
					style={{ color: colors.destructiveForeground }}
				>
					{armed ? t("action.cancel") : t("biz.settings.hours.remove")}
				</Text>
				{armed ? (
					<View style={styles.underlayTrack}>
						<Animated.View
							style={[
								styles.underlayBar,
								{ backgroundColor: colors.destructiveForeground },
								barStyle,
							]}
						/>
					</View>
				) : null}
			</Pressable>
			<GestureDetector gesture={pan}>
				<Animated.View
					style={[cardStyle, { opacity: armed ? (reduceMotion ? 0 : 0.6) : 1 }]}
				>
					<Pressable
						onPress={armed ? onCancelArm : onEdit}
						accessibilityRole="button"
						accessibilityLabel={armed ? t("action.cancel") : facts}
						accessibilityHint={armed ? undefined : t("action.edit")}
						accessibilityActions={armed ? undefined : removeAction}
						onAccessibilityAction={(event) => {
							if (event.nativeEvent.actionName === "remove") onRemove();
						}}
						style={[
							styles.block,
							{ borderColor: colors.border, backgroundColor: colors.card },
						]}
					>
						<Text variant="body" bold>
							{kind}
						</Text>
						<Text variant="caption" tone="muted">
							{days}
						</Text>
						<Text variant="body" tabular>
							{block.opens}–{block.closes}
						</Text>
					</Pressable>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

function HoursComposer({
	block,
	editing = false,
	error,
	locale,
	bounds,
	onChange,
	onCommit,
	onCancel,
	onOpenClock,
}: {
	block: HoursBlock;
	/** The composer is holding a block from the list rather than one being added. */
	editing?: boolean;
	error: string | null;
	locale: string;
	/** Opening and closing of the days the shop actually serves. */
	bounds: { start: string; end: string };
	onChange: (next: HoursBlock) => void;
	onCommit: () => void;
	onCancel: () => void;
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
									color: chosen ? colors.primaryForeground : colors.foreground,
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
									color: chosen ? colors.primaryForeground : colors.foreground,
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
				label={editing ? t("action.save") : t("biz.settings.hours.add")}
				onPress={onCommit}
			/>
			{/* Under the action, not beside it — `./confirm-sheet`'s rule for a pair of
			    answers, and it holds here for the same two reasons: a row of two buttons
			    at 200% text wraps into this column anyway, and the way out belongs where
			    a thumb reaches without aiming. A ghost, because the filled control on
			    this card is the commit. */}
			<Button label={t("action.cancel")} variant="ghost" onPress={onCancel} />
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
	}, [index]);
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
				onMomentumScrollEnd={(event) =>
					settle(event.nativeEvent.contentOffset.y)
				}
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
	// The swipe's stage: the shell clips so a card travelling left goes under the
	// column's edge instead of over the gutter, and the panel it uncovers sits
	// flush with that edge — square where the card meets it, rounded where the
	// screen ends it.
	shell: { overflow: "hidden" },
	underlay: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 0,
		width: REVEAL_WIDTH,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: space.xs,
		borderTopRightRadius: radius.lg,
		borderBottomRightRadius: radius.lg,
	},
	// The countdown: a track pinned to the panel's foot, and a bar that travels
	// `barStyle`'s width as `progress` runs 0 to 1 — left to right, the direction
	// the card itself will leave in.
	underlayTrack: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 4,
		overflow: "hidden",
	},
	underlayBar: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		right: 0,
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
