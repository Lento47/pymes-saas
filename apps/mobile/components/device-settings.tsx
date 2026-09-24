import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/reduced-motion";
import { Card } from "./card";
import { ListRow } from "./list-row";
import { ScreenSection } from "./screen";
import { Text } from "./text";

/** OS permissions are read from the device, independently of account preferences. */
export function DeviceSettings() {
	const { t } = useT();
	const reducedMotion = useReducedMotion();
	const [permission, setPermission] =
		useState<Location.PermissionStatus | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let revision = 0;
		const refresh = async () => {
			const current = ++revision;
			try {
				const response = await Location.getForegroundPermissionsAsync();
				if (current === revision) setPermission(response.status);
			} catch {
				if (current === revision) setPermission(null);
			}
		};
		void refresh();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void refresh();
			else ++revision;
		});
		return () => {
			++revision;
			subscription.remove();
		};
	}, []);

	const openSettings = () => {
		setFailed(false);
		void Linking.openSettings().catch(() => setFailed(true));
	};

	return (
		<ScreenSection title={t("settings.device")}>
			<Card>
				<ListRow
					title={t("settings.location")}
					subtitle={t("settings.location.help")}
					state={t(
						permission === "granted"
							? "settings.permission.granted"
							: permission === "denied"
								? "settings.permission.denied"
								: permission === "undetermined"
									? "settings.permission.unasked"
									: "settings.permission.unknown",
					)}
					accessibilityHint={t("settings.device.open")}
					onPress={openSettings}
					chevron
				/>
				<ListRow
					title={t("settings.motion")}
					subtitle={t("settings.motion.help")}
					state={t(
						reducedMotion ? "settings.switch.on" : "settings.switch.off",
					)}
					accessibilityRole="none"
					divider={false}
				/>
			</Card>
			{failed ? (
				<Text
					tone="destructive"
					accessibilityRole="alert"
					accessibilityLiveRegion="assertive"
				>
					{t("settings.device.error")}
				</Text>
			) : null}
		</ScreenSection>
	);
}
