import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

/** Location improves distance sorting; browsing never requires a permission. */
export type DeviceLocation = {
	lat: number;
	lng: number;
} | null;

export type LocationStatus = "asking" | "granted" | "denied" | "unavailable";

type Permission = Awaited<
	ReturnType<typeof Location.getForegroundPermissionsAsync>
>;

// Several mounted screens share the permission, but only an explicit action may ask.
let permissionRequest: Promise<Permission> | null = null;

function requestPermission(): Promise<Permission> {
	permissionRequest ??= Location.requestForegroundPermissionsAsync().finally(
		() => {
			permissionRequest = null;
		},
	);
	return permissionRequest;
}

/**
 * Read permission on mount and on return from system settings. Only `request()` may
 * raise a permission dialog or open settings after Android stops allowing another ask.
 * A denied permission or unavailable provider clears the previous fix. The sequence
 * prevents an older location read restoring coordinates after a newer refusal.
 */
export function useDeviceLocation(): {
	coords: DeviceLocation;
	status: LocationStatus;
	request: () => void;
} {
	const [coords, setCoords] = useState<DeviceLocation>(null);
	const [status, setStatus] = useState<LocationStatus>("asking");
	const mounted = useRef(false);
	const sequence = useRef(0);
	const requesting = useRef(false);

	const refresh = useCallback(async (explicit = false) => {
		if (!mounted.current || requesting.current) return;
		if (explicit) requesting.current = true;
		const current = ++sequence.current;
		const isCurrent = () => mounted.current && sequence.current === current;
		setCoords(null);
		setStatus("asking");

		try {
			const pendingPermission = permissionRequest;
			let permission = await (pendingPermission ??
				Location.getForegroundPermissionsAsync());
			if (!isCurrent()) return;
			if (!permission.granted && explicit && !pendingPermission) {
				if (!permission.canAskAgain) {
					setStatus("denied");
					requesting.current = false;
					await Linking.openSettings();
					return;
				}
				permission = await requestPermission();
			}
			if (!isCurrent()) return;
			if (explicit) requesting.current = false;
			if (!permission.granted) {
				setStatus("denied");
				return;
			}

			const enabled = await Location.hasServicesEnabledAsync();
			if (!isCurrent()) return;
			if (!enabled) {
				setStatus("unavailable");
				return;
			}

			// A cached fix avoids a cold GPS wait. Never read it before checking both
			// permission and services: a cached coordinate can outlive either consent.
			const cached = await Location.getLastKnownPositionAsync();
			if (!isCurrent()) return;
			const position =
				cached ??
				(await Location.getCurrentPositionAsync({
					accuracy: Location.Accuracy.Balanced,
					// Passive screen reads must not raise Android's provider dialog.
					mayShowUserSettingsDialog: explicit,
				}));
			if (!isCurrent()) return;
			setCoords({
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			});
			setStatus("granted");
		} catch {
			if (isCurrent()) {
				setCoords(null);
				setStatus("unavailable");
			}
		} finally {
			if (explicit && isCurrent()) requesting.current = false;
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		void refresh();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void refresh();
			// A read started before opening settings must not publish while away.
			else if (!requesting.current) sequence.current += 1;
		});
		return () => {
			mounted.current = false;
			sequence.current += 1;
			subscription.remove();
			requesting.current = false;
		};
	}, [refresh]);

	const request = useCallback(() => {
		void refresh(true);
	}, [refresh]);

	return { coords, status, request };
}
