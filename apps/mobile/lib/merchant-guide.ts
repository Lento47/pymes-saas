import AsyncStorage from "@react-native-async-storage/async-storage";

const GUIDE_VERSION = 1;
const seenThisSession = new Set<string>();

function guideKey(businessId: string): string {
	return `pymeshub_merchant_guide_v${GUIDE_VERSION}:${businessId}`;
}

export async function hasSeenMerchantGuide(
	businessId: string,
): Promise<boolean> {
	if (seenThisSession.has(businessId)) return true;
	try {
		const seen = (await AsyncStorage.getItem(guideKey(businessId))) === "1";
		if (seen) seenThisSession.add(businessId);
		return seen;
	} catch {
		// Allow one opening this session, then avoid repeated prompts on remount.
		seenThisSession.add(businessId);
		return false;
	}
}

export async function markMerchantGuideSeen(businessId: string): Promise<void> {
	seenThisSession.add(businessId);
	try {
		await AsyncStorage.setItem(guideKey(businessId), "1");
	} catch {
		// Dismissal must work even when device storage is unavailable.
	}
}
