import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { isMapAvailable, MapView } from "@/components/map";
import { Sheet } from "@/components/sheet";
import { useTabBarClearance } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import type { DeviceLocation, LocationStatus } from "@/lib/location";
import { space } from "@/theme";

const OVERVIEW_CENTER = { lat: 9.9281, lng: -84.0907 };

export function HomeLocationPicker({
	open,
	current,
	locationStatus,
	pinned,
	onClose,
	onRequestCurrent,
	onUseCurrent,
	onApplyPin,
	onSaveAddress,
}: {
	open: boolean;
	current: DeviceLocation;
	locationStatus: LocationStatus;
	pinned: DeviceLocation;
	onClose: () => void;
	onRequestCurrent: () => void;
	onUseCurrent: () => void;
	onApplyPin: (coords: NonNullable<DeviceLocation>) => void;
	onSaveAddress: (coords: NonNullable<DeviceLocation>) => void;
}) {
	const { t } = useT();
	const { height, fontScale } = useWindowDimensions();
	const tabBarClearance = useTabBarClearance();
	// Large text makes the instruction and actions taller. Give that space back from the map
	// while keeping enough map to pan and place a pin with a finger.
	const normalMapHeight = Math.min(480, height * 0.48);
	const mapHeight = Math.min(
		normalMapHeight,
		Math.max(
			180,
			height * Math.max(0.28, 0.48 - 0.12 * Math.max(0, fontScale - 1)),
		),
	);
	const [draft, setDraft] = useState<DeviceLocation>(null);
	const [applied, setApplied] = useState<DeviceLocation>(null);
	const [mapTouching, setMapTouching] = useState(false);
	const knownPosition = pinned ?? current;
	const center = knownPosition ?? OVERVIEW_CENTER;
	const mapAvailable = isMapAvailable();
	const pick = (coords: NonNullable<DeviceLocation>) => {
		setDraft(coords);
		setApplied(null);
	};

	useEffect(() => {
		if (open) {
			setDraft(null);
			setApplied(null);
			setMapTouching(false);
		}
	}, [open]);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={t("location.title")}
			closeLabel={t("action.close")}
			snapPoints={[1]}
			scrollEnabled={!mapTouching}
			footer={<View style={{ height: tabBarClearance + space.md }} />}
		>
			<View style={{ gap: space.md }}>
				{mapAvailable ? (
					<>
						<Text variant="caption" tone="muted">
							{t("location.mapInstruction")}
						</Text>
						<View
							onTouchStart={() => setMapTouching(true)}
							onTouchEnd={(event) => {
								if (event.nativeEvent.touches.length === 0)
									setMapTouching(false);
							}}
							onTouchCancel={() => setMapTouching(false)}
						>
							<MapView
								coords={center}
								marker={draft ?? pinned}
								zoom={knownPosition ? 14 : 7}
								showUserLocation={
									locationStatus === "granted" && current !== null
								}
								style={{ height: mapHeight }}
								onPick={pick}
							/>
						</View>
					</>
				) : (
					<Text variant="body" tone="muted">
						{t("location.mapUnavailable")}
					</Text>
				)}

				{!current &&
				(locationStatus === "denied" || locationStatus === "unavailable") ? (
					<Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
						{t(
							locationStatus === "denied"
								? "location.permissionDenied"
								: "location.providerUnavailable",
						)}
					</Text>
				) : null}

				<Button
					label={t(
						locationStatus === "asking" && !current
							? "state.loading"
							: "location.use",
					)}
					loading={locationStatus === "asking" && !current}
					variant="secondary"
					fullWidth
					onPress={() => {
						if (!current) {
							onRequestCurrent();
							return;
						}
						onUseCurrent();
					}}
				/>

				{draft ? (
					applied ? (
						<>
							<Button
								label={t("location.saveAddress")}
								variant="secondary"
								fullWidth
								onPress={() => onSaveAddress(applied)}
							/>
							<Button label={t("location.done")} fullWidth onPress={onClose} />
						</>
					) : (
						<Button
							label={t("location.applyPin")}
							fullWidth
							onPress={() => {
								onApplyPin(draft);
								setApplied(draft);
							}}
						/>
					)
				) : null}
			</View>
		</Sheet>
	);
}
