import { newRequestId } from "@pymeshub/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "api/app-router";
import Constants from "expo-constants";
import { Platform } from "react-native";
import superjson from "superjson";

import { accessToken } from "@/lib/auth/client";
import { env } from "@/lib/env";
import { notificationRuntime } from "@/lib/notification-runtime";

const TOKEN_KEY = "pymeshub:expo-push-token";
const Notifications = notificationRuntime();

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

function projectId(): string | undefined {
	const manifestProject = (
		Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined
	)?.eas?.projectId;
	if (typeof Constants.easConfig?.projectId === "string")
		return Constants.easConfig.projectId;
	return typeof manifestProject === "string" ? manifestProject : undefined;
}

export async function registerPushToken(): Promise<string> {
	if (Platform.OS !== "ios" && Platform.OS !== "android")
		throw new Error("push_not_available");
	if (!Notifications) throw new Error("push_not_available");
	const id = projectId();
	if (!id) throw new Error("push_project_missing");

	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("orders", {
			name: "Pedidos y entregas",
			importance: Notifications.AndroidImportance.HIGH,
			vibrationPattern: [0, 250, 200, 250],
			lightColor: "#F59E0B",
		});
	}

	const token = (await Notifications.getExpoPushTokenAsync({ projectId: id }))
		.data;
	await client.devices.register.mutate({ token, platform: Platform.OS });
	await AsyncStorage.setItem(TOKEN_KEY, token);
	return token;
}

/** Best effort before sign-out; the server also removes invalid tokens from receipts. */
export async function revokeStoredPushToken(): Promise<void> {
	const token = await AsyncStorage.getItem(TOKEN_KEY);
	if (!token) return;
	try {
		await client.devices.revoke.mutate({ token });
	} finally {
		await AsyncStorage.removeItem(TOKEN_KEY);
	}
}
