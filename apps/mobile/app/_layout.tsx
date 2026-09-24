import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/toast";
import { SessionProvider } from "@/lib/auth/session";
import { initDevicePrefs } from "@/lib/device-prefs";
import { I18nProvider } from "@/lib/i18n";
import { ApiProvider } from "@/lib/trpc/provider";
import { ThemeModeProvider, useTheme } from "@/theme";

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
export default function RootLayout() {
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
							<SafeAreaProvider>
								<ToastProvider>
									<ThemedStack />
								</ToastProvider>
							</SafeAreaProvider>
						</ApiProvider>
					</SessionProvider>
				</I18nProvider>
			</ThemeModeProvider>
		</GestureHandlerRootView>
	);
}

function ThemedStack() {
	const { colors, scheme } = useTheme();

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
			    setting — the two are the same today, and the day a screen is deliberately
			    dark, `auto` is the version that renders dark text on it. */}
			<StatusBar style={scheme === "dark" ? "light" : "dark"} />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
					headerTintColor: colors.foreground,
					headerStyle: { backgroundColor: colors.background },
				}}
			>
				{/* The screens are declared by their own route groups — `(customer)/_layout.tsx`,
			    `(business)/_layout.tsx` and `(delivery)/_layout.tsx`, each guarding itself against a
			    resolved role it does not serve. The only entry this stack names by hand is the one
			    that behaves differently: `(auth)` is presented as a modal. Every other route is
			    registered by expo-router on its own; these declarations existed only to set a
			    per-screen option, and the header is already off for all of them. */}
				<Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
			</Stack>
		</>
	);
}
