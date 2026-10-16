export const CAPSULE_LABEL_LINE_HEIGHT = 14;

/** Reserve two readable label lines without limiting the user's text size. */
export function labelledCapsuleExtraHeight(fontScale: number): number {
	return Math.ceil(Math.max(0, fontScale - 1) * CAPSULE_LABEL_LINE_HEIGHT * 2);
}
