import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import {
	type Address,
	type Currency,
	type FulfilmentKind,
	formatMoney,
	isCheckoutRefusalKey,
	type PaymentMethod,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	AccessibilityInfo,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
import { Field } from "@/components/field";
import { MapView } from "@/components/map";
import { MoneyLine } from "@/components/money-line";
import { OrderPlaced } from "@/components/order-placed";
import { Pressable } from "@/components/pressable";
import { Price } from "@/components/price";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { StepProgress } from "@/components/step-progress";
import { BarTotal, SummaryCard } from "@/components/summary-card";
import { Text } from "@/components/text";
import { toApiFailure } from "@/lib/api-error";
import { getDefaultFulfilment, initDevicePrefs } from "@/lib/device-prefs";
import { selection, success } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { newClientRequestId } from "@/lib/ids";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	useTheme,
} from "@/theme";

/**
 * Checkout, in the three steps it is actually made of.
 *
 * The progress indicator is the spec's goal gradient, and the spec attaches a rule to it:
 * **every step shown is one that happens.** These three are not a decorative split of one
 * long form — each is a decision the customer has to make before the order can exist, and
 * each is the only thing on screen while they make it. `checkout.fulfilment` decides where it
 * goes, `checkout.payment` how it is paid for, and the last one is what they are buying at
 * the price they are buying it for.
 *
 * ## The total is on every step, and the button follows the step
 *
 * The figures used to arrive with the third step and nothing else: the customer chose
 * delivery, chose cash, and only then met the number they were agreeing to. `docs/design-mobile.md`
 * puts hiding the total — or the fee, or the delivery price — behind a tap, an animation or a
 * scroll in its out-list, and "behind a step" is that same defect wearing a progress bar.
 * So the total lives in the bar at the foot of the screen, `./action-bar` with `docked`, and
 * it is there on all three steps: the quote is fetched for the fulfilment kind as soon as
 * that kind exists, so the number is real from the first screen onward rather than filled in
 * later.
 *
 * The **delivery fee** is the figure that moves with the mode, so it is named where the mode
 * is chosen: `./money-line`'s row sits directly under the fulfilment `Segmented`, on the first
 * step, instead of appearing for the first time inside the receipt two steps later — which is
 * the "hiding the fee behind a step" the same out-list forbids, wearing a progress bar. It is
 * one row rather than two because `apps/api`'s `quote` answers the business's fee for
 * `DELIVERY` and zero for every other kind, and it is drawn for `DELIVERY` alone: the same
 * zero under `PICKUP` would read "Delivery ₡0", a price for a service nobody is buying. It
 * draws its own skeleton while the quote for the newly chosen kind is in flight — which is
 * the state every mode switch starts in, `trpc.cart.quote.queryOptions({ fulfilment })` being
 * keyed by the mode, so the new key has no data until the API answers.
 *
 * The bar's button is the step's own action — Continue, Continue, Place — so the one control
 * the customer reaches for is always in the same place while its *word* stays honest about
 * what it will do. Back is a compact chevron beside the total rather than a pill: a second
 * pill in the bar would be a second primary, and "Volver" is a full word of width taken from
 * the number the bar exists to show.
 *
 * ## The strip, and when a decision becomes a fact
 *
 * Under the progress bar, above the step's own body, is a row of facts: how the order comes,
 * where it is going, how it is paid for, and what the shop says about the time. Three of the
 * four questions a customer asks before committing — the fourth is the total, and that one is
 * in the bar on every step and never leaves.
 *
 * **A decision becomes a fact the moment its control leaves the screen**, and not before. On
 * the first step the mode *is* the step: `./segmented` is filled on one of its two cells, and
 * a chip above it repeating the same word would be a row that teaches nothing. From the second
 * step on, that control is gone and the customer's first question — "is this being delivered
 * at all?" — has no answer anywhere on the screen without the chip. The same rule gives the
 * address its chip from the second step (the picker was on the first) and the payment method
 * its chip on the review step, and it is why the row is short in the early steps rather than
 * complete and redundant in all three.
 *
 * ## The estimate, and what it is an estimate of
 *
 * The timing is the shop's own figure, read from the shop the order is for: the cart carries
 * `businessSlug` and `businesses.bySlug` answers with the card's `prepTimeMinutes`, so nothing
 * here is computed from a distance, a queue or a clock. `checkout.estimate`'s words say
 * *estimated* because a prep time is not a promise — the same distinction
 * `packages/i18n/src/messages/es/tracking.ts` draws at length ("the estimate is a readiness,
 * not an arrival") — and it is deliberately not turned into a clock time here: a time of day
 * invented on this screen would be a claim about the future built from a number a shop typed
 * once, where `tracking.estimate.ready.{sameDay,otherDay}` exist for the case the API *has*
 * anchored to a real accepted order (`estimatedReadyAt`, computed in `services/mappers.ts`).
 * Checkout is the screen before that moment.
 *
 * Under `DELIVERY` the same number is drawn with `store.prepTime` ("{count} min de
 * preparación") instead, because under delivery a prep time is not the time of anything the
 * customer experiences: the order is also carried across town. Checkout presents road
 * driving time separately when a route is quoted; an arrival clock appears only after
 * courier pickup, when that road duration has an actual start time.
 *
 * The read is allowed to fail, like every optional read in this app: no slug, a failed
 * `bySlug` or a prep time of zero and the chip is simply absent, with no branch anywhere that
 * throws and none that invents a default. It is also absent rather than skeletoned — a fact
 * row is a status line, and a placeholder chip is a promise of a fact that may never arrive.
 *
 * ## A choice says it is a choice
 *
 * The fulfilment kind is a closed set of two and it is now `./segmented`, which is the
 * component built for exactly this ("the fulfilment kind on checkout (delivery / pickup)" —
 * its own docblock). It is a radio group, its chosen cell is filled *and* heavier *and*
 * announced as selected, and it fires the `selection` haptic itself under the same-value
 * guard, so the call site here no longer repeats either.
 *
 * Payment uses the same compact radio group, so its selected method does not compete with
 * the lime Continue button. Addresses keep `AddressPicker`'s radio group in either shape.
 *
 * ## Placing the order is not optimistic
 *
 * This is the one commit in the app that must never appear before the server agreed to it.
 * `orders.place` reads the cart, re-prices it, checks the shop is open and the minimum is
 * met, and can refuse all of it. A confirmation that arrived first and was taken back a
 * second later is the worst thing a marketplace screen can do, so the button waits, the
 * network is visible, and the peak (`components/order-placed.tsx`) is drawn only once the
 * API has answered with an order.
 *
 * The idempotency id is generated once per attempt and reused across retries: a phone loses
 * its connection mid-request, the customer taps again, and that tap is the same order. See
 * `lib/ids.ts`.
 *
 * ## The receipt is the response
 *
 * `orders.place` returns the whole `OrderDetail`, so the screen this is about to navigate to
 * is seeded with it — and the peak itself is drawn from the same answer, down to the total it
 * prints. The customer goes from the tick straight to a receipt that is already there,
 * instead of arriving at a skeleton: the peak is a strange place to start waiting again.
 */
const STEPS: readonly MessageKey[] = [
	"checkout.fulfilment",
	"checkout.payment",
	"order.items",
];

/** What the peak needs: the order it is confirming, and what it cost. */
type PlacedOrder = {
	id: string;
	reference: string;
	totalMinor: number;
	currency: Currency;
};

export default function Checkout() {
	const { t } = useT();
	const [placed, setPlaced] = useState<PlacedOrder | null>(null);

	const showReceipt = useCallback(() => {
		if (placed) {
			router.replace({ pathname: "/order/[id]", params: { id: placed.id } });
		}
	}, [placed]);

	return (
		<Screen
			purchaseStage={placed ? "confirmed" : undefined}
			// The peak carries its own words; a screen title over it would be the app talking
			// over the moment it is trying to leave alone.
			title={placed ? undefined : t("checkout.title")}
			// The form pays its own bottom inset through the bar, so the screen must not pay it
			// as well or the button floats above the home indicator. The peak has no bar and pays
			// it through the frame, the way every other static screen does.
			bottomInset={Boolean(placed)}
			contentStyle={placed ? styles.fill : styles.frame}
		>
			<SignedIn>
				{placed ? (
					<OrderPlaced
						reference={placed.reference}
						totalMinor={placed.totalMinor}
						currency={placed.currency}
						onDone={showReceipt}
					/>
				) : (
					<CheckoutForm onPlaced={setPlaced} />
				)}
			</SignedIn>
		</Screen>
	);
}

function CheckoutForm({
	onPlaced,
}: {
	onPlaced: (order: PlacedOrder) => void;
}) {
	const { t, intlLocale } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const requestId = useRef<string | null>(null);
	const [step, setStep] = useState(0);
	const [fulfilment, setFulfilment] = useState<FulfilmentKind>("PICKUP");
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
	const [addressId, setAddressId] = useState<string>();
	const [locationId, setLocationId] = useState<string>();
	const [notes, setNotes] = useState("");
	const [notesOpen, setNotesOpen] = useState(false);

	// The customer's own default, read once. Until storage answers the screen
	// holds PICKUP — the same value a fresh install behaves as — so the first
	// frame is never wrong, only possibly stale for milliseconds. The init is
	// awaited rather than trusted: the layout fires it without waiting, so a
	// checkout opened cold could otherwise read the default before storage
	// lands and pin the wrong kind under the reader.
	useEffect(() => {
		void initDevicePrefs().then(() => {
			setFulfilment(getDefaultFulfilment());
		});
	}, []);

	const cart = useQuery(trpc.cart.get.queryOptions());
	const locations = useQuery(trpc.cart.pickupLocations.queryOptions());
	const addresses = useQuery(trpc.users.addresses.queryOptions());
	const selectedLocation =
		locations.data?.find((location) => location.id === locationId) ??
		locations.data?.find((location) => location.isDefault) ??
		locations.data?.[0];
	const selectedAddress =
		addressId ??
		addresses.data?.find((address) => address.isDefault)?.id ??
		addresses.data?.[0]?.id;
	const quote = useQuery(
		trpc.cart.quote.queryOptions(
			{
				fulfilment,
				locationId: selectedLocation?.id,
				addressId: fulfilment === "DELIVERY" ? selectedAddress : undefined,
			},
			{
				enabled:
					Boolean(selectedLocation) &&
					(fulfilment !== "DELIVERY" || Boolean(selectedAddress)),
				refetchInterval: 15000,
			},
		),
	);
	const quoting = useSkeletonHold(quote.isPending);
	// The same hold for this screen's other two reads. Both drew their skeletons off the raw
	// `isPending` flag, so an address list or a cart that answered in 80ms painted grey for
	// 80ms — the flicker `skeleton.tsx` documents the 240ms floor to prevent.
	const waitingAddresses = useSkeletonHold(addresses.isPending);
	const waitingCart = useSkeletonHold(cart.isPending);

	/**
	 * The shop the order is for, for its own prep time.
	 *
	 * `businessSlug` is nullable on `cartSchema` — the cart outlives the shop's visibility, a
	 * basket can be standing here while the shop is suspended — so the read is `enabled` on the
	 * slug rather than on the screen, and the strip simply has one fact fewer when there is no
	 * shop to ask. It is a 404-and-a-sentence-free absence on purpose: see the docblock, the
	 * strip is a status line, not a step, and nothing about placing the order depends on it.
	 *
	 * The input holds `""` when there is no slug, which `businesses.bySlug`'s `min(2)` would
	 * reject — and which is never sent, because `enabled: false` is what happens first. The
	 * empty string is there because the query options object is built before that flag is read
	 * and `slug` is a required string; if the flag is ever dropped, the failure is a refused
	 * call rather than a request for the empty slug.
	 */
	const business = useQuery(
		trpc.businesses.bySlug.queryOptions(
			{ slug: cart.data?.businessSlug ?? "" },
			{ enabled: Boolean(cart.data?.businessSlug) },
		),
	);

	// The two kinds, as *this* shop does them. `cart.quote` refuses the other one outright —
	// "Esta forma de entrega no está disponible", `apps/api/src/services/cart.ts` — and the
	// fulfilment step was offering both regardless, so a pickup-only shop answered the Delivery
	// choice with an error. That reached the customer twice: a fee row (`MoneyLine`) with no
	// amount, which is a skeleton that never lands because nothing is coming, and one step later
	// this screen's `quote.isError` branch, a generic "We couldn't load this" over an order that
	// was never loadable. The shop owns the answer, so the control asks the shop.
	//
	// `true` while its read is in flight, which is the honest default for a pair of flags nobody
	// has answered yet: the choice stays whole for those milliseconds instead of narrowing to one
	// kind and then widening again. The flags correct it the moment they land.
	const collects = business.data?.card.pickupEnabled ?? true;
	const delivers = business.data?.card.deliveryEnabled ?? true;

	// Two reads decide the kind — the customer's stored default and the shop's flags — and they
	// arrive in either order, neither before the other by rule. So the default can leave this on
	// a kind the shop does not do (the device remembers DELIVERY from a shop that delivers), and
	// the correction belongs in one effect rather than at either read.
	//
	// Equal flags mean there is nothing to correct: a shop that does both takes either one, so
	// the customer's own default stands, and a shop that does neither is not a shop the API will
	// quote for — picking for them there would only be a loop between the two branches below.
	useEffect(() => {
		if (collects === delivers) return;
		const only: FulfilmentKind = delivers ? "DELIVERY" : "PICKUP";
		setFulfilment((current) => (current === only ? current : only));
	}, [collects, delivers]);

	const place = useMutation(
		trpc.orders.place.mutationOptions({
			onSuccess: (order) => {
				requestId.current = null;
				// The commit's haptic, fired at the commit. The peak's tick is the visual half of
				// the same answer, not a second announcement of it.
				success();
				cache.setQueryData(trpc.orders.byId.queryKey({ id: order.id }), order);
				void cache.invalidateQueries({ queryKey: trpc.orders.pathKey() });
				void cache.invalidateQueries({ queryKey: trpc.cart.pathKey() });
				onPlaced({
					id: order.id,
					reference: order.reference,
					// The bar was showing this figure a moment ago; the peak prints the same one, so
					// the last number the customer saw before committing is the first one they see
					// after. Taken from the order rather than from the quote, because the order is what
					// the API actually charged.
					totalMinor: order.totals.totalMinor,
					currency: order.totals.currency,
				});
			},
			/**
			 * The other half of the retry contract, and the half that was missing.
			 *
			 * `orders.place` takes a claim on the request id *before* its write batch
			 * (`packages/trpc-api/src/services/orders.ts:387`). The batch is atomic, so a
			 * failure inside it writes nothing - but the claim, which is taken outside it,
			 * survives with no order behind it. The server waits for that order id, does not
			 * find it, and answers `ConflictError`: "tu pedido anterior no terminó de
			 * registrarse".
			 *
			 * That is only reachable on a retry, and only because `submit()` reuses
			 * `requestId.current` via `??=`. So the second tap after a failure re-sent the id
			 * that was already spent and got a misleading error about a previous order
			 * instead of a clean retry. Clearing it here makes the next tap a genuinely new
			 * attempt, which is what the server's own comment at `orders.ts:602-606` says
			 * the client supplies.
			 *
			 * Clearing on *every* error is safe, not just this one. A `ValidationError` is
			 * thrown before the claim is taken, so there was never a claim to strand; and a
			 * race genuinely lost is answered with the order itself rather than an error, so
			 * this cannot discard a real order.
			 */
			onError: (error) => {
				requestId.current = null;
				if (
					toApiFailure(error).serverMessage === "checkout.refusal.totalChanged"
				)
					void quote.refetch();
			},
		}),
	);

	const needsAddress = fulfilment === "DELIVERY" && !selectedAddress;
	const needsLocation = !selectedLocation;
	const short = (quote.data?.missingForMinOrderMinor ?? 0) > 0;
	// `!quote.data` alone, with no term for TanStack's fetching flag. The quote polls every 15s
	// and that flag disabled the Place button for the length of every round trip, with no
	// sentence on screen saying why — `blockedReason()` below returns null exactly then. Waiting
	// bought nothing: `submit()` sends `expectedTotalMinor`, so a quote that moved is refused
	// rather than charged, and the tap that arrives mid-poll is answered by the API either way.
	const quoteless = !quote.data || quote.isError;
	const hasItems = Boolean(cart.data?.items.length);
	const businessSlug = cart.data?.businessSlug;
	const last = step === STEPS.length - 1;

	/**
	 * What is settled so far, as chips — see the docblock for the rule that decides which ones
	 * are here on which step ("a decision becomes a fact the moment its control leaves the
	 * screen"). Pushed into an array rather than written as conditional children, because
	 * `Facts` counts its children to decide whether to draw at all and `Children.count` counts a
	 * `null` child as one: a row of three conditionals that all came out false would render an
	 * empty row, and inside a `gap` column that is a gap paid for nothing.
	 */
	const settled: ReactNode[] = [];
	const chosenAddress = addresses.data?.find(
		(address) => address.id === selectedAddress,
	);
	const quoteFailure = toApiFailure(quote.error);
	const quoteErrorBody = isCheckoutRefusalKey(quoteFailure.serverMessage)
		? t(quoteFailure.serverMessage)
		: undefined;
	const roadUnavailable =
		quoteFailure.serverMessage === "checkout.refusal.deliveryQuoteUnavailable";
	const roadRoute =
		fulfilment === "DELIVERY" &&
		!quote.isError &&
		quote.data?.roadQuote &&
		selectedLocation?.lat != null &&
		selectedLocation.lng != null &&
		chosenAddress?.lat != null &&
		chosenAddress.lng != null
			? {
					pickup: { lat: selectedLocation.lat, lng: selectedLocation.lng },
					destination: { lat: chosenAddress.lat, lng: chosenAddress.lng },
					geometry: quote.data.roadQuote.geometry,
				}
			: null;
	const prepTime = business.data?.card.prepTimeMinutes ?? 0;

	if (step > 0) {
		settled.push(
			<Fact
				key="mode"
				value={
					fulfilment === "DELIVERY"
						? t("store.delivery")
						: t("store.pickup.short")
				}
				iconName={
					fulfilment === "DELIVERY" ? "bicycle-outline" : "bag-handle-outline"
				}
			/>,
		);
	}

	if (fulfilment === "DELIVERY" && step > 0 && chosenAddress) {
		settled.push(
			<Fact
				key="address"
				value={chosenAddress.label}
				iconName="location-outline"
				// The label alone is the customer's own name for the place, and often the same word
				// twice for two buildings — the picker spells its options out for that reason and so
				// does this chip, in the ear rather than on the screen.
				accessibilityLabel={`${chosenAddress.label}: ${chosenAddress.line1}`}
			/>,
		);
	}

	if (step > 1) {
		settled.push(
			<Fact
				key="payment"
				value={
					paymentMethod === "CASH"
						? t("checkout.payment.cash")
						: t("checkout.payment.sinpe")
				}
				iconName={
					paymentMethod === "CASH" ? "cash-outline" : "phone-portrait-outline"
				}
			/>,
		);
	}

	// Last in the row, and the only chip here that is a *shop's* number rather than the
	// customer's own choice. Under pickup it is when the order is ready; under delivery the same
	// figure is only how long the food takes, so it is worded as the prep it is. See the
	// docblock — `estimatedDeliveryAt` is null in the API and this screen will not fill the gap.
	if (prepTime > 0) {
		settled.push(
			<Fact
				key="estimate"
				value={
					fulfilment === "DELIVERY"
						? t("store.prepTime", { count: prepTime })
						: t("checkout.estimate", { minutes: prepTime })
				}
				iconName="time-outline"
			/>,
		);
	}

	function pickPayment(next: string) {
		if (next === "CASH" || next === "SINPE_MOVIL") setPaymentMethod(next);
	}

	function pickAddress(next: string) {
		if (next === selectedAddress) return;
		selection();
		setAddressId(next);
	}

	function pickLocation(next: string) {
		if (next === selectedLocation?.id) return;
		selection();
		setLocationId(next);
	}

	function pickFulfilment(next: string) {
		// Narrowed rather than cast: the segmented control hands back its option's `value` as a
		// string, and the set it offers is this function's to know.
		if (next === "PICKUP" || next === "DELIVERY") setFulfilment(next);
	}

	function submit() {
		if (place.isPending || quote.isError || !quote.data) return;
		requestId.current ??= newClientRequestId();
		place.mutate({
			fulfilment,
			quoteId: quote.data.roadQuote?.quoteId,
			locationId: selectedLocation?.id,
			paymentMethod,
			addressId: fulfilment === "DELIVERY" ? selectedAddress : undefined,
			customerNotes: notes.trim() || undefined,
			clientRequestId: requestId.current,
			tipMinor: 0,
			// A quote that moved between this screen and the request is refused rather than
			// charged, so the customer is never billed a number they did not see.
			expectedTotalMinor: quote.data.totalMinor,
		});
	}

	/**
	 * The only thing that moves the flow between steps, and it says what it did.
	 *
	 * The step change used to be announced to nobody. The bar that shows it is
	 * `./step-progress`'s `progressbar` (`step-progress.tsx:51-57`), and a progressbar whose
	 * value goes from 1 to 2 re-announces nothing — the reader either hears the same
	 * three-segment widget it heard on the first step or hears nothing, while the body under it
	 * has been replaced.
	 *
	 * A live region is not the instrument here, and this is the one screen where that is a
	 * decision rather than a gate: the block that would have to carry one is the one holding the
	 * bar and the facts strip (`styles.state`), and a region there reads the whole strip back on
	 * every step. So the call is explicit and, following
	 * `components/order-placed.tsx:145-150`, deliberately **not** gated to iOS — the gate at
	 * `docs/design-mobile.md:144-150` exists to stop a sentence being read twice where a live
	 * region already speaks it, and the words announced here are the step's own name, which no
	 * region on this screen says. (`./error-state` draws one on a failed place, and that one
	 * speaks the failure's sentence, not this step's.)
	 *
	 * Fired from the handler rather than from an effect on `step`, because an effect keyed on the
	 * state also runs on the screen's **first** render and would announce the step the customer
	 * has not left yet.
	 *
	 * `next` is checked against the array rather than trusted. Both controls are already bounded
	 * — the way back is drawn only above the first step and the primary only below the last — so
	 * the guard is that bound written once instead of remembered at two call sites, and it is
	 * what keeps the announcement from ever being `undefined`.
	 */
	function goToStep(next: number) {
		const name = STEPS[next];
		if (!name) return;
		setStep(next);
		// The progress heading names the arriving step, so the announcement names the
		// customer's next decision rather than only counting it.
		AccessibilityInfo.announceForAccessibility(t(name));
	}

	/**
	 * Why the bar's button is off, in words, wherever the reason is not already on screen.
	 *
	 * The minimum-order sentence is the cart's own key, so the same fact reads identically in
	 * both places. The missing address is stated in the bar's strip only from the second step
	 * on: on the first step it is written beside the address list, where the button that fixes
	 * it is, and repeating it a screen-width lower would be the same sentence twice.
	 */
	function blockedReason(): string | null {
		if (short && quote.data && hasItems) {
			return t("cart.minOrderMissing", {
				amount: formatMoney(
					quote.data.missingForMinOrderMinor,
					quote.data.currency,
					{
						locale: intlLocale,
					},
				),
			});
		}
		if (needsAddress && step > 0) return t("checkout.address.none");
		return null;
	}

	const blocked = blockedReason();

	/**
	 * The reason the API gave, as a sentence, when it named one this screen can read.
	 *
	 * `orders.place` refuses with a **message key** in the `DomainError`'s text rather than a
	 * Spanish sentence (`CHECKOUT_REFUSAL_KEYS` in `@pymeshub/shared`). Without this the refusal
	 * reached the customer as `state.error.rejected` - honest, since nothing was broken, but it
	 * cannot say *which* thing to check, and the answer to "the business is closed right now"
	 * is not "check the details".
	 *
	 * **Keyed on `serverMessage`, never on the code.** `code` and `domainCode` are both the
	 * generic `BAD_REQUEST` for every refusal on that list *and* for a malformed request, so the
	 * code cannot tell a closed shop from a broken payload and the sentence can. This is the
	 * same argument `components/reorder-outcome.tsx` makes for its own case.
	 *
	 * `isCheckoutRefusalKey` is what keeps a raw key off the screen: an unrecognised value - an
	 * older API still sending prose, a newer one naming a reason this build has no words for -
	 * falls through to `null`, and the caller keeps `state.error.rejected`. Returning `null`
	 * rather than the key itself is the whole point of the guard.
	 */
	const placeReason = ((): string | null => {
		if (!place.error) return null;
		// Read once: `toApiFailure` re-derives the shape from the throw on every call, and the
		// two reads here want the *same* failure — `serverMessage` names the reason and
		// `details` carries what the sentence needs to fill in.
		const { serverMessage, details } = toApiFailure(place.error);
		if (!isCheckoutRefusalKey(serverMessage)) return null;
		// The minimum is the one refusal whose sentence has a blank in it, and the blank is
		// filled from `details.minimumMinor` rather than from the key: the API sends the shop's
		// minimum, and `blockedReason()` above formats the same fact from the quote before the
		// tap is even possible. This is the sentence under the button that failed, for the case
		// where the quote moved between the two.
		if (serverMessage === "checkout.refusal.minOrder") {
			const minimumMinor =
				(details as { minimumMinor?: number } | null)?.minimumMinor ??
				quote.data?.missingForMinOrderMinor;
			if (minimumMinor != null) {
				return t("cart.minOrderMissing", {
					amount: formatMoney(
						minimumMinor,
						quote.data?.currency ?? ("CRC" as Currency),
						{ locale: intlLocale },
					),
				});
			}
		}
		return t(serverMessage);
	})();

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				// The pair `./screen` puts on the scroller it owns, carried here because this
				// screen keeps `scroll` off and brings its own — so the props never left the
				// primitive and the notes field below the fold had no inset at all. The platform
				// check belongs to the file that owns the scroller, which is this one; see
				// `docs/design-mobile.md`, "A platform difference is a contract in two places".
				keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
				// `true` and not a prop: `keyboardInsets` is `Screen`'s opt-in and stops at the
				// scroller `Screen` owns, so with `scroll` off there is no value here to read —
				// passing the prop to `Screen` would be a prop nothing reads. `true` is what
				// `screen.tsx:177-179` sends for a screen that opted in, and this screen has a
				// field in its own scroller, which is the whole condition. `undefined` rather
				// than `false` off iOS, as there: React drops an undefined prop, so Android is
				// never handed a key it does not implement.
				automaticallyAdjustKeyboardInsets={
					Platform.OS === "ios" ? true : undefined
				}
				scrollIndicatorInsets={{ bottom: 0 }}
			>
				{/* The bar is the one thing on this screen that does not move between steps — it is
				    the same three segments with one more of them filled — so it enters once and is
				    then never re-keyed. Everything below it is keyed by the step it belongs to.

				    The facts strip is inside this block for the same reason: a step that settles
				    swaps a chip into it, and a row that re-entered on every swap would be three
				    entrances for one word appearing. It is not a skeleton while the shop's read is
				    in flight either — a placeholder chip is a promise of a fact that may never
				    arrive, and the strip has no height at all until one exists. */}
				<AnimateIn index={0}>
					<View style={styles.state}>
						<StepProgress
							step={step + 1}
							total={STEPS.length}
							label={t(STEPS[step] as MessageKey)}
						/>
						<Facts>{settled}</Facts>
					</View>
				</AnimateIn>

				{/* A step is not a screen: the stack's transition is what a screen change looks like
				    and this is one page exchanging its body. So the body of each step carries its
				    own key, which plays the entrance the moment that step arrives — the same idiom
				    the order timeline uses for a step that becomes `done` (see
				    `./order-timeline`). The three keys are the step's *name* rather than its number,
				    because the number is the flow's and the name is the step's. */}
				{step === 0 ? (
					<AnimateIn key="fulfilment" index={1}>
						<View style={styles.group}>
							{/* Only the kinds this shop does — see the note at `collects`/`delivers`.
							    A one-option group is a statement rather than a choice, and that is
							    what it should be: it names the only way this order leaves this
							    shop, in the control that names the kind, and the segment is already
							    drawn selected and bold with `accessibilityState.selected` set, so
							    a reader who needs it told gets it told. Nothing says why the other
							    one is absent, and nothing can: the dictionaries are a closed union
							    (`docs/design-mobile.md`), so "this shop doesn't deliver" is not a
							    sentence this lane may add — and a greyed segment whose reason is a
							    missing sentence is worse than a pair that simply does not exist. */}
							<Segmented
								label={t("checkout.fulfilment")}
								value={fulfilment}
								onChange={pickFulfilment}
								options={[
									...(collects
										? [{ value: "PICKUP", label: t("checkout.pickup") }]
										: []),
									...(delivers
										? [{ value: "DELIVERY", label: t("checkout.delivery") }]
										: []),
								]}
							/>
							{locations.isError ? (
								<ErrorState
									error={locations.error}
									onRetry={() => void locations.refetch()}
								/>
							) : locations.isPending ? (
								<Skeleton
									style={styles.blockSkeleton}
									label={t("state.loading")}
								/>
							) : locations.data?.length ? (
								<View style={styles.group}>
									<Text variant="body" bold>
										{t("checkout.location")}
									</Text>
									<PickupLocationPicker
										locations={locations.data}
										value={selectedLocation?.id}
										onPick={pickLocation}
									/>
									{selectedLocation?.lat != null &&
									selectedLocation.lng != null ? (
										<MapView
											coords={{
												lat: selectedLocation.lat,
												lng: selectedLocation.lng,
											}}
											marker={
												roadRoute
													? null
													: {
															lat: selectedLocation.lat,
															lng: selectedLocation.lng,
														}
											}
											route={roadRoute}
											showUserLocation={false}
											accessibilityLabel={t("checkout.location")}
											style={styles.locationMap}
										/>
									) : null}
								</View>
							) : (
								<Text variant="body" tone="muted">
									{t("checkout.location.none")}
								</Text>
							)}
							{quote.isError && quoteless && hasItems ? (
								<View style={styles.group}>
									<ErrorState
										error={quote.error}
										body={quoteErrorBody}
										onRetry={() => void quote.refetch()}
									/>
									{roadUnavailable && collects ? (
										<Button
											variant="secondary"
											label={t("checkout.pickup")}
											onPress={() => setFulfilment("PICKUP")}
										/>
									) : null}
								</View>
							) : null}

							{/* The fee, directly under the control that decides it — see the docblock.
							    `DELIVERY` only, because it is the mode with a fee to name; and no
							    loading branch, because an amount the quote has not answered yet draws
							    `MoneyLine`'s own skeleton, so the switch shows the shape of the row
							    rather than the previous kind's number or none at all. */}
							{fulfilment === "DELIVERY" && !needsAddress && !quote.isError ? (
								<View style={styles.group}>
									<MoneyLine
										label={t("cart.delivery")}
										amountMinor={quote.data?.deliveryFeeMinor}
										currency={quote.data?.currency}
									/>
									{quote.data?.roadQuote ? (
										<Text variant="caption" tone="muted">
											{t("checkout.roadRoute", {
												distance: new Intl.NumberFormat(intlLocale, {
													maximumFractionDigits: 1,
												}).format(quote.data.roadQuote.distanceMeters / 1000),
												minutes: Math.ceil(
													quote.data.roadQuote.durationSeconds / 60,
												),
											})}
										</Text>
									) : null}
								</View>
							) : null}

							{fulfilment === "DELIVERY" ? (
								// Delivery is the choice that grows this step, and the set of addresses is
								// what it grows by: the block enters on its own rather than with the
								// step, because it is answering the tap that has just happened and not
								// the step that was already on screen. Its index is 0 for that reason —
								// no stagger, because there is no group here to arrive as.
								<AnimateIn index={0}>
									<View style={styles.group}>
										<Text variant="body" bold>
											{t("checkout.address")}
										</Text>
										{addresses.isError ? (
											<ErrorState
												error={addresses.error}
												onRetry={() => void addresses.refetch()}
											/>
										) : waitingAddresses || !addresses.data ? (
											// The second term is the narrowing: `waitingAddresses` is a plain
											// boolean, so the query's own pending flag is what proves `data`
											// is here — and an absent list draws the skeleton either way.
											<Skeleton
												style={styles.blockSkeleton}
												label={t("state.loading")}
											/>
										) : addresses.data.length ? (
											<AddressPicker
												addresses={addresses.data}
												value={selectedAddress}
												onPick={pickAddress}
											/>
										) : (
											// The sentence and the button, together: "you need an address" is
											// only useful next to the thing that gets you one.
											<Text variant="body" tone="muted">
												{t("checkout.address.none")}
											</Text>
										)}
										<Button
											variant="ghost"
											label={t("checkout.address.add")}
											onPress={() => router.push("/addresses")}
										/>
									</View>
								</AnimateIn>
							) : null}
						</View>
					</AnimateIn>
				) : null}

				{step === 1 ? (
					<AnimateIn key="payment" index={1}>
						<View style={styles.group}>
							<Segmented
								label={t("checkout.payment")}
								value={paymentMethod}
								onChange={pickPayment}
								options={[
									{ value: "CASH", label: t("checkout.payment.cash") },
									{ value: "SINPE_MOVIL", label: t("checkout.payment.sinpe") },
								]}
							/>
							<Text variant="label" tone="muted">
								{t("checkout.payment.note")}
							</Text>
							{quote.isError && quoteless && hasItems ? (
								<ErrorState
									error={quote.error}
									onRetry={() => void quote.refetch()}
								/>
							) : null}
						</View>
					</AnimateIn>
				) : null}

				{step === 2 ? (
					<AnimateIn key="review" index={1}>
						<View style={styles.group}>
							{cart.isError ? (
								<ErrorState
									error={cart.error}
									onRetry={() => void cart.refetch()}
								/>
							) : waitingCart || !cart.data ? (
								// Same two terms as the address list above, and for the same reason.
								<Skeleton
									style={styles.blockSkeleton}
									label={t("state.loading")}
								/>
							) : cart.data.items.length ? (
								cart.data.items.map((item, index) => (
									// `reorder` because the cart is an account's rather than a phone's: a
									// line can leave it from another device while this step is open, and
									// the lines below the one that left close the gap instead of jumping.
									<AnimateIn key={item.id} index={index} reorder>
										<View style={styles.itemRow}>
											{/* `tabular`, so the quantity's digits keep one width and the name
											    beside them does not move when the number changes — the same row
											    `app/order/[id].tsx` sets it on. And `flex: 1` like that row's
											    name: a long product name wraps rather than pushing the price
											    off the screen at 200% text. */}
											<Text variant="body" tabular style={styles.itemName}>
												{item.quantity} × {item.name}
											</Text>
											<Price
												amountMinor={item.lineTotalMinor}
												currency={cart.data.currency}
												variant="body"
											/>
										</View>
									</AnimateIn>
								))
							) : (
								// The branch this step was missing — the progress heading used to render
								// with nothing under it and no sentence, which is the one gap in the app's
								// load/empty/error triad. It is reachable rather than defensive: `cart.quote`
								// answers an empty cart with zeroed totals instead of refusing, so `short`
								// is false and the step is not blocked, and a cart belongs to the *account*,
								// not the phone — another device can empty it under somebody who is already
								// standing on this screen. The words are the cart screen's own two keys, so
								// the same situation reads identically in both places, and the action is the
								// cart's, because finding something to buy is the only way forward from here.
								// Nothing else has to say the order cannot be placed: the bar's button is
								// disabled by this same emptiness.
								<EmptyState
									icon="bag-outline"
									title={t("cart.empty.title")}
									body={t("cart.empty.body")}
									actionLabel={t("cart.empty.action")}
									actionVariant="primary"
									onAction={() => router.replace("/")}
								/>
							)}

							{/* Every figure the order will have, in full, on the screen where the customer
							    agrees to it — and drawn by `./summary-card`, the same receipt the cart draws,
							    so the two screens cannot disagree about what this basket costs. Only the
							    delivery row differs between them, and only because the fee depends on the
							    mode: the cart has not been told one yet and the checkout has.

							    The receipt and the note field are one block because they move as one — the
							    quote polls, a discount row can appear inside the totals while the customer
							    is reading it, and the notes field below must not jump when it does.
							    `reorder` is what closes that gap on the layout spring. The index is the line
							    count for the same reason the cart's is: the total enters with the last line
							    and never behind it. */}
							{/* `?.` because the ternary above is what narrows `cart.data` and this is its
							    sibling rather than its branch; `?? 0` then means "no lines to count". */}
							<AnimateIn index={cart.data?.items.length ?? 0} reorder>
								<View style={styles.group}>
									{quote.isError ? (
										<ErrorState
											error={quote.error}
											onRetry={() => void quote.refetch()}
										/>
									) : (
										<SummaryCard
											// The minimum-hold skeleton is applied here rather than inside the card:
											// the same hold the rest of the app uses, so a quote that lands in 80ms
											// does not flash a receipt's worth of placeholders on its way in.
											totals={quoting ? undefined : quote.data}
											showDelivery={fulfilment === "DELIVERY"}
										/>
									)}

									{notesOpen ? (
										<Field
											label={t("checkout.notes")}
											value={notes}
											onChangeText={setNotes}
											multiline
											maxLength={500}
										/>
									) : (
										<Button
											label={t("checkout.notes.add")}
											variant="ghost"
											size="sm"
											onPress={() => setNotesOpen(true)}
										/>
									)}
								</View>
							</AnimateIn>
						</View>
					</AnimateIn>
				) : null}

				{step < 2 && cart.isError && !cart.data ? (
					<ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
				) : null}
				{step < 2 && cart.data && !hasItems ? (
					<EmptyState
						icon="bag-outline"
						title={t("cart.empty.title")}
						body={t("cart.empty.body")}
						actionLabel={t("cart.empty.action")}
						actionVariant="primary"
						onAction={() => router.replace("/")}
					/>
				) : null}
			</ScrollView>

			{/* A failed place belongs where the button that failed is: the customer taps "Hacer el
			    pedido", it does not happen, and the sentence explaining it appears directly above
			    that button rather than at the bottom of a receipt they have already scrolled past.

			    `placeReason` is the API's own reason when it named one (`placeReason`'s docblock),
			    and `ErrorState` answers the rest: an unrecognised failure keeps
			    `state.error.rejected`, which says a thing was refused without claiming fault. The
			    title stays `checkout.failed` in both branches because "We couldn't place your
			    order" is true either way, and the body is the part that differs. */}
			{place.error ? (
				<View style={styles.above}>
					<ErrorState
						error={place.error}
						title={t("checkout.failed")}
						{...(placeReason ? { body: placeReason } : {})}
					/>
				</View>
			) : null}

			{blocked ? (
				<View style={styles.why}>
					<Text variant="label" tone="muted">
						{blocked}
					</Text>
					{short && hasItems && businessSlug ? (
						<Button
							label={t("cart.moreFromShop")}
							variant="ghost"
							size="sm"
							onPress={() =>
								router.push({
									pathname: "/store/[slug]",
									params: { slug: businessSlug },
								})
							}
						/>
					) : null}
				</View>
			) : null}

			{/* Docked: this bar is the floor of the screen rather than a card floating over it,
			    because it is on every step and holds the total the whole flow exists to show. It
			    owns the bottom inset — the screen does not pay one on this branch. */}
			<ActionBar
				docked
				summary={
					<View style={styles.summary}>
						{step > 0 ? (
							// An icon target rather than a second pill: the bar has one primary, and a
							// word the width of "Volver" would come out of the total. Its label is the
							// word, so it is announced as what it is.
							<Pressable
								onPress={() => goToStep(step - 1)}
								accessibilityRole="button"
								accessibilityLabel={t("action.back")}
								style={styles.back}
							>
								<Ionicons
									name="chevron-back"
									size={icon.control}
									color={colors.foreground}
									accessibilityElementsHidden
									importantForAccessibility="no"
								/>
							</Pressable>
						) : null}
						<BarTotal
							label={t("cart.total")}
							amountMinor={quoting ? undefined : quote.data?.totalMinor}
							currency={quoting ? undefined : quote.data?.currency}
						/>
					</View>
				}
				primary={
					last
						? {
								label: place.isPending
									? t("checkout.placing")
									: t("checkout.place"),
								onPress: submit,
								loading: place.isPending,
								disabled:
									!hasItems ||
									quoteless ||
									short ||
									needsAddress ||
									needsLocation,
								// The same sentence the strip carries, for a reader who reached the
								// button without passing it.
								accessibilityHint: blocked ?? undefined,
							}
						: {
								label: t("action.continue"),
								onPress: () => goToStep(step + 1),
								disabled:
									!hasItems ||
									quoteless ||
									short ||
									needsAddress ||
									needsLocation,
								accessibilityHint:
									blocked ??
									(quoteless
										? t(quote.isError ? "state.error.title" : "state.loading")
										: undefined),
							}
				}
			/>
		</>
	);
}

/**
 * The saved addresses, as a set — in one of two shapes.
 *
 * A radio group either way, and the shape is a decision about how much has to be read
 * before an address can be told from another one.
 *
 * **Two or fewer: a card each.** An address is not a word in a list; it is a place, and
 * telling two of them apart takes the street line and the city, not the label — "Casa" and
 * "Casa" is a state a customer can genuinely be in after adding a second address for the
 * same building. A card gives each one a line per fact at a readable size, and the chosen
 * one carries the primary border, a heavier label and a tick: three signals, none of which
 * is a tint on its own.
 *
 * **Three or more: a radio list.** Past two, the cards stop being read — nobody compares
 * four addresses field by field on a phone — and what the customer is doing is picking one
 * from a set. `./button`'s `selected` draws that: one line per address, its own state
 * announced, a tick on the chosen one.
 *
 * Both wrap their options in `radiogroup` and every option is a `radio` with `checked`, which
 * is the state this screen had before it was rebuilt and the one thing about it that must not
 * regress: a set of identical buttons that differ only by fill is a set a screen reader
 * cannot read at all. The card shape is a `Pressable` and not `./card`'s own `onPress` for
 * that reason — a card's press is a `button`, which would take the radio state away.
 */
function PickupLocationPicker({
	locations,
	value,
	onPick,
}: {
	locations: Array<{
		id: string;
		name: string;
		line1: string | null;
		city: string | null;
	}>;
	value?: string;
	onPick: (id: string) => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	return (
		<View
			style={styles.choice}
			accessibilityRole="radiogroup"
			accessibilityLabel={t("checkout.location")}
		>
			{locations.map((location) => {
				const chosen = value === location.id;
				const address = [location.line1, location.city]
					.filter(Boolean)
					.join(", ");
				return (
					<Pressable
						key={location.id}
						onPress={() => onPick(location.id)}
						accessibilityRole="radio"
						accessibilityState={{ checked: chosen }}
						accessibilityLabel={[location.name, address]
							.filter(Boolean)
							.join(", ")}
						style={styles.option}
					>
						<Card style={chosen ? { borderColor: colors.primary } : undefined}>
							<View style={styles.optionRow}>
								<View style={styles.optionText}>
									<Text variant="body" bold={chosen}>
										{location.name}
									</Text>
									{address ? (
										<Text variant="caption" tone="muted">
											{address}
										</Text>
									) : null}
								</View>
								{chosen ? (
									<Ionicons
										name="checkmark"
										size={icon.control}
										color={colors.primary}
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								) : null}
							</View>
						</Card>
					</Pressable>
				);
			})}
		</View>
	);
}

function AddressPicker({
	addresses,
	value,
	onPick,
}: {
	addresses: Address[];
	value?: string;
	onPick: (id: string) => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const list = addresses.length >= 3;

	return (
		<View
			style={styles.choice}
			accessibilityRole="radiogroup"
			accessibilityLabel={t("checkout.address")}
		>
			{addresses.map((address) => {
				const chosen = value === address.id;
				// The street line and the city, which is what actually separates two saved
				// addresses; the label is the customer's own name for the place and is often the
				// same word twice.
				const where = [address.line2, address.city].filter(Boolean).join(", ");
				const name = `${address.label}: ${address.line1}`;

				if (list) {
					return (
						<Button
							key={address.id}
							label={name}
							selected={chosen}
							variant={chosen ? "primary" : "secondary"}
							onPress={() => onPick(address.id)}
						/>
					);
				}

				return (
					<Pressable
						key={address.id}
						onPress={() => onPick(address.id)}
						accessibilityRole="radio"
						accessibilityState={{ checked: chosen }}
						accessibilityLabel={where ? `${name}, ${where}` : name}
						// The card inside draws the surface and the shadow, so the press target holds
						// both rather than clipping them to its own corner.
						style={styles.option}
					>
						<Card style={chosen ? { borderColor: colors.primary } : undefined}>
							<View style={styles.optionRow}>
								<View style={styles.optionText}>
									{/* No `numberOfLines` on any of the three, which is the correction
									    `./list-row` records at its own copies of these lines: the same
									    truncation was on the name of a place, and at 200% text an
									    address that wraps to three lines got an ellipsis on the screen
									    where the customer is choosing where the order goes
									    (`docs/design-mobile.md:109-110` keeps the prop for truncating
									    data and never for saving a layout). Nothing here needs saving:
									    the option row has no height, the card is padding and a border
									    (`./card`), and `optionText` is only `flex: 1` with the stack
									    gap — so the card grows to whatever the three lines come to. */}
									<Text variant="body" bold={chosen}>
										{address.label}
									</Text>
									<Text variant="caption" tone="muted">
										{address.line1}
									</Text>
									<Text variant="caption" tone="muted">
										{where}
									</Text>
								</View>
								{chosen ? (
									<Ionicons
										name="checkmark"
										size={icon.control}
										color={colors.primary}
										// The card's label already says which address is chosen — this is the
										// tick, not a second announcement of the state.
										accessibilityElementsHidden
										importantForAccessibility="no"
									/>
								) : null}
							</View>
						</Card>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	// The frame the scroll and the bar divide between them: the body's full height, and none of
	// its padding. The scroll and the bar pad themselves, and a docked bar has to reach the
	// screen's edges to be one.
	frame: { flex: 1, paddingHorizontal: 0 },
	fill: { flex: 1 },
	scroll: {
		paddingHorizontal: space.lg,
		paddingBottom: space.lg,
		gap: space.lg,
	},
	group: { gap: space.sm },
	// The progress bar and the facts under it: one block, so the gap only exists when there is a
	// chip below to be separated from the bar — an empty `Facts` renders nothing and a `gap`
	// between one child and nothing is nothing.
	state: { gap: space.sm },
	// The same `space.sm` the group stacks its own children at, because a radio group is a box
	// *inside* the group: `radiogroup` is a role rather than a look, and it cannot go on the box
	// that also carries the heading without claiming the heading is part of the choice.
	choice: { gap: space.sm },
	itemRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: space.md,
	},
	// The line's name wraps rather than pushing the row's price off the card — the same
	// `flex: 1` the receipt's rows carry in `app/order/[id].tsx`.
	itemName: { flex: 1 },
	// A coarse stand-in, said out loud: this one block stands in for whatever the step draws
	// under its heading — a stack of address cards, or the review's item rows — and is sized
	// to a control rather than to any of them. It keeps the step from reflowing, which is the
	// skeleton's job here; matching each shape it can stand in for is the work
	// `app/addresses`'s `AddressSkeleton` does for its one known row, and there is more than
	// one shape to match.
	blockSkeleton: { height: MIN_TOUCH_TARGET },
	locationMap: { height: 180, borderRadius: radius.md, overflow: "hidden" },
	// The strip above the bar, for the sentences that explain why its button is off.
	why: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.xs },
	above: { paddingHorizontal: space.lg },
	// The bar's summary, when it also has to hold the way back.
	summary: { flexDirection: "row", alignItems: "center", gap: space.md },
	back: { alignItems: "center", justifyContent: "center" },
	option: { borderRadius: radius.md, overflow: "visible" },
	optionRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	optionText: { flex: 1, gap: TEXT_STACK_GAP },
});
