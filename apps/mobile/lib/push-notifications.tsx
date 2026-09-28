import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { AppState, Platform } from "react-native";

import { useSession } from "@/lib/auth/session";
import { getAccountProfile, initDevicePrefs } from "@/lib/device-prefs";
import { registerPushToken } from "@/lib/push-token";

export type PushStatus =
	| "checking"
	| "unasked"
	| "granted"
	| "denied"
	| "unavailable"
	| "error";

type PushValue = { status: PushStatus; request: () => Promise<void> };
const PushContext = createContext<PushValue | null>(null);

if (Platform.OS !== "web") {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	});
}

async function openNotification(
	response: Notifications.NotificationResponse,
): Promise<void> {
	const data = response.notification.request.content.data;
	const deliveryId = data?.deliveryId;
	if (typeof deliveryId === "string" && deliveryId.length > 0) {
		router.push({ pathname: "/delivery/[id]", params: { id: deliveryId } });
		return;
	}
	const orderId = data?.orderId;
	if (typeof orderId !== "string" || !orderId.startsWith("ord_")) return;
	await initDevicePrefs();
	if (getAccountProfile() === "business") {
		router.push({ pathname: "/merchant-order/[id]", params: { id: orderId } });
		return;
	}
	router.push({ pathname: "/order/[id]", params: { id: orderId } });
}

export function PushNotificationsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { status: sessionStatus } = useSession();
	const [status, setStatus] = useState<PushStatus>("checking");

	const refresh = useCallback(async () => {
		if (Platform.OS === "web") {
			setStatus("unavailable");
			return;
		}
		try {
			const permission = await Notifications.getPermissionsAsync();
			if (!permission.granted) {
				setStatus(permission.canAskAgain === false ? "denied" : "unasked");
				return;
			}
			setStatus("granted");
			if (sessionStatus === "signed-in") await registerPushToken();
		} catch {
			setStatus("error");
		}
	}, [sessionStatus]);

	useEffect(() => {
		void refresh();
		const appState = AppState.addEventListener("change", (next) => {
			if (next === "active") void refresh();
		});
		return () => appState.remove();
	}, [refresh]);

	useEffect(() => {
		if (Platform.OS === "web") return;
		const initial = Notifications.getLastNotificationResponse();
		if (initial) {
			void openNotification(initial);
			Notifications.clearLastNotificationResponse();
		}
		const subscription = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				void openNotification(response);
			},
		);
		return () => subscription.remove();
	}, []);

	const request = useCallback(async () => {
		if (Platform.OS === "web" || sessionStatus !== "signed-in") return;
		setStatus("checking");
		try {
			const permission = await Notifications.requestPermissionsAsync({
				ios: { allowAlert: true, allowBadge: true, allowSound: true },
			});
			if (!permission.granted) {
				setStatus("denied");
				return;
			}
			await registerPushToken();
			setStatus("granted");
		} catch {
			setStatus("error");
		}
	}, [sessionStatus]);

	const value = useMemo(() => ({ status, request }), [status, request]);
	return <PushContext value={value}>{children}</PushContext>;
}

export function usePushNotifications(): PushValue {
	const value = use(PushContext);
	if (!value)
		throw new Error("usePushNotifications requires PushNotificationsProvider");
	return value;
}
