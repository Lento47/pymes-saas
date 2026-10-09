import { newRequestId } from "@pymeshub/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import superjson from "superjson";

import { accessToken } from "@/lib/auth/client";
import { env } from "@/lib/env";

export const COURIER_LOCATION_TASK = "pymeshub-active-delivery-location";

const SESSION_KEY = "pymeshub:courier-location:session";
const PENDING_KEY = "pymeshub:courier-location:pending";
const MOVING_INTERVAL_MS = 15_000;
const WALKING_INTERVAL_MS = 30_000;
const STILL_INTERVAL_MS = 60_000;

type TrackingSession = {
	orderId: string;
	userId: string;
	lastSentAt: number;
};

type LocationPayload = {
	orderId: string;
	lat: number;
	lng: number;
	recordedAt: Date;
	accuracy?: number;
	heading?: number;
	speed?: number;
};

type LocationTaskData = { locations?: Location.LocationObject[] };

export type StartTrackingResult =
	| "started"
	| "foreground-denied"
	| "background-denied"
	| "unavailable"
	| "failed";

const client = createTRPCClient<AppRouter>({
	links: [
		httpLink({
			url: `${env.apiUrl}/trpc`,
			transformer: superjson,
			headers: async () => {
				const token = await accessToken();
				return {
					"x-request-id": newRequestId(),
					"x-client": Platform.OS === "ios" ? "ios" : "android",
					...(token ? { authorization: `Bearer ${token}` } : {}),
				};
			},
		}),
	],
});

function readSession(): Promise<TrackingSession | null> {
	return AsyncStorage.getItem(SESSION_KEY).then((value) => {
		if (!value) return null;
		try {
			const parsed = JSON.parse(value) as Partial<TrackingSession>;
			if (
				typeof parsed.orderId !== "string" ||
				typeof parsed.userId !== "string" ||
				typeof parsed.lastSentAt !== "number"
			)
				return null;
			return parsed as TrackingSession;
		} catch {
			return null;
		}
	});
}

function intervalFor(speed: number | null): number {
	if (speed !== null && speed >= 2) return MOVING_INTERVAL_MS;
	if (speed !== null && speed >= 0.5) return WALKING_INTERVAL_MS;
	return STILL_INTERVAL_MS;
}

function payloadOf(
	orderId: string,
	position: Location.LocationObject,
): LocationPayload {
	const optional = (value: number | null, min: number, max: number) =>
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= min &&
		value <= max
			? value
			: undefined;
	return {
		orderId,
		lat: position.coords.latitude,
		lng: position.coords.longitude,
		recordedAt: new Date(position.timestamp),
		accuracy: optional(position.coords.accuracy, 0, 10_000),
		heading: optional(position.coords.heading, 0, 360),
		speed: optional(position.coords.speed, 0, 150),
	};
}

async function stopNativeTask(): Promise<void> {
	if (Platform.OS === "web") return;
	try {
		if (await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK)) {
			await Location.stopLocationUpdatesAsync(COURIER_LOCATION_TASK);
		}
	} catch {
		// State is already cleared by the caller. A platform stop failure cannot
		// authorize the next callback to send anything.
	}
}

function sendInitialFix(): void {
	// A stationary courier may not cross the native task's distance threshold.
	// Send a recent fix immediately, then let background updates take over.
	void Location.getLastKnownPositionAsync({
		maxAge: 60_000,
		requiredAccuracy: 200,
	})
		.then((position) =>
			position
				? deliver(position)
				: Location.getCurrentPositionAsync({
						accuracy: Location.Accuracy.Balanced,
					}).then(deliver),
		)
		.catch(() => {
			// The native task remains active and can send its first later fix.
		});
}

/** Stop first in storage, then on the OS, so a racing callback becomes a no-op. */
export async function stopCourierTracking(): Promise<void> {
	await AsyncStorage.multiRemove([SESSION_KEY, PENDING_KEY]);
	await stopNativeTask();
}

/**
 * Start the native task only for the assigned run the courier just began.
 * The caller shows the product disclosure before invoking this function.
 */
export async function startCourierTracking(
	orderId: string,
	userId: string,
): Promise<StartTrackingResult> {
	if (Platform.OS === "web" || !(await TaskManager.isAvailableAsync()))
		return "unavailable";

	try {
		let foreground = await Location.getForegroundPermissionsAsync();
		if (!foreground.granted)
			foreground = await Location.requestForegroundPermissionsAsync();
		if (!foreground.granted) return "foreground-denied";

		let background = await Location.getBackgroundPermissionsAsync();
		if (!background.granted)
			background = await Location.requestBackgroundPermissionsAsync();
		if (!background.granted) return "background-denied";

		await stopCourierTracking();
		await AsyncStorage.setItem(
			SESSION_KEY,
			JSON.stringify({
				orderId,
				userId,
				lastSentAt: 0,
			} satisfies TrackingSession),
		);

		try {
			await Location.startLocationUpdatesAsync(COURIER_LOCATION_TASK, {
				accuracy: Location.Accuracy.Balanced,
				timeInterval: MOVING_INTERVAL_MS,
				distanceInterval: 10,
				deferredUpdatesInterval: MOVING_INTERVAL_MS,
				deferredUpdatesDistance: 10,
				activityType: Location.ActivityType.OtherNavigation,
				pausesUpdatesAutomatically: false,
				showsBackgroundLocationIndicator: true,
				foregroundService: {
					notificationTitle: "Entrega activa",
					notificationBody:
						"PymesHub comparte tu ubicación durante esta entrega.",
					notificationColor: "#F59E0B",
					killServiceOnDestroy: false,
				},
			});
		} catch (error) {
			await stopCourierTracking();
			throw error;
		}
		sendInitialFix();
		return "started";
	} catch {
		return "failed";
	}
}

/** Restore an active run after a process restart, and stop a run that is no longer active. */
export async function reconcileCourierTracking(
	activeOrderId: string | undefined,
	userId: string,
): Promise<StartTrackingResult | null> {
	const session = await readSession();
	if (!activeOrderId) {
		if (session) await stopCourierTracking();
		return null;
	}
	if (session?.orderId === activeOrderId && session.userId === userId) {
		try {
			if (
				await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK)
			) {
				if (session.lastSentAt === 0) sendInitialFix();
				return "started";
			}
		} catch {
			// A native task can disappear after an OS restart. Start it again below.
		}
	}
	if (session) await stopCourierTracking();
	return startCourierTracking(activeOrderId, userId);
}

/** Stop if the user revoked either grant while the app was away. */
export async function reconcileTrackingPermissions(): Promise<void> {
	const session = await readSession();
	if (!session || Platform.OS === "web") return;
	const [foreground, background] = await Promise.all([
		Location.getForegroundPermissionsAsync(),
		Location.getBackgroundPermissionsAsync(),
	]);
	if (!foreground.granted || !background.granted) await stopCourierTracking();
}

async function deliver(position: Location.LocationObject): Promise<void> {
	const session = await readSession();
	if (!session) return;

	const interval = intervalFor(position.coords.speed);
	if (position.timestamp - session.lastSentAt < interval) return;

	const payload = payloadOf(session.orderId, position);
	await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));

	try {
		await client.orders.reportLocation.mutate(payload);
		await AsyncStorage.multiSet([
			[
				SESSION_KEY,
				JSON.stringify({
					...session,
					lastSentAt: position.timestamp,
				} satisfies TrackingSession),
			],
		]);
		await AsyncStorage.removeItem(PENDING_KEY);
	} catch (error) {
		if (error instanceof TRPCClientError) {
			const code = (error.data as { code?: unknown } | undefined)?.code;
			// These are terminal for this device/order pair. Network failures and
			// rate limits retain the newest fix for the next native callback.
			if (
				code === "NOT_FOUND" ||
				code === "BAD_REQUEST" ||
				code === "UNAUTHORIZED"
			)
				await stopCourierTracking();
		}
	}
}

if (
	Platform.OS !== "web" &&
	!TaskManager.isTaskDefined(COURIER_LOCATION_TASK)
) {
	TaskManager.defineTask<LocationTaskData>(
		COURIER_LOCATION_TASK,
		async ({ data, error }) => {
			if (error || !data?.locations?.length) return;
			const latest = data.locations.reduce((best, location) =>
				location.timestamp > best.timestamp ? location : best,
			);
			await deliver(latest);
		},
	);
}
