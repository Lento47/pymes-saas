import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMobilePilot } from "./evaluate-mobile-pilot.mjs";

function passingEvidence() {
	const notificationKinds = [
		"merchant_new_order",
		"accepted",
		"preparing",
		"ready",
		"out_for_delivery",
		"delivered",
		"rejected",
		"cancelled",
	];
	const devices = [
		{
			id: "android-one",
			platform: "android",
			manufacturer: "Google",
			osVersion: "15",
		},
		{
			id: "android-two",
			platform: "android",
			manufacturer: "Samsung",
			osVersion: "16",
		},
		{ id: "ios-one", platform: "ios", manufacturer: "Apple", osVersion: "18" },
		{ id: "ios-two", platform: "ios", manufacturer: "Apple", osVersion: "19" },
	];
	const pushes = ["foreground", "background", "terminated"].flatMap(
		(appState) =>
			Array.from({ length: 10 }, (_, index) => ({
				id: `${appState}-${index}`,
				appState,
				kind: notificationKinds[index % notificationKinds.length],
				ticketStatus: "ok",
				receiptStatus: "ok",
				deepLinkOpened: true,
			})),
	);

	return {
		formatVersion: 1,
		pilotId: "pilot-2026-09",
		environment: "staging",
		startedAt: "2026-09-27T12:00:00.000Z",
		finishedAt: "2026-09-29T12:00:00.000Z",
		builds: [
			{
				platform: "android",
				buildId: "android-build",
				commitSha: "candidate-sha",
				signed: true,
			},
			{
				platform: "ios",
				buildId: "ios-build",
				commitSha: "candidate-sha",
				signed: true,
			},
		],
		devices,
		runs: Array.from({ length: 20 }, (_, index) => ({
			id: `run-${index + 1}`,
			orderId: `order-${index + 1}`,
			status: "completed",
			manualRepair: false,
			paymentMethod: index % 2 === 0 ? "CASH" : "SINPE",
			network: index === 0 ? "switched" : index % 2 === 0 ? "wifi" : "cellular",
			customerRatingSubmitted: true,
			courierRatingSubmitted: true,
		})),
		defects: [{ id: "fixed-1", severity: "high", status: "resolved" }],
		metrics: {
			sessions: { total: 200, crashed: 1 },
			api: { requests: 1_000, serverErrors: 5 },
			pushes,
			locationSamples: Array.from({ length: 20 }, (_, index) => ({
				id: `location-${index}`,
				ageSeconds: 30,
			})),
			backgroundRuns: [
				{
					platform: "android",
					screenLockedMinutes: 15,
					continued: true,
					persistentNotification: true,
				},
				{
					platform: "ios",
					screenLockedMinutes: 15,
					continued: true,
				},
			],
			trackingStops: [
				"delivered",
				"cancelled",
				"reassigned",
				"signed_out",
				"permission_revoked",
			].map((reason) => ({ reason, latencySeconds: 30 })),
		},
		accountDeletion: {
			initiated: true,
			statusVisible: true,
			cancelled: true,
			reRequested: true,
			executed: true,
			authenticationDeleted: true,
			profileDeleted: true,
			addressesDeleted: true,
			deviceTokensDeleted: true,
			locationDeleted: true,
			retainedRecordsAnonymized: true,
		},
	};
}

test("passes a complete field-pilot evidence package", () => {
	const result = evaluateMobilePilot(passingEvidence());
	assert.equal(result.passed, true);
	assert.deepEqual(
		result.checks.filter((entry) => !entry.passed),
		[],
	);
});

test("fails when a delivery needs repair or location becomes stale", () => {
	const evidence = passingEvidence();
	evidence.runs[7].manualRepair = true;
	evidence.metrics.locationSamples[0].ageSeconds = 180;
	evidence.metrics.locationSamples[1].ageSeconds = 180;

	const result = evaluateMobilePilot(evidence);
	assert.equal(result.passed, false);
	assert.equal(
		result.checks.find((entry) => entry.id === "orders")?.passed,
		false,
	);
	assert.equal(
		result.checks.find((entry) => entry.id === "location-freshness")?.passed,
		false,
	);
});

test("fails if a required stop condition is not observed", () => {
	const evidence = passingEvidence();
	evidence.metrics.trackingStops = evidence.metrics.trackingStops.filter(
		(entry) => entry.reason !== "permission_revoked",
	);

	const result = evaluateMobilePilot(evidence);
	assert.equal(result.passed, false);
	assert.equal(
		result.checks.find(
			(entry) => entry.id === "tracking-stop-permission_revoked",
		)?.passed,
		false,
	);
});

test("rejects incomplete pilot metadata", () => {
	const evidence = passingEvidence();
	evidence.pilotId = "";
	evidence.environment = "development";

	const result = evaluateMobilePilot(evidence);
	assert.equal(result.passed, false);
	assert.equal(
		result.checks.find((entry) => entry.id === "format")?.passed,
		false,
	);
});
