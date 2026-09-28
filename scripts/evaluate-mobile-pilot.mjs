import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REQUIRED_PLATFORMS = ["android", "ios"];
const REQUIRED_NOTIFICATION_STATES = ["foreground", "background", "terminated"];
const REQUIRED_NOTIFICATION_KINDS = [
	"merchant_new_order",
	"accepted",
	"preparing",
	"ready",
	"out_for_delivery",
	"delivered",
	"rejected",
	"cancelled",
];
const REQUIRED_STOP_REASONS = [
	"delivered",
	"cancelled",
	"reassigned",
	"signed_out",
	"permission_revoked",
];

function list(value) {
	return Array.isArray(value) ? value : [];
}

function count(value) {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function percentage(numerator, denominator) {
	return denominator > 0 ? numerator / denominator : 0;
}

function percent(value) {
	return `${(value * 100).toFixed(2)}%`;
}

function check(id, label, passed, details) {
	return { id, label, passed: Boolean(passed), details };
}

export function evaluateMobilePilot(evidence) {
	const builds = list(evidence?.builds);
	const devices = list(evidence?.devices);
	const runs = list(evidence?.runs);
	const defects = list(evidence?.defects);
	const metrics = evidence?.metrics ?? {};
	const sessions = metrics.sessions ?? {};
	const api = metrics.api ?? {};
	const pushes = list(metrics.pushes);
	const locationSamples = list(metrics.locationSamples);
	const backgroundRuns = list(metrics.backgroundRuns);
	const trackingStops = list(metrics.trackingStops);
	const deletion = evidence?.accountDeletion ?? {};

	const checks = [];
	checks.push(
		check(
			"format",
			"Evidence uses the supported format",
			evidence?.formatVersion === 1 &&
				typeof evidence?.pilotId === "string" &&
				evidence.pilotId.trim().length > 0 &&
				["staging", "production"].includes(evidence?.environment),
			`formatVersion=${String(evidence?.formatVersion)}, pilotId=${evidence?.pilotId || "missing"}, environment=${evidence?.environment ?? "missing"}`,
		),
	);
	const startedAt = Date.parse(evidence?.startedAt ?? "");
	const finishedAt = Date.parse(evidence?.finishedAt ?? "");
	checks.push(
		check(
			"window",
			"Pilot start and finish define a valid metrics window",
			Number.isFinite(startedAt) &&
				Number.isFinite(finishedAt) &&
				finishedAt > startedAt,
			`${evidence?.startedAt || "missing"} → ${evidence?.finishedAt || "missing"}`,
		),
	);

	const buildCommits = new Set(
		builds.map((entry) => entry?.commitSha).filter(Boolean),
	);
	checks.push(
		check(
			"candidate-commit",
			"Both signed builds identify the same candidate commit",
			builds.length >= 2 && buildCommits.size === 1,
			`${buildCommits.size} candidate commit(s) across ${builds.length} build(s)`,
		),
	);

	for (const platform of REQUIRED_PLATFORMS) {
		const platformBuilds = builds.filter(
			(entry) => entry?.platform === platform,
		);
		const platformDevices = devices.filter(
			(entry) => entry?.platform === platform,
		);
		const versions = new Set(
			platformDevices.map((entry) => entry?.osVersion).filter(Boolean),
		);
		checks.push(
			check(
				`build-${platform}`,
				`${platform} signed build is identified`,
				platformBuilds.some(
					(entry) =>
						typeof entry?.buildId === "string" &&
						entry.buildId.length > 0 &&
						entry.signed === true,
				),
				`${platformBuilds.length} build record(s)`,
			),
			check(
				`devices-${platform}`,
				`${platform} is tested on two OS versions`,
				platformDevices.length >= 2 && versions.size >= 2,
				`${platformDevices.length} device(s), ${versions.size} OS version(s)`,
			),
		);
	}

	const androidManufacturers = new Set(
		devices
			.filter((entry) => entry?.platform === "android")
			.map((entry) => entry?.manufacturer)
			.filter(Boolean),
	);
	checks.push(
		check(
			"android-manufacturers",
			"Android coverage includes two manufacturers",
			androidManufacturers.size >= 2,
			`${androidManufacturers.size} manufacturer(s)`,
		),
	);

	const successfulRuns = runs.filter(
		(entry) => entry?.status === "completed" && entry?.manualRepair !== true,
	);
	const orderIds = runs.map((entry) => entry?.orderId).filter(Boolean);
	checks.push(
		check(
			"orders",
			"At least 20 consecutive orders complete without manual repair",
			runs.length >= 20 && successfulRuns.length === runs.length,
			`${successfulRuns.length}/${runs.length} completed cleanly`,
		),
		check(
			"unique-orders",
			"Every acceptance run identifies a different real order",
			orderIds.length === runs.length && new Set(orderIds).size === runs.length,
			`${new Set(orderIds).size}/${runs.length} unique order id(s)`,
		),
	);
	for (const paymentMethod of ["CASH", "SINPE"]) {
		const samples = runs.filter(
			(entry) => entry?.paymentMethod === paymentMethod,
		);
		checks.push(
			check(
				`payment-${paymentMethod.toLowerCase()}`,
				`${paymentMethod} is exercised in the acceptance orders`,
				samples.length > 0,
				`${samples.length} order(s)`,
			),
		);
	}
	for (const network of ["wifi", "cellular", "switched"]) {
		const samples = runs.filter((entry) => entry?.network === network);
		checks.push(
			check(
				`network-${network}`,
				`${network} network behavior is exercised`,
				samples.length > 0,
				`${samples.length} order(s)`,
			),
		);
	}
	const ratingRuns = runs.filter(
		(entry) =>
			entry?.customerRatingSubmitted === true &&
			entry?.courierRatingSubmitted === true,
	);
	checks.push(
		check(
			"ratings",
			"Customer and courier rating flows complete on every acceptance order",
			runs.length > 0 && ratingRuns.length === runs.length,
			`${ratingRuns.length}/${runs.length} order(s) include both ratings`,
		),
	);

	const openSevereDefects = defects.filter(
		(entry) =>
			["critical", "high"].includes(entry?.severity) &&
			entry?.status !== "resolved",
	);
	checks.push(
		check(
			"defects",
			"No unresolved critical or high-severity defects remain",
			openSevereDefects.length === 0,
			`${openSevereDefects.length} unresolved severe defect(s)`,
		),
	);

	const totalSessions = count(sessions.total);
	const crashedSessions = count(sessions.crashed);
	const crashFreeRate = percentage(
		totalSessions - crashedSessions,
		totalSessions,
	);
	checks.push(
		check(
			"crash-free",
			"Crash-free sessions are at least 99%",
			totalSessions > 0 && crashFreeRate >= 0.99,
			`${percent(crashFreeRate)} across ${totalSessions} session(s)`,
		),
	);

	const apiRequests = count(api.requests);
	const apiServerErrors = count(api.serverErrors);
	const apiErrorRate = percentage(apiServerErrors, apiRequests);
	checks.push(
		check(
			"api-errors",
			"API 5xx rate is below 1%",
			apiRequests > 0 && apiErrorRate < 0.01,
			`${percent(apiErrorRate)} (${apiServerErrors}/${apiRequests})`,
		),
	);

	const successfulPushes = pushes.filter(
		(entry) =>
			entry?.ticketStatus === "ok" &&
			entry?.receiptStatus === "ok" &&
			entry?.deepLinkOpened === true,
	);
	const pushSuccessRate = percentage(successfulPushes.length, pushes.length);
	checks.push(
		check(
			"push-success",
			"At least 95% of sampled pushes deliver and open the correct screen",
			pushes.length > 0 && pushSuccessRate >= 0.95,
			`${percent(pushSuccessRate)} (${successfulPushes.length}/${pushes.length})`,
		),
	);
	for (const appState of REQUIRED_NOTIFICATION_STATES) {
		const statePushes = pushes.filter((entry) => entry?.appState === appState);
		checks.push(
			check(
				`push-${appState}`,
				`Push deep links are sampled while the app is ${appState}`,
				statePushes.some(
					(entry) =>
						entry?.ticketStatus === "ok" &&
						entry?.receiptStatus === "ok" &&
						entry?.deepLinkOpened === true,
				),
				`${statePushes.length} sample(s)`,
			),
		);
	}
	for (const kind of REQUIRED_NOTIFICATION_KINDS) {
		const kindPushes = pushes.filter((entry) => entry?.kind === kind);
		checks.push(
			check(
				`push-kind-${kind}`,
				`${kind} notification is delivered and deep-linked`,
				kindPushes.some(
					(entry) =>
						entry?.ticketStatus === "ok" &&
						entry?.receiptStatus === "ok" &&
						entry?.deepLinkOpened === true,
				),
				`${kindPushes.length} sample(s)`,
			),
		);
	}

	const freshLocations = locationSamples.filter(
		(entry) =>
			Number.isFinite(entry?.ageSeconds) &&
			entry.ageSeconds >= 0 &&
			entry.ageSeconds < 120,
	);
	const locationFreshnessRate = percentage(
		freshLocations.length,
		locationSamples.length,
	);
	checks.push(
		check(
			"location-freshness",
			"At least 95% of active-delivery locations are under two minutes old",
			locationSamples.length >= 20 && locationFreshnessRate >= 0.95,
			`${percent(locationFreshnessRate)} (${freshLocations.length}/${locationSamples.length})`,
		),
	);

	for (const platform of REQUIRED_PLATFORMS) {
		const platformRuns = backgroundRuns.filter(
			(entry) => entry?.platform === platform,
		);
		const passed = platformRuns.some(
			(entry) =>
				count(entry?.screenLockedMinutes) >= 15 &&
				entry?.continued === true &&
				(platform !== "android" || entry?.persistentNotification === true),
		);
		checks.push(
			check(
				`background-${platform}`,
				`${platform} tracking survives a 15-minute screen lock`,
				passed,
				`${platformRuns.length} background run(s)`,
			),
		);
	}

	for (const reason of REQUIRED_STOP_REASONS) {
		const samples = trackingStops.filter((entry) => entry?.reason === reason);
		checks.push(
			check(
				`tracking-stop-${reason}`,
				`Tracking stops within one minute after ${reason}`,
				samples.some(
					(entry) =>
						Number.isFinite(entry?.latencySeconds) &&
						entry.latencySeconds >= 0 &&
						entry.latencySeconds <= 60,
				),
				`${samples.length} sample(s)`,
			),
		);
	}

	const deletionAssertions = [
		"initiated",
		"statusVisible",
		"cancelled",
		"reRequested",
		"executed",
		"authenticationDeleted",
		"profileDeleted",
		"addressesDeleted",
		"deviceTokensDeleted",
		"locationDeleted",
		"retainedRecordsAnonymized",
	];
	const missingDeletionAssertions = deletionAssertions.filter(
		(key) => deletion?.[key] !== true,
	);
	checks.push(
		check(
			"account-deletion",
			"Account deletion lifecycle and anonymization are verified",
			missingDeletionAssertions.length === 0,
			missingDeletionAssertions.length > 0
				? `Missing: ${missingDeletionAssertions.join(", ")}`
				: "All deletion assertions recorded",
		),
	);

	return {
		passed: checks.every((entry) => entry.passed),
		checks,
		summary: {
			runs: runs.length,
			crashFreeRate,
			apiErrorRate,
			pushSuccessRate,
			locationFreshnessRate,
		},
	};
}

export function renderMobilePilotReport(evidence, result) {
	const lines = [
		`# Mobile pilot decision: ${result.passed ? "PASS" : "FAIL"}`,
		"",
		`- Pilot: ${evidence?.pilotId ?? "unknown"}`,
		`- Environment: ${evidence?.environment ?? "unknown"}`,
		`- Orders evaluated: ${result.summary.runs}`,
		`- Crash-free sessions: ${percent(result.summary.crashFreeRate)}`,
		`- API 5xx rate: ${percent(result.summary.apiErrorRate)}`,
		`- Push success: ${percent(result.summary.pushSuccessRate)}`,
		`- Fresh locations: ${percent(result.summary.locationFreshnessRate)}`,
		"",
		"## Gates",
		"",
		...result.checks.map(
			(entry) =>
				`- [${entry.passed ? "x" : " "}] ${entry.label} — ${entry.details}`,
		),
		"",
	];
	return lines.join("\n");
}

function usage() {
	return "Usage: node scripts/evaluate-mobile-pilot.mjs <evidence.json> [--output <report.md>]";
}

function runCli() {
	const args = process.argv.slice(2);
	const evidencePath = args[0];
	if (!evidencePath) {
		console.error(usage());
		process.exitCode = 2;
		return;
	}

	const outputIndex = args.indexOf("--output");
	const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
	if (outputIndex >= 0 && !outputPath) {
		console.error(usage());
		process.exitCode = 2;
		return;
	}

	let evidence;
	try {
		evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
	} catch (error) {
		console.error(`Could not read pilot evidence: ${error.message}`);
		process.exitCode = 2;
		return;
	}

	const result = evaluateMobilePilot(evidence);
	const report = renderMobilePilotReport(evidence, result);
	if (outputPath) writeFileSync(outputPath, report, "utf8");
	else console.log(report);
	process.exitCode = result.passed ? 0 : 1;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runCli();
}
