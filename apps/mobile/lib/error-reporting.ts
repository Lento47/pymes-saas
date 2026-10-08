import {
	type CrashCategory,
	type CrashSeverity,
	newRequestId,
	scrubTelemetryPayload,
} from "@pymeshub/shared";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import Constants from "expo-constants";
import { Platform } from "react-native";
import superjson from "superjson";

import { accessToken } from "@/lib/auth/client";
import {
	clipped,
	crashRoute,
	MESSAGE_MAX,
	ROUTE_MAX,
	STACK_MAX,
	TITLE_MAX,
} from "@/lib/crash-payload";
import { env } from "@/lib/env";

/**
 * Where a crash goes.
 *
 * ## Not a port of web's `error-reporting.ts`
 *
 * That one `fetch`es `POST /api/error-reports/client` — a **second** API behind a **second**
 * auth system, writing to a table in a second database. This posts over tRPC, the transport
 * every other request from this phone already uses, which is what "consolidate on the Worker"
 * has to mean if it means anything. `source` is not an input field: `crashReport.report` takes
 * it as its own argument and the router passes `"MOBILE"` (`routers/crash-report.ts`), so a
 * client cannot file a mobile crash as a web one and skew the queue's second question.
 *
 * ## Why its own client rather than `useTRPC()`
 *
 * The boundary that calls `reportCrash` is *outside* `ApiProvider`, and a rejection is caught
 * with no React tree at all. Both need a client that exists without one, so this builds its own
 * — the shape `lib/push-token.ts` already uses for the same reason. It does not import that
 * file's client: a shared *link* would be worth factoring and a shared *client* would not, since
 * these two are the only two callers that must exist outside the tree.
 *
 * ## What is swallowed, and what is not
 *
 * Every failure is swallowed. A reporter that can break the app is worse than no reporter, and
 * this runs while the app is already in trouble. Three things are **not** silent, because each
 * one loses reports and nobody would otherwise know: a phone with no session, a payload the
 * contract would reject, and a transport fault. All three log.
 */
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

/**
 * What the caller knows. `appVersion` and `buildNumber` are **not** here.
 *
 * They come from `Constants` rather than from the caller, and that is the whole point of having
 * them: `nativeBuildVersion` is the real `versionCode` Android installed — 13 on the current
 * build — which is the only thing that answers "did build 13 do this". As parameters, every call
 * site could get them wrong and the one that matters most is the one nobody remembers to fill
 * in. A client-supplied version would be worse than none: an operator matching crashes to a
 * release against a number the client chose is matching against noise.
 */
export type CrashInput = {
	category: CrashCategory;
	severity?: CrashSeverity;
	message: string;
	title?: string;
	stack?: string;
	context?: Record<string, unknown>;
};

/** `0.1.0`, from the manifest. Absent under `expo start`, where there is no native build. */
function appVersion(): string | undefined {
	return typeof Constants.expoVersion === "string" &&
		Constants.expoVersion.length > 0
		? Constants.expoVersion
		: undefined;
}

/**
 * The `versionCode`, as a string.
 *
 * A number in a text column, because the contract's `buildNumber` is `z.string()`. `"13"`
 * filters and groups as itself; the queue's `build` sort therefore orders by `created_at`
 * *within* a build rather than comparing the strings, because `"13" < "9"` lexically.
 */
function buildNumber(): string | undefined {
	const native = Constants.nativeBuildVersion;
	return typeof native === "number" && Number.isFinite(native)
		? String(native)
		: undefined;
}

/**
 * File a crash.
 *
 * Returns whether the Worker accepted it, and **never throws and never rejects.** The return
 * promises nothing beyond that: `components/crash-screen.tsx` draws `crash.reported` only on
 * `true`, so a reporter that fails open cannot put "we have it" in front of somebody whose
 * report was refused.
 *
 * ## A signed-out phone is refused, and that is a real limit
 *
 * `crashReport.report` is `protectedProcedure`, so with no session the Worker answers
 * `UNAUTHORIZED` and no row is written. This was the accepted cost of the old endpoint too —
 * `apps/api/src/error-reports/error-reports.controller.ts:17` puts `JwtAuthGuard` on
 * `POST /api/error-reports/client` — and it is worth stating plainly that moving to the Worker
 * did **not** remove it. It removed a second API and a second auth system. It did not invent
 * anonymous writes into a table an operator works.
 *
 * So the crashes that concentrate on the splash, on role resolution and on session restore — the
 * ones that happen before a token exists — still go unreported. `user_id` being nullable means a
 * report whose session expired *mid-flight* still lands; it does not mean a report with no
 * session lands. Making that true is a separate decision about an anonymous write path, and it
 * is not one this file should quietly invent.
 *
 * A console warning rather than silence, because "no session", "no transport" and "it worked"
 * are otherwise indistinguishable from the outside.
 */
export async function reportCrash(input: CrashInput): Promise<boolean> {
	try {
		const route = crashRoute();
		const version = appVersion();
		const build = buildNumber();

		const payload = scrubTelemetryPayload({
			category: input.category,
			severity: input.severity ?? "ERROR",
			// A blank message is the one field the contract cannot do without, and a crash
			// that reached this far has something to say even if `error.message` was empty.
			message: clipped(
				input.message.trim() || "Crash sin mensaje.",
				MESSAGE_MAX,
			),
			...(input.title ? { title: clipped(input.title, TITLE_MAX) } : {}),
			...(input.stack ? { stack: clipped(input.stack, STACK_MAX) } : {}),
			...(route ? { route: clipped(route, ROUTE_MAX) } : {}),
			...(version ? { appVersion: version } : {}),
			...(build ? { buildNumber: build } : {}),
			...(input.context ? { context: input.context } : {}),
		});

		const token = await accessToken();
		if (!token) {
			console.warn(
				"[pymes] A crash was not reported: there is no session. " +
					"crashReport.report is protectedProcedure, so a signed-out phone is refused.",
			);
			return false;
		}

		await client.crashReport.report.mutate(payload);
		return true;
	} catch (error) {
		// Never surfaced to the reader. The app is already broken; the reporter making it worse
		// is the one outcome this whole file exists to avoid.
		console.warn(
			"[pymes] A crash could not be reported.",
			error instanceof Error ? error.message : error,
		);
		return false;
	}
}
