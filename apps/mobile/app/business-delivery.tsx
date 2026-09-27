import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Switch } from "@/components/switch";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { setAccountProfile } from "@/lib/device-prefs";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, radius, space } from "@/theme";

/**
 * Step three of opening a shop: delivery numbers and the first courier.
 *
 * At the root beside the form that leads here, for the reason that file
 * states: the reader is not yet anyone the business tree would let in.
 *
 * The two capability switches, the minimum order, the fee, the radius and the
 * prep time all land through `business.update`; the courier's email, when
 * given, becomes a COURIER membership through `business.inviteStaff` -- which
 * refuses an address with no account, so the form states that rule beside the
 * field rather than letting the round trip discover it. Either write may fail
 * while the other succeeded: the settings save first, and an invite refusal
 * leaves the screen open on the saved numbers with the sentence about the
 * email, so retrying cannot double-apply anything. The toast fires only when
 * everything asked for is done.
 *
 * Skippable on purpose: a pickup-only shop has no delivery to configure, and
 * a shop whose courier has no account yet should not be held at this screen
 * waiting for one. This screen is where a shop's delivery settings are set --
 * the two switches, the minimum order, and the fee, radius and prep time -- and
 * it stays that way: `app/(business)/shop-settings.tsx` owns the identity and
 * deliberately leaves the numbers here rather than splitting one write across
 * two screens, and `app/(business)/more.tsx` reaches this screen again from
 * the board.
 */
export default function BusinessDelivery() {
	const { businessId: given } = useLocalSearchParams<{ businessId?: string }>();
	const trpc = useTRPC();
	const { status } = useSession();
	const signedIn = status === "signed-in";

	// The parameter wins: onboarding step three knows which shop it is opening,
	// and `app/new-business.tsx` hands it the one it just created. Without one —
	// `app/(business)/more.tsx` used to push this screen bare, and a deep link
	// still can — the shop is the reader's own non-COURIER membership, the same
	// rule that screen uses to pick it. The bounce this replaces kicked a
	// merchant straight back to the Orders board from the row they had just
	// tapped, before the read that names their shop had landed.
	const shops = useQuery(
		trpc.business.myBusinesses.queryOptions(undefined, {
			enabled: signedIn && !given,
		}),
	);
	const owned = (shops.data ?? []).find((one) => one.role !== "COURIER");
	// `||`, not `??`: a push that carried an empty `businessId` (one a screen can
	// hold before its own read lands) is a parameter that named nothing, and the
	// membership answers that the same way it answers no parameter at all.
	const businessId = given || owned?.businessId;

	// `isPending` only counts when this screen is the one that asked: a query
	// left `enabled: false` because the parameter already named the shop reports
	// `isPending` for ever, and that is not a wait — the same trap
	// `app/(business)/shop-settings.tsx` notes one screen over. A reader with no
	// membership is not held here either; they are bounced.
	const resolving = !given && signedIn && shops.isPending;

	// No shop to configure, and now we know it: back to the board rather than a
	// form whose save would have nowhere to go. The effect owns the navigation
	// because render must stay side-effect free; the null below holds the frame
	// meanwhile.
	useEffect(() => {
		if (resolving) return;
		if (!businessId) leaveScreen("/business");
	}, [businessId, resolving]);
	if (!businessId) return null;
	return <DeliveryForm businessId={businessId} />;
}

function DeliveryForm({ businessId }: { businessId: string }) {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { status } = useSession();
	const toast = useToast();

	const signedIn = status === "signed-in";
	const settings = useQuery(
		trpc.business.settings.queryOptions({ businessId }, { enabled: signedIn }),
	);

	const [fee, setFee] = useState("");
	const [radius, setRadius] = useState("");
	const [prep, setPrep] = useState("");
	const [courierEmail, setCourierEmail] = useState("");
	const [minOrder, setMinOrder] = useState("");
	// The two capability switches. Saved with the numbers, in the same write, but
	// a `Switch` holds a boolean and not "untouched": these open on the row's own
	// values rather than on a sentinel, so there is no third state to clear back
	// to and a save always says which way each one is on.
	const [deliveryOn, setDeliveryOn] = useState(true);
	const [pickupOn, setPickupOn] = useState(true);
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	// Which write refused, when one did. The sentence itself is derived in
	// render from the matching mutation's error — storing the message in the
	// callback would read the render the press happened on, not the one the
	// refusal arrived in.
	const [failedStep, setFailedStep] = useState<"update" | "invite" | null>(
		null,
	);
	const prefilled = useRef(false);

	const update = useMutation(trpc.business.update.mutationOptions());
	const invite = useMutation(trpc.business.inviteStaff.mutationOptions());
	const updateFailure = useApiFailure(update.error);
	const inviteFailure = useApiFailure(invite.error);

	const waiting = useSkeletonHold(
		status === "loading" || (signedIn && settings.isPending),
	);

	// The shop's own numbers, once: an empty box that means "unchanged" would
	// save zeros over real values, so the fields open holding what the server
	// has. Once, because a refetch after the save must not stomp typing.
	useEffect(() => {
		if (prefilled.current || !settings.data) return;
		prefilled.current = true;
		setFee(String(settings.data.deliveryFeeMinor));
		setRadius(String(settings.data.deliveryRadiusKm));
		setPrep(String(settings.data.prepTimeMinutes));
		setMinOrder(String(settings.data.minOrderMinor));
		setDeliveryOn(settings.data.deliveryEnabled);
		setPickupOn(settings.data.pickupEnabled);
	}, [settings.data]);

	const parseFee = (): number | null => {
		if (!fee.trim()) return 0;
		// The API's own ceiling on `deliveryFeeMinor`, so a too-large fee fails
		// here in the field rather than as a server refusal after the round trip.
		return /^\d+$/.test(fee.trim()) && Number(fee.trim()) <= MAX_FEE_MINOR
			? Number(fee.trim())
			: null;
	};
	const parseRadius = (): number | null => {
		if (!radius.trim()) return null;
		const value = Number(radius.trim());
		return Number.isFinite(value) && value >= 0 && value <= 80 ? value : null;
	};
	const parsePrep = (): number | null => {
		if (!prep.trim()) return null;
		return /^\d+$/.test(prep.trim()) && Number(prep.trim()) <= MAX_PREP_MINUTES
			? Number(prep.trim())
			: null;
	};
	const parseMinOrder = (): number | null => {
		if (!minOrder.trim()) return 0;
		// The API's own ceiling on `minOrderMinor`, so a too-large minimum fails
		// here in the field rather than as a server refusal after the round trip.
		return /^\d+$/.test(minOrder.trim()) &&
			Number(minOrder.trim()) <= MAX_MIN_ORDER_MINOR
			? Number(minOrder.trim())
			: null;
	};
	const emailOk = !courierEmail.trim() || EMAIL_SHAPE.test(courierEmail.trim());
	const numbersOk =
		parseFee() !== null &&
		parseRadius() !== null &&
		parsePrep() !== null &&
		parseMinOrder() !== null;
	// At least one way to hand a customer their order. Both off is a shop that
	// takes no orders at all, which `biz.new.kind.required` says in as many words
	// -- the same rule `app/new-business.tsx` enforces on the day the shop opens.
	const kindsValid = deliveryOn || pickupOn;

	/**
	 * Out of onboarding and into the console, as an owner.
	 *
	 * A replace rather than `leaveScreen`'s back: back would return to the form
	 * that created the shop, and the shop exists now — the merchant home is the
	 * place. The profile flips first, awaited, for the same reason the account
	 * hub persists before it moves: the business tree's guard re-reads storage
	 * on mount, and navigating before the write lands resolves the old profile
	 * and bounces straight back to the customer feed. A new owner who finished
	 * onboarding and landed on the feed they started from would have a ladder
	 * with its last rung missing.
	 */
	const finishOnboarding = () => {
		toast.show(t("biz.onboarding.step.done"));
		void (async () => {
			await setAccountProfile("business");
			router.replace("/(business)");
		})();
	};

	const submit = () => {
		if (update.isPending || invite.isPending) return;
		setSubmitted(true);
		if (!numbersOk || !kindsValid || !emailOk) return;
		setSaving(true);
		setFailedStep(null);
		const feeMinor = parseFee() ?? 0;
		const radiusKm = parseRadius() ?? 0;
		const prepMinutes = parsePrep() ?? 0;
		const minOrderMinor = parseMinOrder() ?? 0;
		update.mutate(
			{
				businessId,
				deliveryEnabled: deliveryOn,
				pickupEnabled: pickupOn,
				minOrderMinor,
				deliveryFeeMinor: feeMinor,
				deliveryRadiusKm: radiusKm,
				prepTimeMinutes: prepMinutes,
			},
			{
				onSuccess: () => {
					const email = courierEmail.trim().toLowerCase();
					if (!email) {
						setSaving(false);
						finishOnboarding();
						return;
					}
					invite.mutate(
						{ businessId, email, role: "COURIER" },
						{
							onSuccess: async () => {
								setSaving(false);
								await cache.invalidateQueries({
									queryKey: trpc.business.pathKey(),
								});
								finishOnboarding();
							},
							onError: async () => {
								// The numbers already landed; only the invite
								// failed, so the screen stays open on them with
								// the refusal, and the toast stays silent.
								setSaving(false);
								setFailedStep("invite");
								await cache.invalidateQueries({
									queryKey: trpc.business.pathKey(),
								});
							},
						},
					);
				},
				onError: () => {
					setSaving(false);
					setFailedStep("update");
				},
			},
		);
	};

	const edited = (apply: () => void) => {
		apply();
		setFailedStep(null);
		if (update.isError) update.reset();
		if (invite.isError) invite.reset();
	};

	const failure =
		failedStep === "update"
			? updateFailure.message
			: failedStep === "invite"
				? inviteFailure.message
				: null;

	// `ready`, and not `ready && deliveryOn`: the switches live on this screen
	// now, so a shop with delivery off has to be able to turn it on -- gating the
	// save on the old read's value is the screen that cannot make the change it
	// is asking for.
	const ready = signedIn && !!settings.data && !waiting;

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the
	 * assertion on the failure line below is the whole of Android's announcement of this
	 * sentence, and iOS, which ignores the prop, has to be told. Guarded by the platform rather
	 * than announced on both: a sentence a live region has already spoken is not read twice, it
	 * is read as two sentences. `failure` is already one value for the screen — the two writes
	 * share it and `failedStep` picks the sentence — so this is one announcement per step that
	 * failed, and editing clears `failedStep` before the next attempt.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !failure) return;
		AccessibilityInfo.announceForAccessibility(failure);
	}, [failure]);

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.onboarding.delivery.title")}
				subtitle={t("biz.onboarding.delivery.body")}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					{waiting ? (
						<DeliverySkeleton loadingLabel={t("state.loading")} />
					) : settings.isError ? (
						<ErrorState
							error={settings.error}
							onRetry={() => void settings.refetch()}
						/>
					) : settings.data ? (
						<>
							{/* The two ways an order reaches a customer, and the rule that says
								    at least one has to stay on. Both are always drawn: a pickup-only shop
								    turning delivery on is the one gesture this screen exists for after
								    onboarding, and hiding the switch behind the state it controls is a
								    screen that cannot make the change it is for. */}
							<AnimateIn index={0}>
								<ScreenSection title={t("biz.settings.delivery")}>
									<View style={formStyles.switchRow}>
										<Switch
											checked={deliveryOn}
											onChange={(next) => edited(() => setDeliveryOn(next))}
											label={t("biz.settings.delivery.enabled")}
										/>
										<Text variant="label">
											{t("biz.settings.delivery.enabled")}
										</Text>
									</View>

									{/* The order's floor, and not one of the three numbers below: it stands
										    whether the order is driven over or walked out, so it is drawn even
										    when delivery is off. Same minor-unit help the fee states, for the same
										    reason -- the unit is a rule for programmers. */}
									<Field
										label={t("biz.settings.delivery.minOrder")}
										value={minOrder}
										onChangeText={(value) => edited(() => setMinOrder(value))}
										error={
											submitted && parseMinOrder() === null
												? t("biz.new.amount.unreadable")
												: null
										}
										help={t("biz.settings.delivery.fee.help")}
										keyboardType="number-pad"
										placeholder="0"
									/>

									{deliveryOn ? (
										<>
											<Field
												label={t("biz.settings.delivery.fee")}
												value={fee}
												onChangeText={(value) => edited(() => setFee(value))}
												error={
													submitted && parseFee() === null
														? t("biz.new.amount.unreadable")
														: null
												}
												// The one field whose unit is not obvious: minor units is a
												// rule for programmers, so the dictionary states it with
												// the two currencies a merchant in this market would type.
												help={t("biz.settings.delivery.fee.help")}
												keyboardType="number-pad"
												placeholder="0"
											/>
											<Field
												label={t("biz.settings.delivery.radius")}
												value={radius}
												onChangeText={(value) => edited(() => setRadius(value))}
												error={
													submitted && parseRadius() === null
														? t("biz.new.number.unreadable")
														: null
												}
												keyboardType="decimal-pad"
												placeholder="6"
											/>
											<Field
												label={t("biz.settings.delivery.prepTime")}
												value={prep}
												onChangeText={(value) => edited(() => setPrep(value))}
												error={
													submitted && parsePrep() === null
														? t("biz.new.number.unreadable")
														: null
												}
												keyboardType="number-pad"
												placeholder="25"
											/>
										</>
									) : null}
								</ScreenSection>
							</AnimateIn>

							<AnimateIn index={1}>
								<ScreenSection title={t("biz.settings.pickup")}>
									<View style={formStyles.switchRow}>
										<Switch
											checked={pickupOn}
											onChange={(next) => edited(() => setPickupOn(next))}
											label={t("biz.settings.pickup.enabled")}
										/>
										<Text variant="label">
											{t("biz.settings.pickup.enabled")}
										</Text>
									</View>
									{/* The pair's one rule, stated on the second of the two so the refusal
										    sits beside the control that would clear it rather than floating
										    between them. */}
									{submitted && !kindsValid ? (
										<Text
											variant="body"
											tone="destructive"
											accessibilityRole="alert"
										>
											{t("biz.new.kind.required")}
										</Text>
									) : null}
								</ScreenSection>
							</AnimateIn>

							{/* A courier delivers: with delivery off the role has nothing to carry, so
								    the section closes rather than offering an invite to a team that cannot
								    use one. */}
							{deliveryOn ? (
								<AnimateIn index={2}>
									<ScreenSection title={t("biz.onboarding.delivery.courier")}>
										<Field
											label={t("biz.onboarding.delivery.courier")}
											value={courierEmail}
											onChangeText={(value) =>
												edited(() => setCourierEmail(value))
											}
											error={
												submitted && !emailOk ? t("form.invalidEmail") : null
											}
											help={t("biz.onboarding.delivery.courierHelp")}
											keyboardType="email-address"
											autoComplete="email"
											autoCapitalize="none"
										/>
									</ScreenSection>
								</AnimateIn>
							) : null}

							{failure ? (
								<AnimateIn index={3}>
									<Text
										variant="body"
										tone="destructive"
										accessibilityRole="alert"
										accessibilityLiveRegion="assertive"
									>
										{failure}
									</Text>
								</AnimateIn>
							) : null}

							<AnimateIn index={4}>
								<Button
									label={t("biz.onboarding.delivery.skip")}
									variant="ghost"
									fullWidth
									onPress={() => {
										// Skipping still leaves owning a shop: the numbers
										// were saved on the previous step, so the way out
										// is the same door as the way through.
										finishOnboarding();
									}}
								/>
							</AnimateIn>
						</>
					) : null}
				</SignedIn>
			</Screen>

			{ready ? (
				<ActionBar
					docked
					primary={{
						label: t("action.save"),
						onPress: submit,
						loading: saving,
						disabled: saving,
					}}
				/>
			) : null}
		</View>
	);
}

/** Prep time's ceiling, from `businessCreateInput` (`prepTimeMinutes`). */
const MAX_PREP_MINUTES = 600;

/** The fee's, from the same schema (`deliveryFeeMinor`), so both fail in the field. */
const MAX_FEE_MINOR = 10_000_000;

/** The minimum order's, from the same schema (`minOrderMinor`), for the same reason. */
const MAX_MIN_ORDER_MINOR = 100_000_000;

/**
 * `components/switch`'s own box, restated for the same reason `HAIRLINE` is:
 * the control measures itself and exports none of the numbers. The target is
 * 48 and the track inside it is 44x28 with a 20-point thumb.
 */
const SWITCH_TARGET = 48;
const SWITCH_TRACK_W = 44;
const SWITCH_TRACK_H = 28;

/** Same shape check as the profile form: worth stopping for, not a full RFC. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The hairline `./button` draws on every variant, at `borderWidth: 1` — the same two
 * points `./skeletons`' private `HAIRLINE` counts into the control boxes it mirrors,
 * restated here because that constant is not exported and this screen's wait counts them
 * in the skip button's box.
 */
const HAIRLINE = 1;

/**
 * The delivery section's number fields, named so a key never falls to array
 * position. `minOrder` is first because it is drawn first: it stands whether
 * the order is driven over or walked out.
 */
const SKELETON_NUMBER_FIELDS = ["minOrder", "fee", "radius", "prep"] as const;

/**
 * The wait, in the loaded form's own shape -- the way `./product-form`'s
 * `FormSkeleton` draws its form, because these screens are one onboarding ladder
 * and their waits should read alike.
 *
 * The two capability switches each draw the control's own track beside its
 * sentence, the delivery section's four number fields and the courier section's
 * one email field each draw `./field`'s triple -- label, box, message line --
 * under their own real `ScreenSection` titles, which are the screen's copy
 * rather than facts a read carries. The switch rows are drawn at
 * `components/switch`'s own target rather than at `MIN_TOUCH_TARGET`, for the
 * reason that file states: the track is 28 tall and the target is the box
 * around it, so a bar at the touch floor would be a bar the real row does not
 * pay.
 *
 * The skip button is drawn at `./button`'s own `md` sum: the label's `heading`
 * line at the reader's scale, `space.md` of vertical padding twice and the
 * hairline twice, over `MIN_TOUCH_TARGET`, at the button's `radius.sm` corner.
 * Every text height goes through `./skeletons`' `line()` at the reader's
 * `fontScale` -- a height frozen at 100% metrics is exact at 100% and short of
 * the real form at 200% by the growth of its own lines. `Skeleton`'s `label` on
 * the first line is the one announcement for the whole wait.
 *
 * The delivery numbers are drawn whether the shop has delivery on or not: the
 * read has not answered, so the skeleton cannot know, and a wait that guessed
 * the shorter shape would jump twice for the shop it guessed wrong.
 */
function DeliverySkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// One `./button` at its `md` size: the label's `heading` line at the reader's
	// scale, `space.md` of vertical padding twice and the hairline twice, over the
	// touch floor.
	const skipButton = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.md * 2 + line("heading", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<ScreenSection title={t("biz.settings.delivery")}>
				<View style={formStyles.switchRow}>
					<Skeleton style={formStyles.switchTrack} />
					<Skeleton
						style={[formStyles.switchLabel, line("label", fontScale)]}
					/>
				</View>
				{SKELETON_NUMBER_FIELDS.map((field) => (
					<View key={field} style={formStyles.field}>
						<Skeleton
							label={field === "minOrder" ? loadingLabel : undefined}
							style={[formStyles.label, line("label", fontScale)]}
						/>
						<Skeleton style={formStyles.input} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				))}
			</ScreenSection>

			<ScreenSection title={t("biz.settings.pickup")}>
				<View style={formStyles.switchRow}>
					<Skeleton style={formStyles.switchTrack} />
					<Skeleton
						style={[formStyles.switchLabel, line("label", fontScale)]}
					/>
				</View>
			</ScreenSection>

			<ScreenSection title={t("biz.onboarding.delivery.courier")}>
				<View style={formStyles.field}>
					<Skeleton style={[formStyles.label, line("label", fontScale)]} />
					<Skeleton style={formStyles.input} />
					<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				</View>
			</ScreenSection>

			<Skeleton
				style={{
					height: skipButton,
					borderRadius: radius.sm,
					width: "100%",
				}}
			/>
		</View>
	);
}

/**
 * The grey field's own rows -- `./field`'s wrap gap between the label, the box
 * and the message row (`components/field.tsx`'s `wrap`), the box at the floor
 * the real input pays, the widths shares for words the read does not carry. The
 * same set `./product-form`'s form skeleton draws, restated here because that
 * file's is private to it.
 *
 * The switch row is the pair `app/(business)/shop-hours` draws for a day's
 * `isClosed`: `components/switch` beside the sentence that names it, at the
 * control's own target with its track at that file's 44x28.
 */
const formStyles = StyleSheet.create({
	field: { gap: space.sm },
	label: { width: "35%" },
	input: { minHeight: MIN_TOUCH_TARGET },
	message: { width: "60%" },
	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		minHeight: SWITCH_TARGET,
	},
	switchTrack: {
		width: SWITCH_TRACK_W,
		height: SWITCH_TRACK_H,
		borderRadius: radius.full,
	},
	switchLabel: { flex: 1 },
});

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
});
