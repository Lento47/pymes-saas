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
 * Step three of opening a shop: delivery numbers.
 *
 * At the root beside the form that leads here, for the reason that file
 * states: the reader is not yet anyone the business tree would let in.
 *
 * Courier invitations are deliberately not collected here. A courier joins
 * only after creating an in-app profile, receiving a platform review, and
 * accepting an invitation from Team. This screen stays skippable so a shop can
 * finish opening while that happens.
 */
export default function BusinessDelivery() {
	const { businessId } = useLocalSearchParams<{ businessId?: string }>();

	// No shop to configure: back to the board rather than a form whose save
	// would have nowhere to go. The effect owns the navigation because render
	// must stay side-effect free; the null below holds the frame meanwhile.
	useEffect(() => {
		if (!businessId) leaveScreen("/business");
	}, [businessId]);
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
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const prefilled = useRef(false);

	const update = useMutation(trpc.business.update.mutationOptions());
	const updateFailure = useApiFailure(update.error);

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
	const numbersOk =
		parseFee() !== null && parseRadius() !== null && parsePrep() !== null;

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
		if (update.isPending) return;
		setSubmitted(true);
		if (!numbersOk) return;
		setSaving(true);
		const feeMinor = parseFee() ?? 0;
		const radiusKm = parseRadius() ?? 0;
		const prepMinutes = parsePrep() ?? 0;
		update.mutate(
			{
				businessId,
				deliveryFeeMinor: feeMinor,
				deliveryRadiusKm: radiusKm,
				prepTimeMinutes: prepMinutes,
			},
			{
				onSuccess: async () => {
					setSaving(false);
					await cache.invalidateQueries({
						queryKey: trpc.business.pathKey(),
					});
					finishOnboarding();
				},
				onError: () => setSaving(false),
			},
		);
	};

	const edited = (apply: () => void) => {
		apply();
		if (update.isError) update.reset();
	};

	const failure = updateFailure.message;

	const ready = signedIn && !!settings.data && !waiting;
	const deliveryOn = settings.data?.deliveryEnabled ?? true;

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the
	 * assertion on the failure line below is the whole of Android's announcement of this
	 * sentence, and iOS, which ignores the prop, has to be told. Guarded by the platform rather
	 * than announced on both: a sentence a live region has already spoken is not read twice, it
	 * is read as two sentences. `failure` is one value for the screen, so this is one
	 * announcement for the save attempt.
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
							{/* A pickup-only shop has no delivery to configure: the
							    numbers would be settings for a capability that is
							    off, so the screen offers the way out instead. */}
							{deliveryOn ? (
								<>
									<AnimateIn index={0}>
										<ScreenSection title={t("biz.settings.delivery")}>
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
										</ScreenSection>
									</AnimateIn>

									<AnimateIn index={1}>
										<ScreenSection title={t("biz.onboarding.delivery.courier")}>
											<Text tone="muted">
												{t("biz.onboarding.delivery.courierHelp")}
											</Text>
										</ScreenSection>
									</AnimateIn>
								</>
							) : (
								// The state is not an error and not an empty screen: a pickup-only
								// shop has nothing to set, and the sentence is what says so —
								// without it, a form that shows only a skip button reads as a
								// screen that failed to load its fields.
								<Text variant="body" tone="muted">
									{t("biz.onboarding.delivery.pickupOnly")}
								</Text>
							)}

							{failure ? (
								<AnimateIn index={2}>
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

							<AnimateIn index={3}>
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

			{ready && deliveryOn ? (
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

/**
 * The hairline `./button` draws on every variant, at `borderWidth: 1` — the same two
 * points `./skeletons`' private `HAIRLINE` counts into the control boxes it mirrors,
 * restated here because that constant is not exported and this screen's wait counts them
 * in the skip button's box.
 */
const HAIRLINE = 1;

/** The delivery section's three fields, named so a key never falls to array position. */
const SKELETON_NUMBER_FIELDS = ["fee", "radius", "prep"] as const;

/**
 * The wait, in the loaded form's own shape — the way `./product-form`'s `FormSkeleton`
 * draws its form, because these screens are one onboarding ladder and their waits should
 * read alike.
 *
 * The delivery section's three number fields draw `./field`'s triple — label, box,
 * message line — under their own real `ScreenSection` title. The courier section is a
 * short explanation, so its wait is one text line rather than a fake input.
 * The skip button is drawn at `./button`'s own `md` sum: the label's `heading` line at the
 * reader's scale, `space.md` of vertical padding twice and the hairline twice, over
 * `MIN_TOUCH_TARGET`, at the button's `radius.sm` corner. Every text height goes through
 * `./skeletons`' `line()` at the reader's `fontScale` — a height frozen at 100% metrics is
 * exact at 100% and short of the real form at 200% by the growth of its own lines.
 * `Skeleton`'s `label` on the first line is the one announcement for the whole wait.
 */
function DeliverySkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// One `./button` at its `md` size: the label's `heading` line at the reader's scale,
	// `space.md` of vertical padding twice and the hairline twice, over the touch floor.
	const skipButton = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.md * 2 + line("heading", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<ScreenSection title={t("biz.settings.delivery")}>
				{SKELETON_NUMBER_FIELDS.map((field) => (
					<View key={field} style={formStyles.field}>
						<Skeleton
							label={field === "fee" ? loadingLabel : undefined}
							style={[formStyles.label, line("label", fontScale)]}
						/>
						<Skeleton style={formStyles.input} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				))}
			</ScreenSection>

			<ScreenSection title={t("biz.onboarding.delivery.courier")}>
				<Skeleton style={{ width: "80%", ...line("body", fontScale) }} />
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
 * The grey field's own rows — `./field`'s wrap gap between the label, the box and the
 * message row (`components/field.tsx`'s `wrap`), the box at the floor the real input pays,
 * the widths shares for words the read does not carry. The same set `./product-form`'s
 * form skeleton draws, restated here because that file's is private to it.
 */
const formStyles = StyleSheet.create({
	field: { gap: space.sm },
	label: { width: "35%" },
	input: { minHeight: MIN_TOUCH_TARGET },
	message: { width: "60%" },
});

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
});
