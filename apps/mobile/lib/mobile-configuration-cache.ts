import {
	type PublishedMobileConfiguration,
	publishedMobileConfigurationSchema,
} from "@pymeshub/shared";

/** A failed or future-format cache never replaces the bundled behavior. */
export function readMobileConfigurationCache(
	raw: string | null,
): { snapshot: PublishedMobileConfiguration; savedAt: number } | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!("snapshot" in parsed) ||
			!("savedAt" in parsed) ||
			typeof parsed.savedAt !== "number" ||
			!Number.isFinite(parsed.savedAt) ||
			parsed.savedAt < 0
		)
			return null;
		const snapshot = publishedMobileConfigurationSchema.safeParse(
			parsed.snapshot,
		);
		return snapshot.success
			? {
					snapshot: snapshot.data,
					savedAt: Math.min(parsed.savedAt, Date.now()),
				}
			: null;
	} catch {
		return null;
	}
}
