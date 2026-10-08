import * as Sentry from "@sentry/react-native";
import { type ReactNode, useEffect, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useColorScheme,
} from "react-native";

import { crashError } from "@/lib/crash-payload";
import { reportCrash } from "@/lib/error-reporting";
import { createStandaloneTranslator } from "@/lib/i18n";

/**
 * The screen a person sees after the app throws, and the only screen in the app that is not
 * inside a single provider.
 *
 * ## Why it has no theme
 *
 * `Sentry.GlobalErrorBoundary` wraps `RootLayout`, so this renders **outside**
 * `ThemeModeProvider`, `I18nProvider` and `SafeAreaProvider`. `useTheme()` throws rather than
 * guess when no scope is above it (`theme/scope.tsx`), and `useT()` throws for the same
 * reason (`lib/i18n.tsx`) — both behaviours are correct and both are fatal here, because this
 * screen's entire job is to render while something is already broken. A fallback UI that
 * throws is a red box on top of the crash.
 *
 * So the colours come from `useColorScheme()` — the one answer that needs no provider and is
 * still right — and the words come from `createStandaloneTranslator()`. The limits of that
 * choice are stated on that function: it reads the device's language and not a stored choice,
 * because there is no provider here to hold the override.
 *
 * ## What it does and does not claim
 *
 * The report goes out from `useEffect` on mount, and `crash.reported` appears **only** if
 * `reportCrash` resolved. A reporter that fails open would otherwise tell a customer whose
 * report was refused — no session, no transport — that we have it. `reportCrash` never throws,
 * so the effect has nothing to catch, but the `void` is deliberate rather than a promise that
 * this cannot reject.
 */
export function CrashScreen({
	error,
	onRetry,
}: {
	error: Error;
	onRetry: () => void;
}) {
	const scheme = useColorScheme();
	const dark = scheme === "dark";
	const { t } = createStandaloneTranslator();
	const [reported, setReported] = useState(false);

	useEffect(() => {
		void reportCrash({
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			title: error.name || "Error",
			message: error.message || String(error),
			stack: error.stack,
			context: {
				// Not the component stack: this boundary wraps `RootLayout`, so
				// `errorInfo` is the *render* stack from `@sentry/react`'s boundary and
				// would repeat what `error.stack` already carries.
				platform: "react-native",
				scheme: dark ? "dark" : "light",
			},
		}).then(setReported);
	}, [error, dark]);

	const ink = dark ? "#F5F5F4" : "#1C1917";
	const muted = dark ? "#A8A29E" : "#57534E";
	const canvas = dark ? "#0C0A09" : "#FAFAF9";
	const line = dark ? "#292524" : "#E7E5E4";

	return (
		<ScrollView
			style={[styles.root, { backgroundColor: canvas }]}
			contentContainerStyle={styles.content}
		>
			<Text style={[styles.title, { color: ink }]}>{t("crash.title")}</Text>
			<Text style={[styles.body, { color: muted }]}>{t("crash.body")}</Text>

			<Pressable
				onPress={onRetry}
				accessibilityRole="button"
				accessibilityLabel={t("crash.retry")}
				style={({ pressed }) => [
					styles.button,
					{ borderColor: line, opacity: pressed ? 0.6 : 1 },
				]}
			>
				<Text style={[styles.buttonLabel, { color: ink }]}>
					{t("crash.retry")}
				</Text>
			</Pressable>

			{/* The trace is shown, not hidden. Someone on a phone reporting "the app crashed"
			    is describing a symptom; the frame that threw is what an operator needs, and it
			    costs three lines to make it copyable. */}
			{reported ? (
				<Text style={[styles.note, { color: muted }]}>
					{t("crash.reported")}
				</Text>
			) : null}

			{error.stack ? (
				<Text
					style={[styles.stack, { color: muted, borderColor: line }]}
					selectable
					numberOfLines={12}
				>
					{error.stack}
				</Text>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: {
		flexGrow: 1,
		justifyContent: "center",
		gap: 16,
		paddingHorizontal: 24,
		paddingVertical: 48,
	},
	title: { fontSize: 22, fontWeight: "600" },
	body: { fontSize: 15, lineHeight: 22 },
	button: {
		alignSelf: "flex-start",
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		paddingHorizontal: 18,
		paddingVertical: 12,
	},
	buttonLabel: { fontSize: 15, fontWeight: "600" },
	note: { fontSize: 13 },
	stack: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 10,
		fontFamily: "monospace",
		fontSize: 11,
		lineHeight: 16,
		padding: 12,
	},
});

/**
 * The boundary itself, re-exported so `app/_layout.tsx` mounts one component rather than
 * composing Sentry's props in the layout.
 *
 * ## The three flags, and each one is a capability
 *
 * - **`includeNonFatalGlobalErrors`** — non-fatal errors through React Native's `ErrorUtils`
 *   global handler: an event handler or a timer that threw. A tap does not crash the app and
 *   nothing is logged about it otherwise, which is the majority of what goes wrong in a
 *   React Native app.
 * - **`includeUnhandledRejections`** — a promise that rejected with nobody handling it. Also a
 *   capability, and also nothing without it.
 * - Neither flag is cosmetic: Sentry *skips React Native's default error handler* when a
 *   subscriber is interested (`hasInterestedSubscribers` in
 *   `@sentry/react-native/dist/js/integrations/globalErrorBus.js`), because that handler tears
 *   down the JS context and would prevent any fallback UI from rendering at all.
 *
 * ## Why this and not a hand-rolled hook on `unhandledrejection`
 *
 * React Native 0.86 ships **no** `unhandledrejection` event and no promise rejection tracker —
 * there is no such module under `Libraries/` — so
 * `globalThis.addEventListener("unhandledrejection", …)` would compile, type-check, look like
 * coverage and never fire.
 *
 * On Hermes the tracker is native and takes a **single** subscriber:
 * `HermesInternal.enablePromiseRejectionTracker({ onUnhandled })`. Registering a second one
 * would take rejections away from `@sentry/react-native`, which registers it during
 * `Sentry.init` — the two would fight over one callback and the last registration would win.
 * So the rejection path goes through `includeUnhandledRejections`, which subscribes to Sentry's
 * own global error bus: one subscriber, no clobbering, and the rejection still reaches Sentry
 * because it is captured there first.
 *
 * `GlobalErrorBoundary` is public API — the SDK's own docblock shows it used this way — while
 * the bus behind it is internal, which is the whole reason this does not import the bus.
 */
export function CrashBoundary({ children }: { children: ReactNode }) {
	return (
		<Sentry.GlobalErrorBoundary
			includeNonFatalGlobalErrors
			includeUnhandledRejections
			fallback={({ error, resetError }) => (
				<CrashScreen error={crashError(error)} onRetry={resetError} />
			)}
		>
			{children}
		</Sentry.GlobalErrorBoundary>
	);
}
