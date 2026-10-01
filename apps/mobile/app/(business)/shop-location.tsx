import { OFFER_RADIUS_KM } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { MapView } from "@/components/map";
import { Screen, ScreenSection } from "@/components/screen";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import { useDeviceLocation } from "@/lib/location";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";

/**
 * Where the shop is, on a map, with the courier radius drawn around it.
 *
 * ## Why this screen exists at all
 *
 * `businessUpdateInput` has carried an optional `lat`/`lng` since before this file existed,
 * and `businesses.ts` propagates a pair onto the default `merchant_location` in the same
 * batch that writes it to `business`. The API was ready. Nothing in the app was willing to
 * *send* one: every `lat:` in `apps/mobile` was a read — consumer screens, `components/map`,
 * `lib/courier-tracking` — and not one was a merchant answering a question about their own
 * shop.
 *
 * That left `OFFER_RADIUS_KM` with no origin to measure from. `candidateFor` in
 * `delivery-dispatch.ts` refuses a pickup with no coordinates rather than guessing a city
 * for it, so a shop with delivery switched on received no offers, ever, and said nothing —
 * the order sat in `SEARCHING` and the courier's board was empty. The ring drawn here is the
 * radius the dispatcher uses; the tap is the fix.
 *
 * ## The pin and the camera are two different positions
 *
 * The reader's phone is usually in the same building as the shop, so the device fix is a
 * decent guess — but a guess that silently became a saved coordinate is exactly the class of
 * bug this screen exists to end. So the device fix is only ever the **camera's** starting
 * point. The pin is `picked ?? saved`, and it is never the device fix until the reader taps
 * the button that says so in words.
 *
 * That separation is also why `MapView` takes `coords` and `marker` separately: the camera
 * stays where it was left while the pin follows the finger, so tapping the map never yanks
 * the tiles under the thumb.
 */
export default function ShopLocation() {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const scope = useMerchantScope();

	/**
	 * The shop, resolved the way `shop-settings.tsx` and `locations.tsx` both resolve it:
	 * the operator's chosen branch, else the first shop they actually own.
	 *
	 * `scope.businessId` is optional by type, so it is used as a *preference* and not as the
	 * answer. A merchant with the provider mounted but no branch selected would otherwise
	 * open this screen with `businessId === undefined` and quietly write to nothing.
	 */
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const owned = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		owned.find((one) => one.businessId === scope.businessId) ?? owned[0];
	const businessId = shop?.businessId ?? "";

	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId },
			{ enabled: businessId.length > 0 },
		),
	);
	const device = useDeviceLocation();

	/**
	 * The tap, or `null` until there is one.
	 *
	 * Separate from the saved value rather than merged into it so that "unsaved change"
	 * survives a refetch: a `settings` invalidation after the save cannot stomp a tap the
	 * merchant made a second earlier.
	 */
	const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
		null,
	);
	const [saving, setSaving] = useState(false);

	const update = useMutation(trpc.business.update.mutationOptions());

	// `typeof … === "number"` rather than a truthiness test: `0` and `-0` are legal
	// longitudes and latitudes, and `null` is the only value that means "unset" here.
	const saved =
		settings.data &&
		typeof settings.data.lat === "number" &&
		typeof settings.data.lng === "number"
			? { lat: settings.data.lat, lng: settings.data.lng }
			: null;

	// The pin: what the reader has chosen, falling back to what the server has.
	const pin = picked ?? saved;
	// The camera: the pin if there is one, and otherwise wherever the merchant is standing,
	// so a shop that has never been placed still opens on a usable map instead of on
	// `MapView`'s silent `null`.
	const centre = pin ?? device.coords;

	const submit = () => {
		if (update.isPending || !picked) return;
		setSaving(true);
		update.mutate(
			{
				businessId,
				lat: picked.lat,
				lng: picked.lng,
			},
			{
				onSuccess: async () => {
					setSaving(false);
					// The tap has become the saved value, so it is no longer a change.
					setPicked(null);
					toast.show(t("biz.settings.saved"));
					await cache.invalidateQueries({
						queryKey: trpc.business.pathKey(),
					});
				},
				onError: () => setSaving(false),
			},
		);
	};

	const failed = shops.error ?? settings.error ?? update.error;

	return (
		<View style={{ flex: 1 }}>
			<Screen
				title={t("biz.location.title")}
				subtitle={t("biz.location.body")}
				leading={<BackButton to="/more" />}
				scroll
			>
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void settings.refetch();
							update.reset();
						}}
					/>
				) : !shop ? (
					<Text>{t("biz.onboarding.notLive")}</Text>
				) : (
					<ScreenSection title={t("biz.location.map")}>
						{/* The one case where there is genuinely nothing to draw: no saved
						    position, no fix, and therefore no centre. `MapView` answers this
						    with `null`, and a blank screen under a title that promises a map
						    is the same failure this screen was built to fix — so it is said in
						    words, with the one action that can change it. */}
						{centre ? (
							<MapView
								coords={centre}
								marker={pin}
								radiusKm={OFFER_RADIUS_KM}
								onPick={setPicked}
							/>
						) : (
							<View>
								<Text variant="body" tone="muted">
									{t("biz.location.noFix")}
								</Text>
								<Button
									label={t("biz.location.useDevice")}
									onPress={device.request}
									fullWidth
								/>
							</View>
						)}

						{centre ? (
							<>
								<Text variant="caption" tone="muted">
									{t("biz.location.radius", {
										count: OFFER_RADIUS_KM,
									})}
								</Text>
								{/* Offered only when it would do something. On a shop that has
								    never been placed the button *is* the way out, so it stays; on
								    one already placed it is the fast path for a merchant who is
								    standing in the shop and does not want to nudge a pin. */}
								{device.coords ? (
									<Button
										label={t("biz.location.useDevice")}
										onPress={() => setPicked(device.coords)}
										variant="secondary"
										fullWidth
									/>
								) : null}
							</>
						) : null}
					</ScreenSection>
				)}
			</Screen>

			{/* Only mounted once there is something to save. A Save that is present but
			    inert on every fresh screen is a control the reader has to learn to distrust
			    before they can use it at all. */}
			{picked && !failed ? (
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
