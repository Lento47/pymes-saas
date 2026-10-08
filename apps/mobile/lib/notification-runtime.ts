import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * Expo Go and web cannot register this app's remote push notifications. Check the
 * runtime before requiring the package: a static import throws during startup in
 * Expo Go, before the provider can report the capability as unavailable.
 */
export function notificationRuntime():
	| typeof import("expo-notifications")
	| null {
	if (
		Platform.OS === "web" ||
		Constants.executionEnvironment === ExecutionEnvironment.StoreClient
	) {
		return null;
	}
	return require("expo-notifications") as typeof import("expo-notifications");
}
