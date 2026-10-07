import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DeviceLocation } from "@/lib/location";

const KEY = "pymeshub_browse_location";

export function parseBrowseLocation(value: string | null): DeviceLocation {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== "object" || parsed === null) return null;
		const { lat, lng } = parsed as { lat?: unknown; lng?: unknown };
		if (
			typeof lat !== "number" ||
			typeof lng !== "number" ||
			!Number.isFinite(lat) ||
			!Number.isFinite(lng) ||
			lat < -90 ||
			lat > 90 ||
			lng < -180 ||
			lng > 180
		) {
			return null;
		}
		return { lat, lng };
	} catch {
		return null;
	}
}

export function useBrowseLocation() {
	const [pinned, setPinned] = useState<DeviceLocation>(null);
	const [ready, setReady] = useState(false);
	const revision = useRef(0);

	useEffect(() => {
		let active = true;
		const initialRevision = revision.current;
		void AsyncStorage.getItem(KEY)
			.then((value) => {
				if (active && revision.current === initialRevision) {
					setPinned(parseBrowseLocation(value));
				}
			})
			.catch(() => {})
			.finally(() => {
				if (active) setReady(true);
			});
		return () => {
			active = false;
		};
	}, []);

	const choosePin = useCallback((coords: NonNullable<DeviceLocation>) => {
		revision.current += 1;
		setPinned(coords);
		void AsyncStorage.setItem(KEY, JSON.stringify(coords)).catch(() => {});
	}, []);

	const chooseCurrent = useCallback(() => {
		revision.current += 1;
		setPinned(null);
		void AsyncStorage.removeItem(KEY).catch(() => {});
	}, []);

	return { pinned, ready, choosePin, chooseCurrent };
}
