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

/**
 * How often a `preferCurrent` caller re-reads its position.
 *
 * Half the server's `PRESENCE_FRESH_MS`, which is two minutes: the tick lands well inside
 * the window even when one is dropped, and halving it rather than matching it is what makes
 * a late tick harmless instead of an outage.
 */
const CURRENT_FIX_POLL_MS = 60 * 1000;
const CURRENT_FIX_RETRY_MS = 20 * 1000;
const RECENT_FIX_MAX_AGE_MS = 30 * 1000;

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
export function useDeviceLocation(
	options: {
		/** Skip location reads while a courier is unavailable for offers. */
		enabled?: boolean;
		/**
		 * Read a **current** fix, allowing a recent fix only if the provider fails.
		 *
		 * The cache is the right answer for browsing and the wrong one for presence. A
		 * cached fix is a claim about where the device *was*, and for a browse screen that
		 * only sorts a list by distance, where minutes of staleness change nothing. For
		 * presence it is a claim about where the courier is **right now**, and the server
		 * stamps whatever it receives with a fresh `updatedAt` — so a cached fix that is
		 * hours old passes the freshness window while being geographically wrong, and
		 * `candidateFor` either offers the courier runs across town or none at all.
		 *
		 * The cost is the cold GPS wait the cache exists to avoid, which is why this is
		 * opt-in: the courier board asks for the truth and pays for it, and the browsing
		 * screens do not.
		 */
		preferCurrent?: boolean;
	} = {},
): {
	coords: DeviceLocation;
	status: LocationStatus;
	request: () => void;
} {
	const { preferCurrent = false, enabled = true } = options;
	const [coords, setCoords] = useState<DeviceLocation>(null);
	const [status, setStatus] = useState<LocationStatus>("asking");
	const mounted = useRef(false);
	const sequence = useRef(0);
	const requesting = useRef(false);

	const refresh = useCallback(
		async (explicit = false) => {
			if (!mounted.current || !enabled || requesting.current) return;
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

				// A cached fix avoids a cold GPS wait, and `preferCurrent` is what opts
				// out of it — see that option's own note for why the courier board does. Never
				// read either before checking both permission and services: a cached coordinate
				// can outlive either consent.
				let position = preferCurrent
					? null
					: await Location.getLastKnownPositionAsync();
				if (!isCurrent()) return;
				if (!position) {
					try {
						position = await Location.getCurrentPositionAsync({
							accuracy: preferCurrent
								? Location.Accuracy.High
								: Location.Accuracy.Balanced,
							// Couriers need the provider enabled before they can receive offers.
							mayShowUserSettingsDialog: explicit || preferCurrent,
						});
					} catch (error) {
						if (!preferCurrent) throw error;
						// A recent fix bridges a transient provider failure. Never restamp
						// an old position as fresh courier presence.
						position = await Location.getLastKnownPositionAsync({
							maxAge: RECENT_FIX_MAX_AGE_MS,
							requiredAccuracy: 1000,
						});
						if (!position) throw error;
					}
				}
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
		},
		[preferCurrent, enabled],
	);

	useEffect(() => {
		mounted.current = true;
		if (!enabled) {
			setCoords(null);
			setStatus("asking");
			return () => {
				mounted.current = false;
				sequence.current += 1;
			};
		}
		void refresh();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void refresh();
			// A read started before opening settings must not publish while away.
			else if (!requesting.current) sequence.current += 1;
		});
		// The poll, and only for a caller that asked for a current fix. A browse screen
		// reads once per mount and never repeats it; the courier board cannot, because a
		// presence the server considers fresh is a promise about *now* and `coords` held in
		// state stops being that. Half the server's `PRESENCE_FRESH_MS` is the margin: the
		// tick lands well inside two minutes even when one is dropped.
		const poll = preferCurrent
			? setInterval(() => {
					void refresh();
				}, CURRENT_FIX_POLL_MS)
			: null;
		return () => {
			mounted.current = false;
			sequence.current += 1;
			subscription.remove();
			if (poll !== null) clearInterval(poll);
			requesting.current = false;
		};
	}, [refresh, preferCurrent, enabled]);

	useEffect(() => {
		if (!enabled || !preferCurrent || status !== "unavailable") return;
		const retry = setTimeout(() => void refresh(), CURRENT_FIX_RETRY_MS);
		return () => clearTimeout(retry);
	}, [enabled, preferCurrent, status, refresh]);

	const request = useCallback(() => {
		void refresh(true);
	}, [refresh]);

	return { coords, status, request };
}
