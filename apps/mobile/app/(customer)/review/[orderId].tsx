import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { StarInput } from "@/components/star-input";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure, useApiFailure } from "@/lib/api-error";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, TEXT_STACK_GAP } from "@/theme";

/**
 * The one screen in this app that writes a review, and the only place a customer can.
 *
 * `app/(customer)/order/[id].tsx` is where the offer is made — a completed order with no
 * review on it gets a bar saying "Dejar una reseña" — and this is what that bar opens. The
 * two screens are one flow split in half because the order's own page is already a long
 * receipt: a star row and a text box parked under the money lines would make the receipt
 * scroll past the thing the customer came to look at, and a form deserves the whole frame.
 *
 * ## The form is two controls, and the second one is optional on purpose
 *
 * A rating is the review: `createReviewInput.rating` is the field the write cannot be
 * posted without (`min(1)`, and the bar stays disabled until one is chosen). A comment is
 * the customer's own words and is `optional` in the same schema, so the field here says what
 * it wants and the button does not wait for it. A five-star tap that is then asked to type
 * 200 characters before anything happens is a review nobody posts.
 *
 * **There is no photo picker, and that is not an omission this screen is making.**
 * `createReviewInput.imageUrls` accepts up to four strings and `reviews.create` drops every
 * one of them: `packages/db`'s `review` table has no image column, and `reviewOf` in
 * `packages/trpc-api/src/services/mappers.ts` answers `imageUrls: []` on every row rather
 * than echoing back URLs it did not keep — its own comment says echoing them "would make a
 * client believe a re-read would return them". So this form sends the empty list it is going
 * to get back, and draws nothing that would take an answer with nowhere to put it. The
 * schema widening is the half that is not done; see `packages/db` and `reviews.create`.
 *
 * ## The two refusals are screens, not disabled buttons
 *
 * An order that is not `COMPLETED` cannot be reviewed and `reviews.create` will say so
 * ("Solo puedes reseñar un pedido completado"); an order that already has one gets
 * `onConflictDoNothing()` and the second sentence ("Ya reseñaste este pedido"). Both are
 * decided here from the **read**, before the form is drawn, because a form that submits and
 * then explains why it could not have is a form that wasted the customer's typing. The
 * words are the same ones the API would have used, which is the point of having written them
 * into the dictionary rather than inventing a third.
 *
 * The bar is a sibling of the scroller, not a child of it. `app/(business)/product-form.tsx`
 * puts its `ActionBar` inside `Screen scroll`, where it scrolls away with the form; here the
 * column is `./screen` without `scroll` and the bar is the footer of the frame, which is what
 * `./action-bar`'s `docked` exists for — "a docked bar is the footer of a form that is sized
 * to its content, so there is nothing scrolling under it to be covered".
 */
export default function Review() {
	return (
		<Screen padded={false} contentStyle={styles.page}>
			<SignedIn>
				<ReviewForm />
			</SignedIn>
		</Screen>
	);
}

function ReviewForm() {
	const { orderId } = useLocalSearchParams<{ orderId: string }>();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { t } = useT();
	const { show } = useToast();

	/**
	 * Where "back" goes on every exit from this screen.
	 *
	 * One value, used by three ways out — the back control, the two refusal screens, and the
	 * post that succeeded — because a review written about an order is a fact about *that*
	 * order and the customer who just wrote it wants to read it back where it lives. It is
	 * typed `Href` at the source rather than at each push: `expo-router` cannot see through a
	 * template literal, and every screen in this app casts at the point of the call for the
	 * same reason (`app/(delivery)/delivery.tsx` pushes `/order/${order.id}` the same way).
	 */
	const back = `/order/${orderId}` as Href;

	const query = useQuery(trpc.orders.byId.queryOptions({ id: orderId }));
	const waiting = useSkeletonHold(query.isPending);

	/**
	 * The rating, and why it is `null` before anything is chosen.
	 *
	 * `null` rather than `0`: "nothing chosen yet" is a state of this form and not a rating of
	 * zero stars, and a `0` would be a number the write schema refuses outright
	 * (`createReviewInput.rating` is `min(1).max(5)`), so a client holding one would be
	 * holding a value it could not post. The bar's `disabled` reads the same flag.
	 */
	const [rating, setRating] = useState<number | null>(null);
	const [comment, setComment] = useState("");
	// A guard rather than a disabled button alone: two taps inside one frame both pass an
	// `isPending` check that has not re-rendered yet, and a second review is a row the API
	// then answers with `ConflictError` — see `reviews.create`'s `onConflictDoNothing`.
	const inFlight = useRef(false);

	const post = useMutation(
		trpc.orders.review.mutationOptions({
			onSuccess: async () => {
				// Both the order (which now carries `review`) and the shop's list, which
				// reads the same rows — one `orders` key covers the read this screen opened
				// and the one the customer returns to, which is the same subtree.
				await cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
				show(t("review.thanks"));
				leaveScreen(back);
			},
		}),
	);

	// `ConflictError` and `ValidationError` are the two refusals `reviews.create` can answer
	// with, and both carry their meaning in `code` rather than in a `domainCode` of their own
	// (`packages/trpc-api/src/errors.ts`: `ValidationError` is `BAD_REQUEST`, `ConflictError`
	// is `CONFLICT`). So the overrides are keyed by those codes, and a race that gets past the
	// read-side guards below still lands on the sentence the API would have said.
	const failure = useApiFailure(post.error, {
		CONFLICT: "review.already",
		BAD_REQUEST: "review.onlyCompleted",
	});

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone, so the assertion on the
	 * failure line below is the whole of Android's announcement and iOS, which ignores the
	 * prop, has to be told. Guarded by the platform rather than announced on both: a sentence a
	 * live region has already spoken is not read twice, it is read as two sentences. Same
	 * effect, same reason, as `app/(business)/product-form.tsx`.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !failure.message) return;
		AccessibilityInfo.announceForAccessibility(failure.message);
	}, [failure.message]);

	const edited = (apply: () => void) => {
		apply();
		if (post.isError || post.isSuccess) post.reset();
	};

	const submit = () => {
		if (inFlight.current || rating === null) return;
		inFlight.current = true;

		post.mutate(
			{
				orderId,
				rating,
				comment: comment.trim() || undefined,
				// Sent as the empty list on purpose. The input accepts up to four URLs and the
				// write stores none of them — there is no column — so a form that drew a picker
				// here would be a control with nowhere to put its answer. See the file
				// docblock.
				imageUrls: [],
			},
			{ onSettled: () => (inFlight.current = false) },
		);
	};

	if (query.isError)
		// Same sentence, same reason, as `app/(customer)/order/[id].tsx`: an order we do not
		// have is a dead link or somebody else's, and the API answers those two the same way
		// on purpose. No Retry asking again for something that will not appear.
		return (
			<View style={styles.padded}>
				{toApiFailure(query.error).code === "NOT_FOUND" ? (
					<EmptyState
						icon="receipt-outline"
						title={t("order.notFound")}
						body={t("order.notFound.body")}
						actionLabel={t("action.back")}
						onAction={() => leaveScreen("/orders")}
					/>
				) : (
					<ErrorState
						error={query.error}
						onRetry={() => void query.refetch()}
					/>
				)}
			</View>
		);

	// Guarded on the data, not on `isPending`: the skeleton's minimum hold keeps this screen on
	// placeholders for a moment after the answer has landed, and the flag alone would let the
	// render below read an undefined order inside that window.
	const order = query.data;
	if (waiting || !order) return <ReviewSkeleton label={t("state.loading")} />;

	/**
	 * The two refusals, and both are the read's own facts rather than a rule restated here.
	 *
	 * `status` and `review` come off `orderDetailSchema` and are the same two fields
	 * `reviews.create` inspects before it writes: the status has to be `COMPLETED`, and there
	 * has to be no row on the order yet. Deciding it here means the customer is told before
	 * they type rather than after — which is the difference between a screen that says no and
	 * a screen that lets somebody write a paragraph and then throws it away.
	 */
	if (order.review !== null)
		return (
			<View style={styles.padded}>
				<EmptyState
					icon="checkmark-circle-outline"
					title={t("review.already")}
					actionLabel={t("action.back")}
					onAction={() => leaveScreen(back)}
				/>
			</View>
		);

	if (order.status !== "COMPLETED")
		return (
			<View style={styles.padded}>
				<EmptyState
					icon="time-outline"
					title={t("review.onlyCompleted")}
					actionLabel={t("action.back")}
					onAction={() => leaveScreen(back)}
				/>
			</View>
		);

	return (
		<View style={styles.page}>
			<View style={styles.chrome}>
				<BackButton to={back} />
			</View>

			{/* The form's own scroller, not `./screen`'s: the bar below is a sibling of this
			    and cannot be inside it. The three keyboard props are the form's half of the
			    same bargain `./screen`'s `keyboardInsets` strikes for a screen that scrolls —
			    set here because that prop is on `Screen`, and this screen passes `scroll` on
			    neither side of the split. `keyboardDismissMode` drops the keyboard on the
			    drag that reads the rest of the form; `automaticallyAdjustKeyboardInsets` is
			    iOS's own and iOS's alone, so it is *absent* on Android rather than false. */}
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
				automaticallyAdjustKeyboardInsets={
					Platform.OS === "ios" ? true : undefined
				}
			>
				{/* The question, and why answering it is worth a moment. The subtitle is the
				    same sentence the order screen's bar shows, so the offer and the form it
				    opens read as one thought rather than as a jump to a different screen. */}
				<AnimateIn index={0}>
					<View style={styles.stack}>
						<Text variant="title" bold>
							{t("review.title")}
						</Text>
						<Text variant="body" tone="muted">
							{t("review.subtitle")}
						</Text>
					</View>
				</AnimateIn>

				{/* Which order this is for, in the two facts a customer recognises: the shop's
				    own name and the number on the receipt. `./review-list` draws the author's
				    name for the same reason — a rating with nothing to anchor it is a rating
				    about something the reader cannot picture. */}
				<AnimateIn index={1}>
					<View style={styles.stack}>
						<Text variant="body" bold>
							{order.business.name}
						</Text>
						<Text variant="caption" tone="muted" tabular>
							{order.reference}
						</Text>
					</View>
				</AnimateIn>

				{/* The rating. The group's name is drawn as words above it — `./switch`'s rule
				    for a control that labels itself through `accessibilityLabel` — and the
				    same string is what the five positions are named with, so the sentence a
				    reader hears and the sentence a sighted customer reads are one fact. */}
				<AnimateIn index={2}>
					<View style={styles.group}>
						<Text variant="label" bold>
							{t("review.rating")}
						</Text>
						<StarInput
							value={rating}
							onChange={(next) => edited(() => setRating(next))}
							label={t("review.rating")}
							disabled={post.isPending}
						/>
					</View>
				</AnimateIn>

				{/* The words, optional and last: a customer with a rating and nothing to add
				    taps the bar without ever touching this box, and one with something to say
				    is already at the bottom of a short form. `Field` reserves its message row
				    so nothing under it moves when the failure line below appears. */}
				<AnimateIn index={3}>
					<Field
						label={t("review.comment")}
						value={comment}
						onChangeText={(next) => edited(() => setComment(next))}
						placeholder={t("review.comment.placeholder")}
						multiline
						maxLength={1000}
						editable={!post.isPending}
					/>
				</AnimateIn>

				{failure.message ? (
					<Text
						variant="body"
						tone="destructive"
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						{failure.message}
					</Text>
				) : null}
			</ScrollView>

			{/* A sibling of the scroller and the frame's footer — see the file docblock on why
			    it is not inside the scroll the way `app/(business)/product-form.tsx`'s is.

			    Disabled rather than hidden until a rating is chosen: "Enviar reseña" says what
			    the button does and the sentence beside it says why it cannot yet, which is
			    this design system's own rule for an unavailable control — `./action-bar`
			    states it as "the sentence beside it says why", and `app/(customer)/order/[id].tsx`
			    writes it down again for the cancel that cannot fire. No haptic on this tap:
			    `lib/haptics.ts`'s vocabulary is for a change this app *made*, and the change
	            arrives from the server — the toast and the trip back are that answer. */}
			<ActionBar
				docked
				primary={{
					label: t("review.submit"),
					onPress: submit,
					loading: post.isPending,
					disabled: post.isPending || rating === null,
					accessibilityHint: rating === null ? t("form.required") : undefined,
				}}
				summary={
					<Text variant="caption" tone="muted">
						{rating === null ? t("form.required") : t("review.subtitle")}
					</Text>
				}
			/>
		</View>
	);
}

/**
 * The form's column, before the read answers: the heading and its sentence, the two lines
 * that say which order this is for, the rating group's label over its five positions, and
 * the comment box with its reserved message row.
 *
 * The heights are the real form's at the reader's text scale — every line goes through
 * `line()` rather than through a fixed number, the way `app/(business)/product-form.tsx`'s
 * skeleton does — so the page does not jump when the values land. The rating row is drawn at
 * `MIN_TOUCH_TARGET`, the floor `./pressable` already applies to each of its five positions
 * and the height a real group is; a five-mark row standing in for five controls is the one
 * shape here that has no text of its own to size it.
 *
 * `./skeleton`'s `Skeleton` carries the label on the first line — a shape with no text in the
 * accessibility tree is a shape a reader is told nothing about.
 */
function ReviewSkeleton({ label }: { label: string }) {
	const { fontScale } = useWindowDimensions();

	return (
		<View style={styles.padded}>
			<View style={styles.stack}>
				<Skeleton style={[styles.skeletonTitle, line("title", fontScale)]} />
				<Skeleton style={[styles.skeletonBody, line("body", fontScale)]} />
			</View>

			<View style={styles.stack}>
				<Skeleton style={[styles.skeletonBody, line("body", fontScale)]} />
				<Skeleton
					style={[styles.skeletonCaption, line("caption", fontScale)]}
				/>
			</View>

			<View style={styles.group}>
				<Skeleton
					label={label}
					style={[styles.skeletonCaption, line("label", fontScale)]}
				/>
				<Skeleton style={styles.skeletonStars} />
			</View>

			<View style={styles.group}>
				<Skeleton style={[styles.skeletonCaption, line("label", fontScale)]} />
				<Skeleton style={styles.skeletonInput} />
				<Skeleton
					style={[styles.skeletonMessage, line("caption", fontScale)]}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// The column the screen is: the pinned back control, the scroll, and the bar — so the
	// scroll takes whatever height the other two do not, and neither of them moves. Same
	// measure as `app/(customer)/order/[id].tsx`'s `page`, which is the screen this one is
	// the second half of.
	page: { flex: 1 },
	// Outside the scroll on purpose: the back control has to be in the same place on the frame
	// the screen opens and on every frame after it, and the keyboard changes the height of the
	// scroll below it every time it appears. No top padding — the safe-area inset is the top
	// air, paid by `Screen` on every screen (`padded={false}` still pays it), so a back strip
	// is the gutter. Every back strip in the app draws the same way.
	chrome: {
		paddingHorizontal: space.lg,
		paddingBottom: space.sm,
	},
	scroll: { flex: 1 },
	// The measure `Screen`'s `padded` would have applied, and `space.huge` under the last
	// control so the comment box does not end flush against the bar.
	content: {
		paddingHorizontal: space.lg,
		paddingBottom: space.huge,
		gap: space.lg,
	},
	// The error and the two refusal screens are not inside the scroll, so they pay the same
	// measure here rather than through the screen.
	padded: {
		flex: 1,
		paddingHorizontal: space.lg,
		paddingTop: space.md,
		gap: space.lg,
	},
	// A stack of lines about one thing — the heading and its sentence, the shop and its
	// number — at `TEXT_STACK_GAP`, the gap every stack of one statement pays.
	stack: { gap: TEXT_STACK_GAP },
	// A label over the control it names, which is two blocks and not one statement, so this
	// is the body gap and not `TEXT_STACK_GAP`.
	group: { gap: space.sm },
	// The skeleton's stand-ins for the four blocks above it, at the widths the real words come
	// to. Heights are not written here: they are composed with the reader's font scale through
	// `line()`, the way `app/(business)/product-form.tsx`'s skeleton does.
	skeletonTitle: { width: "55%" },
	skeletonBody: { width: "70%" },
	skeletonCaption: { width: "40%" },
	// Five marks in a row, at the height `./pressable` floors each of its positions to. The
	// width is the group's own: five `icon.action` glyphs at `space.xs` apart, which is what
	// `components/star-input.tsx` lays its row out in.
	skeletonStars: {
		width: MIN_TOUCH_TARGET * 5,
		height: MIN_TOUCH_TARGET,
	},
	skeletonInput: { minHeight: MIN_TOUCH_TARGET },
	// `./field` reserves its message row whether or not it has anything in it, so the skeleton
	// reserves one too — the row is the reason the form does not reflow under the customer.
	skeletonMessage: { width: "50%" },
});
