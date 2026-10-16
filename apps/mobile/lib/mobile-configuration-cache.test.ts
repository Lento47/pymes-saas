import { expect, test } from "bun:test";
import { DEFAULT_MOBILE_CONFIGURATION } from "@pymeshub/shared";
import { readMobileConfigurationCache } from "./mobile-configuration-cache";

test("offline cache preserves the last validated published snapshot across restarts", () => {
	const snapshot = {
		revisionId: "mcr_test",
		revision: 2,
		publishedAt: "2026-01-01T00:00:00Z",
		configuration: {
			...DEFAULT_MOBILE_CONFIGURATION,
			visibility: { categories: false, future: false },
			hiddenCategoryIds: ["food"],
		},
	};
	expect(
		readMobileConfigurationCache(JSON.stringify({ snapshot, savedAt: 123 }))
			?.snapshot,
	).toEqual(snapshot);
});
test("corrupted, draft-only and unsupported snapshots do not block bundled fallback", () => {
	for (const raw of [
		null,
		"broken json",
		"null",
		JSON.stringify({
			savedAt: 123,
			snapshot: { draft: DEFAULT_MOBILE_CONFIGURATION },
		}),
		JSON.stringify({ savedAt: -1, snapshot: {} }),
		JSON.stringify({
			savedAt: 123,
			snapshot: {
				revision: 1,
				revisionId: "r",
				publishedAt: null,
				configuration: { ...DEFAULT_MOBILE_CONFIGURATION, version: 2 },
			},
		}),
	]) {
		expect(readMobileConfigurationCache(raw)).toBeNull();
	}
});
