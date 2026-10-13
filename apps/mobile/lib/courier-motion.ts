/**
 * Courier MOTION UI — numbers and state, without React.
 *
 * The screens draw from these so a remount cannot invent a countdown, an ETA, or a
 * headline the server did not earn.
 */

import type { DeliveryAction, DeliveryStatus } from "@pymeshub/shared";

export function remainingOfferMs(
	expiresAt: Date | string | number,
	now: number,
): number {
	const end = new Date(expiresAt).getTime();
	if (!Number.isFinite(end)) return 0;
	return Math.max(0, end - now);
}

/** `1:42` from remaining milliseconds. Driven by `expiresAt`, never a local timer origin. */
export function formatOfferCountdown(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function etaMinutes(
	durationSeconds: number | null | undefined,
): number | null {
	if (
		durationSeconds == null ||
		!Number.isFinite(durationSeconds) ||
		durationSeconds < 0
	)
		return null;
	return Math.max(1, Math.round(durationSeconds / 60));
}

export function kmFromMeters(meters: number | null | undefined): number | null {
	if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
	return meters / 1000;
}

export function actionFor(status: DeliveryStatus): DeliveryAction | null {
	if (status === "ACCEPTED") return "START_TO_PICKUP";
	if (status === "TO_PICKUP") return "ARRIVE_PICKUP";
	if (status === "AT_PICKUP") return "CONFIRM_PICKUP";
	if (status === "PICKED_UP") return "COMPLETE";
	return null;
}

export type CourierHeadlineKind = "pickup" | "dropoff" | "done" | "cancelled";

export function headlineKind(status: DeliveryStatus): CourierHeadlineKind {
	if (status === "CANCELLED") return "cancelled";
	if (status === "DELIVERED") return "done";
	if (status === "PICKED_UP") return "dropoff";
	return "pickup";
}

export function currentStop(
	status: DeliveryStatus,
): "pickup" | "dropoff" | null {
	if (status === "DELIVERED" || status === "CANCELLED") return null;
	if (status === "PICKED_UP") return "dropoff";
	return "pickup";
}

export const SLIDER_COMPLETE_RATIO = 0.85;
