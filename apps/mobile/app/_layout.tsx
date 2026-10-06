import { scrubTelemetryPayload } from "@pymeshub/shared";
import * as Sentry from "@sentry/react-native";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RollbackProvider } from "@/components/rollback-surface";
import { ToastProvider } from "@/components/toast";
import { WelcomeAnimation } from "@/components/welcome-animation";
import { SessionProvider, useSession } from "@/lib/auth/session";
import { initDevicePrefs } from "@/lib/device-prefs";
import { env } from "@/lib/env";
import { I18nProvider } from "@/lib/i18n";
import { PurchaseAccentProvider } from "@/lib/purchase-accent";
import { PushNotificationsProvider } from "@/lib/push-notifications";
import { useResolvedRole } from "@/lib/role";
import { takeSignOutNavigation } from "@/lib/sign-out-intent";
import { ApiProvider } from "@/lib/trpc/provider";
import {
	BusinessThemeProvider,
	selectTree,
	ThemeModeProvider,
	ThemeScopeProvider,
	ThemeTransitionProvider,
	useTheme,
	useThemeScope,
} from "@/theme";

Sentry.init({
	dsn: env.sentryDsn,
	enabled: Boolean(env.sentryDsn),
	environment: __DEV__ ? "development" : "production",
	release: `pymeshub-mobile@${process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0"}`,
	tracesSampleRate: __DEV__ ? 0 : 0.05,
	beforeSend: (event) => scrubTelemetryPayload(event),
	beforeBreadcrumb: (breadcrumb) => scrubTelemetryPayload(breadcrumb),
});

/**
 * The app's frame: the providers, in the order they depend on each other, and the stack.
 *
 * The order is not cosmetic. `ThemeModeProvider` is outermost because `useTheme()` is read by
 * every provider below it and every screen inside it, and it depends on nothing but storage
 * and `useColorScheme()`; `ApiProvider` reads `useSession()` for its `refresh()`, so it has to
 * be inside `SessionProvider`; and a screen's first sentence comes from a dictionary that has
 * to exist before anything renders, so `I18nProvider` is the first thing inside the theme.
 * Getting this backwards is an immediate crash rather than a subtle bug, which is the good
 * kind of ordering constraint — but it only stays right if the reason is written down.
 *
 * The stack is home plus everything pushed over it: a store, a product, the cart, an
 * order, the orders list, the account. Those push over home rather than replacing it,
 * which is what makes the back gesture mean "back to where I was" instead of
 * dropping the reader at a tab bar that no longer exists.
 *
 * `ToastProvider` is the one addition, and its position is load-bearing in a way the other
 * three are not. It goes *inside* `SafeAreaProvider` because the single toast it draws is
 * offset from the bottom edge by the home-indicator inset (see
 * `components/toast.tsx`), and it goes *around* `ThemedStack` because a confirmation of a
 * write is a surface over the app rather than a row in a screen: inside the navigator it would
 * be clipped by the screen that showed it and drawn under the floating order controls. It resolves
 * `useToast()` on every route, `(auth)` included, and it depends on none of the three
 * providers above it — the order there is unchanged.
 */
function RootLayout() {
	return (
		/**
		 * Outermost, and not provided for us: `expo-router`'s own root renders no gesture
		 * root, so without this every `GestureDetector` in the app builds and then never
		 * receives a touch — `components/sheet.tsx` would open at its snap point and refuse to
		 * be dragged, with no error anywhere. `flex: 1` because this is now the outermost view
		 * and a root with no height collapses the whole app to nothing.
		 *
		 * It sits outside the providers rather than inside `SafeAreaProvider`: a gesture
		 * handler is not a consumer of any of them, and keeping it first means a sheet opened
		 * from any screen is inside it by construction.
		 */
		<GestureHandlerRootView style={{ flex: 1 }}>
			{/* Outermost of the four, and the only one with no dependency of its own: it reads
			    a stored preference and the OS setting, and it is read by `useTheme()`, which
			    every provider below it and every screen inside it calls. Above `I18nProvider`
			    rather than beside it because `ToastProvider` and `ThemedStack` both draw in the
			    palette, so the provider has to be outside the whole tree that does. */}
			<ThemeModeProvider>
				<I18nProvider>
					<SessionProvider>
						<ApiProvider>
							{/* The role, published once, and the reason it sits here and not
							    beside `ThemeModeProvider` above: it needs `useSession()` and
							    `useTRPC()`, so it has to be inside both — and `ApiProvider` is
							    what supplies the query client. It has to be *above*
							    `SafeAreaProvider`, `RollbackProvider`, `ToastProvider`,
							    `ThemedStack` and `WelcomeAnimation`, because those and every
							    screen under them are the only things that read `useTheme()`,
							    and `theme/scope.tsx` throws rather than guess when no
							    provider is above it. */}
							{/* Which merchant palette, and a sibling of `ThemeScopeProvider`
							    rather than a child of it. Both answer a question `useTheme()` asks,
							    both throw rather than guess when no provider is above them, and
							    neither needs the other: this one reads `AsyncStorage` alone, so
							    nesting it inside would make the theme wait on a session it has no
							    stake in.

							    It sits here — above `SafeAreaProvider`, `ToastProvider`,
							    `ThemedStack` and every screen beneath — because `useTheme()` reads it,
							    and the merchant tree is roughly sixty components drawing from the
							    palette it hands back. Mounted lower, those components would be
							    drawing from a theme nothing above them could see. */}
							<BusinessThemeProvider>
								{/* Between `BusinessThemeProvider` and everything that draws.
										    It reads the theme through `useBusinessTheme()`, so it has to be
										    inside the provider above; and `useTheme()` reads the colours *from*
										    it, so it has to be outside every screen and every provider that
										    draws. That is exactly the gap between the two.

										    This is the whole colour transition: the palette is interpolated here,
										    once, so the ~60 components that call `useTheme()` and the ~310
										    reads of `colors.*` behind them all glide with no call site edited.
										    See `theme/transition.tsx`. */}
								<ThemeTransitionProvider>
									<ThemeScopeProvider>
										<PushNotificationsProvider>
											<SafeAreaProvider>
												{/* A sibling of `ToastProvider`, and inside `SafeAreaProvider` for the top
												    inset it offsets by. It draws a *refused* write (`components/rollback-surface`),
												    which is the half `ToastProvider` deliberately cannot carry — a
												    confirmation floats where the tap happened, a refusal is a correction
												    that has to be noticed — so the two are separate surfaces rather than
												    one with a severity, and they hold different corners of the screen. */}
												<PurchaseAccentProvider>
													{/*
													 * The purchase band follows the order across the whole app, so this sits at the
													 * root rather than in `(customer)/_layout.tsx` where it was. A customer with a
													 * parcel in transit reaches `/settings`, `/account`, `/profile` and `/inbox` as much
													 * as the feed - and those are root routes, so under the group they resolved no
													 * stage at all and drew no band.
													 *
													 * Inside `ApiProvider` (it reads `useTRPC()`) and `SessionProvider` (it reads
													 * `useSession()` to decide whether to query at all), and inside `SafeAreaProvider`
													 * rather than outside it because it draws nothing itself.
													 *
													 * Safe to mount over all four trees: `lib/purchase-state.ts`'s `isPurchaseRoute`
													 * excludes the `(auth)`, `(business)` and `(delivery)` routes by name, so a
													 * merchant console or a courier screen resolves to no stage and the provider costs
													 * them a query cache entry and nothing else.
													 */}
													<RollbackProvider>
														<ToastProvider>
															<SignOutGate />
															<ThemedStack />
															<WelcomeAnimation />
														</ToastProvider>
													</RollbackProvider>
												</PurchaseAccentProvider>
											</SafeAreaProvider>
										</PushNotificationsProvider>
									</ThemeScopeProvider>
								</ThemeTransitionProvider>
							</BusinessThemeProvider>
						</ApiProvider>
					</SessionProvider>
				</I18nProvider>
			</ThemeModeProvider>
		</GestureHandlerRootView>
	);
}

export default Sentry.wrap(RootLayout);

/**
 * Where a reader goes when they sign out, and the only place in the app that decides it.
 *
 * ## Why this is above the navigator and not in the screen
 *
 * A sign-out is the one auth transition that **destroys the screen which started it**, and
 * that is what makes it different from a sign-in. `lib/role.ts`'s signed-out branch answers
 * `customer`, the `Stack.Protected` guards below read that answer, and the tree the reader was
 * standing in is unmounted in the same commit. So the merchant's account screen cannot be the
 * thing that navigates: by the time it could, it is gone. `app/(auth)/sign-in.tsx` solves the
 * mirror-image problem with a local effect and `router.replace`, and that works there
 * precisely because signing in does *not* change the role.
 *
 * Hence the note. `lib/sign-out-intent.ts` holds it, the screen writes it before it makes the
 * call, and this reads it. See that file for why it is a module value rather than a param and
 * why nothing clears it.
 *
 * ## Why `signed-out` and not a truthy check
 *
 * The gate is keyed on the session becoming `"signed-out"`, not on a flag being set, and the
 * difference is the loop. `status` stays `"signed-out"` for as long as the reader is out, so a
 * gate that watched the note alone would fire on every render from here to the end of time.
 * Pairing the two means each fires once: the note is consumed by `takeSignOutNavigation`, and
 * a device that was *always* signed out has no note and is left alone — which is the whole
 * reason this is a note and not a redirect on the status itself, since browsing signed out is
 * a supported state in this app.
 *
 * ## The destination, and why not the group's index
 *
 * `/(auth)/sign-in` rather than `/` or `/welcome`. `(auth)/_layout.tsx` sets
 * `initialRouteName="welcome"` and documents why the callers push the exact form they mean:
 * *"a reader who arrived from 'your orders' wants the form, not the question of which form."*
 * A merchant who just signed out wants the form. And this screen's own palette clause in
 * `theme/select.ts` then paints that form in the consumer palette on purpose — a role nobody
 * holds yet must not colour the surface where the role is chosen.
 *
 * **`replace` and not `push`,** so the hardware back key cannot walk into a tree that has no
 * session behind it. The note is consumed *before* the navigation, so a second frame cannot
 * queue a second hop.
 */
function SignOutGate() {
	const { status } = useSession();
	const signedOut = status === "signed-out";

	useEffect(() => {
		if (!signedOut) return;
		if (takeSignOutNavigation() === null) return;
		router.replace("/(auth)/sign-in");
	}, [signedOut]);

	return null;
}

function ThemedStack() {
	const { colors, scheme } = useTheme();
	const resolved = useResolvedRole();
	const role = resolved.state === "ready" ? resolved.role : null;
	// The same two inputs `useTheme()` reads, asked a second question. The status bar is chrome
	// and has to know what canvas it is sitting on, and `scheme` cannot tell it: the merchant
	// palette is deliberately light-only (`theme/merchant.ts`), so a merchant on a dark-mode
	// phone has a `#FFFFFF` canvas under a status bar that `scheme === "dark"` would render in
	// light ink — a white clock on a white background. The guards above keep using `resolved`
	// rather than this scope on purpose: they decide which tree may mount, and a preference is
	// not an entitlement.
	const segments = useSegments();
	const onLightCanvas =
		selectTree({ segments, role: useThemeScope() }) === "business" ||
		scheme === "light";

	/**
	 * The device's own answers before anything can ask them. `lib/haptics.ts`
	 * reads its switch synchronously on every press, so the stored value has
	 * to be in memory ahead of the first touch rather than behind it.
	 * Location permission is requested by the existing location action, never
	 * by startup: opening an order is not consent to access the device's position.
	 */
	useEffect(() => {
		void initDevicePrefs();
	}, []);

	return (
		<>
			{/* Driven by our own palette rather than `style="auto"`, which follows the OS
			    setting — the two agree for the consumer and delivery trees, and for the
			    merchant tree only the palette is right, because the phone's answer says
			    nothing about a canvas that is white in both schemes. */}
			<StatusBar style={onLightCanvas ? "dark" : "light"} />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
					headerTintColor: colors.foreground,
					headerStyle: { backgroundColor: colors.background },
				}}
			>
				{/* A role change removes the previous tree from native history. This matters most
				    when auth is a modal: replacing that modal must not reveal the customer stack
				    that was underneath it when a courier presses Android Back. The child layouts
				    keep their entitlement guards for deep links; these root guards own history. */}
				<Stack.Protected guard={role === "customer"}>
					<Stack.Screen name="(customer)" />
				</Stack.Protected>
				<Stack.Protected guard={role === "business"}>
					<Stack.Screen name="(business)" />
				</Stack.Protected>
				<Stack.Protected guard={role === "delivery"}>
					<Stack.Screen name="(delivery)" />
				</Stack.Protected>
				<Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
			</Stack>
		</>
	);
}
