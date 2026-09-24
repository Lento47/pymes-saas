import type { FulfilmentKind } from "@pymeshub/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The device's own answers: haptics and the fulfilment checkout starts on.
 *
 * Neither is a fact the marketplace keeps about the person — a haptic setting
 * is a property of the phone, and the fulfilment default is which of two
 * closed options this checkout opens on — so both live in `AsyncStorage`
 * beside the locale (`lib/i18n.tsx`) rather than in D1 behind a procedure.
 * There is no `devicePrefs` procedure on the API for the same reason there is
 * no `recentSearches` one (`lib/recent-searches.ts`): storage outlives the
 * code that wrote it, and a server row would make a second truth.
 *
 * Reads never throw and always answer with something usable: `true` and
 * `"PICKUP"`, the values a fresh install behaves as. An in-memory copy feeds
 * the synchronous readers (`lib/haptics.ts` cannot await inside a press), and
 * `initDevicePrefs()` refreshes it — called once from the root layout and
 * again wherever a screen writes, so a write is never followed by a stale
 * read in the same session.
 */

/**
 * Which profile the account screen opens on.
 *
 * The same kind of answer as the other two, and stored here for the same reason: it is how
 * this device draws itself, not a fact the marketplace keeps about the person. An owner who
 * switched to their shop and found the customer hub again on the next visit would have a
 * control that forgets, which is not a switch.
 */
export type AccountProfile = "customer" | "business" | "delivery";

const HAPTICS_KEY = "pymeshub_haptics_enabled";
const FULFILMENT_KEY = "pymeshub_default_fulfilment";
const PROFILE_KEY = "pymeshub_account_profile";

let hapticsEnabled = true;
let defaultFulfilment: FulfilmentKind = "PICKUP";
let accountProfile: AccountProfile = "customer";

async function readBool(key: string, fallback: boolean): Promise<boolean> {
	try {
		const raw = await AsyncStorage.getItem(key);
		if (raw === "1") return true;
		if (raw === "0") return false;
		return fallback;
	} catch {
		return fallback;
	}
}

async function writeBool(key: string, value: boolean): Promise<void> {
	try {
		await AsyncStorage.setItem(key, value ? "1" : "0");
	} catch {
		// No storage, no preference kept. The in-memory copy below still holds
		// for this session, which is the honest half of the answer.
	}
}

/** Refresh the in-memory copy from storage. Safe to call often. */
export async function initDevicePrefs(): Promise<void> {
	const [haptics, fulfilment, profile] = await Promise.all([
		readBool(HAPTICS_KEY, true),
		(async (): Promise<FulfilmentKind> => {
			try {
				const raw = await AsyncStorage.getItem(FULFILMENT_KEY);
				return raw === "DELIVERY" ? "DELIVERY" : "PICKUP";
			} catch {
				return "PICKUP";
			}
		})(),
		(async (): Promise<AccountProfile> => {
			try {
				const raw = await AsyncStorage.getItem(PROFILE_KEY);
				return raw === "business" || raw === "delivery" ? raw : "customer";
			} catch {
				return "customer";
			}
		})(),
	]);
	hapticsEnabled = haptics;
	defaultFulfilment = fulfilment;
	accountProfile = profile;
}

/** What `lib/haptics.ts` gates every buzz on. */
export function areHapticsEnabled(): boolean {
	return hapticsEnabled;
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
	hapticsEnabled = value;
	await writeBool(HAPTICS_KEY, value);
}

/** What checkout opens on. `"PICKUP"` until the customer says otherwise. */
export function getDefaultFulfilment(): FulfilmentKind {
	return defaultFulfilment;
}

export async function setDefaultFulfilment(
	value: FulfilmentKind,
): Promise<void> {
	defaultFulfilment = value;
	try {
		await AsyncStorage.setItem(FULFILMENT_KEY, value);
	} catch {
		// Same as above: the session keeps the choice, storage keeps nothing.
	}
}

/** Which profile `app/account.tsx` draws. `"customer"` until the person says otherwise. */
export function getAccountProfile(): AccountProfile {
	return accountProfile;
}

export async function setAccountProfile(value: AccountProfile): Promise<void> {
	accountProfile = value;
	try {
		await AsyncStorage.setItem(PROFILE_KEY, value);
	} catch {
		// Same as above: the session keeps the choice, storage keeps nothing.
	}
}
